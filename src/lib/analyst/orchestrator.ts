'use server';
/**
 * Autonomous Cybersecurity Analyst — Central Orchestrator
 *
 * The brain of the system. Ingests alerts from all 6 modules,
 * correlates them, triages, extracts IOCs, enriches domains,
 * and generates forensic reports.
 *
 * Flow:
 *   1. Ingest scan result from any module
 *   2. Extract IOCs
 *   3. Enrich domain-based IOCs (WHOIS + SSL)
 *   4. Auto-triage (true vs false positive)
 *   5. Correlate with existing alerts (cross-module)
 *   6. Create incident if multi-module attack detected
 *   7. Generate forensic report for incidents
 *   8. Persist everything to Firestore
 */

import { collection, addDoc, serverTimestamp, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { writeToAllScans, logAdminEvent } from '@/lib/firestore-writes';
import { extractIOCs } from './ioc-extractor';
import { enrichDomain } from './enrichment';
import type { DomainEnrichment } from './types';
import { triageAlert } from './triage';
import { correlateAlerts } from './correlator';
import { generateForensicReport, generateUserExplanation } from './report-generator';
import type {
  OrchestratorInput,
  OrchestratorResult,
  ModuleAlert,
  Incident,
  IOC,
  ThreatLevel,
} from './types';

/**
 * Process a scan result through the full analyst pipeline.
 */
export async function processScan(input: OrchestratorInput): Promise<OrchestratorResult> {
  const { userId, moduleType, rawData, subject } = input;
  const { firestore } = initializeFirebase();

  // ─── Step 1: Build ModuleAlert ─────────────────────────────────
  const riskScore = extractRiskScore(moduleType, rawData);
  const threatDetected = detectThreat(moduleType, rawData);
  const alertLevel: ThreatLevel =
    riskScore >= 9 ? 'critical' :
    riskScore >= 7 ? 'high' :
    riskScore >= 4 ? 'medium' : 'low';

  const summary = buildSummary(moduleType, rawData, subject);

  const alert: ModuleAlert = {
    id: `ALT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    moduleType,
    userId,
    riskScore,
    threatDetected,
    alertLevel,
    summary,
    details: rawData,
    iocs: [],
    scanTimestamp: new Date().toISOString(),
  };

  // ─── Step 2: Extract IOCs ─────────────────────────────────────
  alert.iocs = extractIOCs(moduleType, rawData, subject);

  // ─── Step 3: Enrich domain-based IOCs ─────────────────────────
  let enrichment: DomainEnrichment | undefined;
  const domainIocs = alert.iocs.filter(i => i.type === 'domain' || i.type === 'url');
  if (domainIocs.length > 0) {
    try {
      enrichment = await enrichDomain(domainIocs[0].value);
    } catch {
      // Non-critical — continue without enrichment
    }
  }

  // ─── Step 4: Auto-Triage ──────────────────────────────────────
  const triage = await triageAlert(alert, enrichment);

  // ─── Step 5: Correlate with existing alerts ────────────────────
  const existingAlerts = await getRecentAlerts(firestore, userId);
  const { incident, correlated } = correlateAlerts(alert, existingAlerts);

  // ─── Step 6: Generate forensic report if incident ─────────────
  let finalIncident: Incident | undefined;
  if (incident) {
    try {
      incident.forensicReport = await generateForensicReport(incident);
    } catch {
      // Continue without report
    }
    finalIncident = incident;

    // Persist incident to Firestore
    await persistIncident(firestore, userId, incident);
  }

  // ─── Step 7: Persist alert to Firestore ────────────────────────
  await persistAlert(firestore, userId, alert, enrichment, triage.isFalsePositive);

  // ─── Step 8: Write to allScans for admin ───────────────────────
  await writeToAllScans(firestore, {
    userId,
    moduleType,
    alertLevel,
    summary,
    riskScore,
    threatDetected,
    scanTimestamp: alert.scanTimestamp,
  });

  // ─── Step 9: Log admin event ───────────────────────────────────
  await logAdminEvent(firestore, {
    type: 'scan_completed',
    userId,
    amount: 0,
    timestamp: alert.scanTimestamp,
    metadata: { moduleType, alertLevel, threatDetected, incidentId: finalIncident?.id },
  });

  return {
    incident: finalIncident,
    alert,
    enrichment,
    triage,
  };
}

/**
 * Generate a user-friendly explanation for a scan result.
 */
export async function explainResult(
  moduleType: string,
  scanResult: Record<string, unknown>,
  threatDetected: boolean,
): Promise<string> {
  return generateUserExplanation(moduleType, scanResult, threatDetected);
}

// ─── Internal Helpers ────────────────────────────────────────────

function extractRiskScore(moduleType: string, data: Record<string, unknown>): number {
  if (moduleType === 'lure') {
    return data.is_lure ? ((data.confidence as number) || 0.5) * 10 : 0;
  }
  if (moduleType === 'email') {
    const r = data.impersonation_risk as string;
    if (r === 'high') return 9;
    if (r === 'medium') return 5;
    return 1;
  }
  if (moduleType === 'sms') {
    return typeof data.risk_score === 'number' ? data.risk_score : 0;
  }
  if (moduleType === 'deepfake') {
    return typeof data.risk_score === 'number' ? data.risk_score : 0;
  }
  return typeof data.risk_score === 'number'
    ? data.risk_score
    : typeof data.risk === 'number' ? data.risk : 0;
}

function detectThreat(moduleType: string, data: Record<string, unknown>): boolean {
  switch (moduleType) {
    case 'link': return data.status !== 'safe';
    case 'lure': return data.is_lure === true;
    case 'video': return data.malware_indicator === true || (typeof data.risk === 'number' && data.risk > 5);
    case 'email': return data.status !== 'safe';
    case 'sms': return data.verdict === 'high_risk' || data.verdict === 'critical';
    case 'deepfake': return data.verdict === 'likely_deepfake' || data.verdict === 'confirmed_deepfake';
    default: return false;
  }
}

function buildSummary(moduleType: string, data: Record<string, unknown>, subject?: string): string {
  switch (moduleType) {
    case 'link':
      return subject ? `${subject} — ${data.reason || ''}` : (data.reason as string) || 'URL analyzed';
    case 'lure':
      return (data.trigger_phrase as string) || `${data.scam_type || 'social engineering'} pattern detected`;
    case 'video':
      return Array.isArray(data.suspicious_elements)
        ? (data.suspicious_elements as string[]).join(', ')
        : 'Media header audit complete';
    case 'email':
    case 'sms':
    case 'deepfake':
      return (data.summary as string) || `${moduleType} scan complete`;
    default:
      return `${moduleType} scan complete`;
  }
}

/**
 * Get recent alerts for a user (for correlation).
 */
async function getRecentAlerts(firestore: ReturnType<typeof initializeFirebase>['firestore'], userId: string): Promise<ModuleAlert[]> {
  try {
    const q = query(
      collection(firestore, 'users', userId, 'analystAlerts'),
      orderBy('scanTimestamp', 'desc'),
      limit(20),
    );
    const snap = await getDocs(q);
    return snap.docs.map(doc => doc.data() as ModuleAlert);
  } catch {
    return [];
  }
}

/**
 * Persist an alert to Firestore.
 */
async function persistAlert(
  firestore: ReturnType<typeof initializeFirebase>['firestore'],
  userId: string,
  alert: ModuleAlert,
  enrichment?: DomainEnrichment,
  isFalsePositive?: boolean,
): Promise<void> {
  try {
    await addDoc(collection(firestore, 'users', userId, 'analystAlerts'), {
      ...alert,
      enrichment: enrichment || null,
      isFalsePositive: isFalsePositive || false,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.error('[analyst] Failed to persist alert:', e);
  }
}

/**
 * Persist an incident to Firestore.
 */
async function persistIncident(
  firestore: ReturnType<typeof initializeFirebase>['firestore'],
  userId: string,
  incident: Incident,
): Promise<void> {
  try {
    await addDoc(collection(firestore, 'users', userId, 'analystIncidents'), {
      ...incident,
      createdAt: serverTimestamp(),
    });

    // Also write to root-level collection for admin visibility
    await addDoc(collection(firestore, 'analystIncidents'), {
      ...incident,
      userId,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.error('[analyst] Failed to persist incident:', e);
  }
}
