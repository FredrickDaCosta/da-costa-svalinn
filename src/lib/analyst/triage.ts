/**
 * Auto-Triage Engine
 *
 * Verifies whether a detected threat is a true positive or false positive,
 * provides reasoning, and recommends automated actions.
 */

import { callNemotron } from '@/lib/openrouter';
import type { ModuleAlert, TriageResult, IOC, DomainEnrichment } from './types';

/**
 * Triage a single alert — uses Nemotron to reason about whether it's a true threat.
 */
export async function triageAlert(
  alert: ModuleAlert,
  enrichment?: DomainEnrichment,
): Promise<TriageResult> {
  const enrichmentContext = enrichment
    ? `\nDomain enrichment: Age=${enrichment.domainAge ?? 'unknown'}d, SSL=${enrichment.sslValid ?? 'unknown'}, Reputation=${enrichment.reputation ?? 'unknown'}, Registrar=${enrichment.registrar ?? 'unknown'}`
    : '';

  const iocContext = alert.iocs.length > 0
    ? `\nExtracted IOCs: ${alert.iocs.map(i => `${i.type}=${i.value}(${Math.round(i.confidence * 100)}%)`).join(', ')}`
    : '';

  const systemPrompt = `You are an expert cybersecurity triage analyst. Given a security alert, determine if it is a TRUE POSITIVE or FALSE POSITIVE.

Respond with ONLY valid JSON (no markdown):
{
  "isFalsePositive": boolean,
  "confidence": number (0-1),
  "reasoning": "string explaining your decision",
  "recommendedAction": "block" | "warn" | "monitor" | "allow",
  "autoAction": "quarantine_email" | "block_url" | "block_number" | "flag_deepfake" | "none"
}

Rules:
- Be conservative: when in doubt, treat as true positive
- Consider risk score, module type, and enrichment data
- For link scans: new domains (< 30 days) + no SSL = likely malicious
- For email: sender domain mismatch + urgency language = likely phishing
- For SMS: unknown sender + suspicious URL = likely smishing
- For deepfake: high confidence score = likely deepfake
- autoAction should be "none" for false positives`;

  const userPrompt = `Alert: ${alert.moduleType}
Risk Score: ${alert.riskScore}/10
Alert Level: ${alert.alertLevel}
Summary: ${alert.summary}
Threat Detected: ${alert.threatDetected}
${enrichmentContext}${iocContext}
Full Details: ${JSON.stringify(alert.details, null, 2)}`;

  try {
    const response = await callNemotron(systemPrompt, userPrompt, 0.2, 512);
    const cleaned = response.replace(/```json/g, '').replace(/```/g, '').trim();
    const result = JSON.parse(cleaned) as TriageResult;
    return result;
  } catch (e) {
    // Fallback: use rule-based triage if AI fails
    return ruleBasedTriage(alert, enrichment);
  }
}

/**
 * Rule-based fallback triage (no AI needed).
 */
function ruleBasedTriage(
  alert: ModuleAlert,
  enrichment?: DomainEnrichment,
): TriageResult {
  let falsePositiveScore = 0;
  const reasons: string[] = [];

  // High risk scores are rarely false positives
  if (alert.riskScore >= 8) {
    falsePositiveScore -= 3;
    reasons.push('High risk score reduces false positive likelihood');
  }

  // Low risk scores are more likely false positives
  if (alert.riskScore <= 2) {
    falsePositiveScore += 3;
    reasons.push('Low risk score increases false positive likelihood');
  }

  // Domain enrichment signals
  if (enrichment) {
    if (enrichment.domainAge !== undefined && enrichment.domainAge > 365) {
      falsePositiveScore += 2;
      reasons.push(`Domain is ${enrichment.domainAge} days old (established)`);
    }
    if (enrichment.domainAge !== undefined && enrichment.domainAge < 30) {
      falsePositiveScore -= 2;
      reasons.push(`Domain is very new (${enrichment.domainAge} days)`);
    }
    if (enrichment.sslValid === true) {
      falsePositiveScore += 1;
      reasons.push('Valid SSL certificate');
    }
    if (enrichment.reputation === 'clean') {
      falsePositiveScore += 2;
      reasons.push('Domain reputation is clean');
    }
    if (enrichment.reputation === 'malicious') {
      falsePositiveScore -= 3;
      reasons.push('Domain reputation is malicious');
    }
  }

  // Multiple IOCs increase confidence
  if (alert.iocs.length >= 3) {
    falsePositiveScore -= 1;
    reasons.push(`${alert.iocs.length} IOCs extracted (corroboration)`);
  }

  const isFalsePositive = falsePositiveScore > 2;
  const confidence = Math.min(1, Math.max(0, 0.5 + (falsePositiveScore * 0.1)));

  let recommendedAction: TriageResult['recommendedAction'] = 'warn';
  let autoAction: TriageResult['autoAction'] = 'none';

  if (isFalsePositive) {
    recommendedAction = 'allow';
  } else if (alert.riskScore >= 9) {
    recommendedAction = 'block';
    autoAction = alert.moduleType === 'email' ? 'quarantine_email'
      : alert.moduleType === 'link' ? 'block_url'
      : alert.moduleType === 'sms' ? 'block_number'
      : alert.moduleType === 'deepfake' ? 'flag_deepfake'
      : 'none';
  } else if (alert.riskScore >= 6) {
    recommendedAction = 'warn';
  } else {
    recommendedAction = 'monitor';
  }

  return {
    isFalsePositive,
    confidence,
    reasoning: reasons.join('. ') || 'Rule-based fallback: insufficient data for confident classification.',
    recommendedAction,
    autoAction,
  };
}

/**
 * Triage multiple alerts in batch.
 */
export async function triageBatch(
  alerts: ModuleAlert[],
  enrichments?: Map<string, DomainEnrichment>,
): Promise<Map<string, TriageResult>> {
  const results = new Map<string, TriageResult>();

  // Process sequentially to respect rate limits
  for (const alert of alerts) {
    const enrichment = enrichments?.get(alert.id);
    const result = await triageAlert(alert, enrichment);
    results.set(alert.id, result);
  }

  return results;
}
