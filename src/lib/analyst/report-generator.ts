/**
 * Forensic Report Generator
 *
 * Uses Nemotron to generate instant forensic summaries,
 * user-friendly explanations, and recommended actions.
 */

import { callNemotron } from '@/lib/openrouter';
import type { Incident, ForensicReport, ModuleAlert } from './types';

/**
 * Generate a forensic report for an incident using Nemotron AI.
 */
export async function generateForensicReport(incident: Incident): Promise<ForensicReport> {
  const alertsSummary = incident.alerts.map(formatAlertForReport).join('\n\n');
  const iocSummary = incident.iocs.map(i =>
    `- [${i.type.toUpperCase()}] ${i.value} (confidence: ${Math.round(i.confidence * 100)}%, source: ${i.source})`
  ).join('\n');

  const systemPrompt = `You are a world-class cybersecurity forensic analyst. Generate a professional forensic incident report.

Respond with ONLY valid JSON (no markdown):
{
  "summary": "Executive summary (2-3 sentences for non-technical stakeholders)",
  "technicalDetails": "Detailed technical breakdown for security engineers",
  "recommendedActions": ["action1", "action2", ...],
  "confidenceScore": number (0-1)
}

Be specific, reference actual IOCs and modules. Be concise but thorough.`;

  const userPrompt = `INCIDENT REPORT REQUEST
========================
Incident ID: ${incident.id}
Threat Level: ${incident.threatLevel.toUpperCase()}
Risk Score: ${incident.riskScore}/10
Modules Involved: ${incident.modules.join(', ')}
Status: ${incident.status}

ALERTS:
${alertsSummary}

INDICATORS OF COMPROMISE:
${iocSummary || 'No IOCs extracted'}

TIMELINE:
${incident.timeline.map(t => `${t.timestamp}: ${t.description}`).join('\n')}

Please generate the forensic report.`;

  try {
    const response = await callNemotron(systemPrompt, userPrompt, 0.3, 1500);
    const cleaned = response.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    return {
      summary: parsed.summary || 'Report generation incomplete.',
      technicalDetails: parsed.technicalDetails || 'No technical details available.',
      recommendedActions: Array.isArray(parsed.recommendedActions) ? parsed.recommendedActions : [],
      iocSummary: incident.iocs,
      affectedModules: incident.modules,
      confidenceScore: typeof parsed.confidenceScore === 'number' ? parsed.confidenceScore : 0.5,
      generatedAt: new Date().toISOString(),
    };
  } catch (e) {
    // Fallback: generate a basic report without AI
    return generateFallbackReport(incident);
  }
}

/**
 * Format a single alert for the report prompt.
 */
function formatAlertForReport(alert: ModuleAlert): string {
  const lines = [
    `Module: ${alert.moduleType}`,
    `Risk: ${alert.riskScore}/10 | Level: ${alert.alertLevel}`,
    `Summary: ${alert.summary}`,
    `Threat Detected: ${alert.threatDetected}`,
  ];

  if (alert.iocs.length > 0) {
    lines.push(`IOCs: ${alert.iocs.map(i => `${i.type}=${i.value}`).join(', ')}`);
  }

  return lines.join(' | ');
}

/**
 * Fallback report when AI is unavailable.
 */
function generateFallbackReport(incident: Incident): ForensicReport {
  const moduleList = incident.modules.join(', ');
  const iocCount = incident.iocs.length;
  const criticalIocs = incident.iocs.filter(i => i.confidence > 0.8);

  return {
    summary: `${incident.title}. Detected ${incident.alerts.length} alert(s) across [${moduleList}]. ` +
      `Composite risk score: ${incident.riskScore}/10. ${iocCount} IOCs extracted.`,
    technicalDetails: `Incident ${incident.id} comprises ${incident.alerts.length} correlated alerts. ` +
      `Modules: ${moduleList}. Risk: ${incident.riskScore}/10. ` +
      `${criticalIocs.length} high-confidence IOCs identified. ` +
      `Timeline spans ${incident.timeline.length} events.`,
    recommendedActions: [
      incident.riskScore >= 7 ? 'Block identified IOCs immediately' : 'Monitor identified IOCs',
      `Review ${incident.alerts.length} correlated alert(s) for details`,
      iocCount > 0 ? 'Share IOCs with threat intelligence feeds' : 'Collect additional IOCs',
      incident.threatLevel === 'critical' ? 'Escalate to incident response team' : 'Continue monitoring',
    ],
    iocSummary: incident.iocs,
    affectedModules: incident.modules,
    confidenceScore: 0.6, // Lower confidence for fallback
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Generate a user-friendly explanation (non-technical) for a scan result.
 */
export async function generateUserExplanation(
  moduleType: string,
  scanResult: Record<string, unknown>,
  threatDetected: boolean,
): Promise<string> {
  if (!threatDetected) {
    return 'This item appears to be safe. No threats were detected by our analysis.';
  }

  const systemPrompt = `Explain this cybersecurity finding in simple, non-technical language.
Be brief (2-3 sentences). Focus on what the user should do next.
Do NOT use technical jargon.`;

  const userPrompt = `Scan type: ${moduleType}\nResult: ${JSON.stringify(scanResult, null, 2)}`;

  try {
    const response = await callNemotron(systemPrompt, userPrompt, 0.3, 256);
    return response || 'A potential threat was detected. Please review the details carefully.';
  } catch {
    return 'A potential threat was detected. Please review the details carefully and avoid interacting with this item.';
  }
}
