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

import { collection, doc, setDoc, serverTimestamp, getDocs, query, orderBy, limit } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import { writeToAllScans, logAdminEvent } from '@/lib/firestore-writes';
import { extractIOCs } from './ioc-extractor';
import { enrichDomain } from './enrichment';
import type { DomainEnrichment } from './types';
import { triageAlert } from './triage';
import { correlateAlerts } from './correlator';
import { generateForensicReport } from './report-generator';
import '@/lib/actions'; // registers playbook actions incl. quarantine_email/block_url/block_number/flag_deepfake
import { getAction } from '@/lib/playbooks/engine';
import type {
  OrchestratorInput,
  OrchestratorResult,
  ModuleAlert,
  Incident,
  IOC,
  ThreatLevel,
  AutoActionResult,
  PendingAction,
  GatedAutoAction,
  TriageResult,
} from './types';
import { GATED_AUTO_ACTIONS } from './types';

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

  // ─── Step 5: Execute automated response ──────────────────────
  // Action-type gate, not a confidence/severity one: 'block_url' and
  // 'block_number' stay immediate/autonomous regardless of riskScore or
  // triage.confidence. 'quarantine_email' and 'flag_deepfake' always go
  // to a pending-approval queue instead — an authenticated Approve call
  // (src/app/api/orchestrator/decide-action/route.ts) is what actually
  // invokes the handler for those two.
  let autoResponse: AutoActionResult | null = null;
  let pendingAction: PendingAction | null = null;
  if (!triage.isFalsePositive && triage.autoAction && triage.autoAction !== 'none') {
    const params = buildActionParams(triage.autoAction, rawData, subject);

    if ((GATED_AUTO_ACTIONS as readonly string[]).includes(triage.autoAction)) {
      pendingAction = {
        id: `PA-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        userId,
        alertId: alert.id,
        action: triage.autoAction as GatedAutoAction,
        status: 'pending',
        reasoning: triage.reasoning,
        params,
        requestedAt: new Date().toISOString(),
      };
    } else {
      const handler = getAction(triage.autoAction);
      if (handler) {
        const result = await handler(params, { userId, dryRun: false });
        autoResponse = {
          action: result.action ?? triage.autoAction,
          success: result.success,
          message: result.message ?? (result.success ? 'Action completed.' : (result.error || 'Action failed.')),
          timestamp: result.timestamp ?? new Date().toISOString(),
          data: result.data,
          error: result.error,
          idempotencyKey: result.idempotencyKey,
        };
      }
    }
  }

  // ─── Step 6: Correlate with existing alerts ────────────────────
    const existingAlerts = await getRecentAlerts(firestore, userId);
    const { incident, correlated } = await correlateAlerts(alert, existingAlerts);

  // ─── Step 7: Generate forensic report if incident ─────────────
  let finalIncident: Incident | undefined;
  if (incident) {
    try {
      incident.forensicReport = await generateForensicReport(incident);
    } catch {
      // Continue without report
    }
    finalIncident = incident;
    alert.incidentId = incident.id;

    // Upsert incident (creates new, or merges into an existing incident
    // that a correlated alert already belonged to — see correlator.ts)
    await persistIncident(firestore, userId, incident);

    // Tag correlated alerts that don't yet know about this incident,
    // so a future correlation pass can find and merge into it directly
    // instead of building a duplicate incident.
    await syncCorrelatedAlertIncidentIds(firestore, userId, correlated, incident.id);

    if (pendingAction) pendingAction.incidentId = incident.id;
  }

  // ─── Step 7b: Persist pending action, awaiting Approve/Deny ───
  if (pendingAction) {
    await persistPendingAction(firestore, userId, pendingAction);
  }

  // ─── Step 8: Persist alert to Firestore ────────────────────────
  await persistAlert(firestore, userId, alert, enrichment, triage.isFalsePositive);

  // ─── Step 9: Write to allScans for admin ───────────────────────
  await writeToAllScans(firestore, {
    userId,
    moduleType,
    alertLevel,
    summary,
    riskScore,
    threatDetected,
    scanTimestamp: alert.scanTimestamp,
  });

  // ─── Step 10: Log admin event ──────────────────────────────────
  await logAdminEvent(firestore, {
    type: 'scan_completed',
    userId,
    amount: 0,
    timestamp: alert.scanTimestamp,
    metadata: { moduleType, alertLevel, threatDetected, incidentId: finalIncident?.id, autoResponse: autoResponse?.action, pendingAction: pendingAction?.action },
  });

  return {
    incident: finalIncident,
    alert,
    enrichment,
    triage,
    autoResponse: autoResponse || undefined,
    pendingAction: pendingAction || undefined,
  };
}

// ─── Internal Helpers ────────────────────────────────────────────

/**
 * 'block_url' and 'block_number' consult the scan subject as a
 * fallback, since the AI module output for link/sms scans never
 * echoes the original URL/phone number back — only the request that
 * triggered the scan (threaded through as `subject`) has it.
 */
function buildActionParams(
  autoAction: NonNullable<TriageResult['autoAction']>,
  rawData: Record<string, unknown>,
  subject?: string,
): Record<string, unknown> {
  if (autoAction === 'block_url') {
    return { ...rawData, url: subject || rawData.url };
  }
  if (autoAction === 'block_number') {
    return { ...rawData, phoneNumber: subject || rawData.phoneNumber };
  }
  return rawData;
}

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
 * Persist an alert to Firestore, keyed by its own id so a later
 * correlation pass can address it directly (e.g. to stamp incidentId).
 */
async function persistAlert(
  firestore: ReturnType<typeof initializeFirebase>['firestore'],
  userId: string,
  alert: ModuleAlert,
  enrichment?: DomainEnrichment,
  isFalsePositive?: boolean,
): Promise<void> {
  try {
    await setDoc(doc(firestore, 'users', userId, 'analystAlerts', alert.id), {
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
 * Persist a pending gated action (quarantine_email / flag_deepfake),
 * keyed by its own id. Nothing executes until an authenticated Approve
 * call (src/app/api/orchestrator/decide-action/route.ts) reads this doc
 * and invokes the handler with the params captured here.
 */
async function persistPendingAction(
  firestore: ReturnType<typeof initializeFirebase>['firestore'],
  userId: string,
  pendingAction: PendingAction,
): Promise<void> {
  try {
    await setDoc(doc(firestore, 'users', userId, 'pendingActions', pendingAction.id), pendingAction);
  } catch (e) {
    console.error('[analyst] Failed to persist pending action:', e);
  }
}

/**
 * Upsert an incident to Firestore, keyed by its own id. Reused for both
 * a brand-new incident and a merge into an existing one (correlator.ts
 * preserves the original id/createdAt/status when merging), so this is
 * always a full overwrite with the incident's current, authoritative state.
 */
async function persistIncident(
  firestore: ReturnType<typeof initializeFirebase>['firestore'],
  userId: string,
  incident: Incident,
): Promise<void> {
  try {
    await setDoc(doc(firestore, 'users', userId, 'analystIncidents', incident.id), incident);

    // Also write to root-level collection for admin visibility
    await setDoc(doc(firestore, 'analystIncidents', incident.id), { ...incident, userId });
  } catch (e) {
    console.error('[analyst] Failed to persist incident:', e);
  }
}

/**
 * Stamp incidentId onto already-persisted alerts that were just folded
 * into `incidentId` for the first time, so the next alert that
 * correlates with one of them finds the incident directly instead of
 * only via IOC re-matching (which would otherwise build a duplicate).
 */
async function syncCorrelatedAlertIncidentIds(
  firestore: ReturnType<typeof initializeFirebase>['firestore'],
  userId: string,
  correlated: ModuleAlert[],
  incidentId: string,
): Promise<void> {
  for (const a of correlated) {
    if (a.incidentId === incidentId) continue;
    try {
      await setDoc(doc(firestore, 'users', userId, 'analystAlerts', a.id), { incidentId }, { merge: true });
    } catch (e) {
      console.error('[analyst] Failed to sync incidentId onto correlated alert:', e);
    }
  }
}
