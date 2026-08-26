/**
 * Shared Firestore write utilities.
 *
 * Every scan writes to TWO places:
 *   1. users/{uid}/securityScanResults  (user-scoped — already exists)
 *   2. allScans/{scanId}                (root-level — enables admin aggregation)
 *
 * Every scan also logs an adminEvent for revenue/metrics tracking.
 */

import { collection, addDoc, serverTimestamp, type Firestore } from 'firebase/firestore';

// ─── Types ────────────────────────────────────────────────────────
export type AllScanDoc = {
  userId: string;
  moduleType: string;
  alertLevel: string;
  summary: string;
  riskScore: number;
  threatDetected: boolean;
  scanTimestamp: string;
  createdAt: ReturnType<typeof serverTimestamp>;
};

export type AdminEventType =
  | 'scan_completed'
  | 'ad_impression'
  | 'rewarded_ad_completed'
  | 'daily_login'
  | 'referral';

export type AdminEventDoc = {
  type: AdminEventType;
  userId: string;
  amount: number;
  timestamp: string;
  metadata: Record<string, unknown>;
  createdAt: ReturnType<typeof serverTimestamp>;
};

// ─── Writers ──────────────────────────────────────────────────────

/**
 * Write a scan record to the root-level `allScans` collection so the
 * admin can query across ALL users without the Admin SDK.
 */
export async function writeToAllScans(
  firestore: Firestore,
  data: Omit<AllScanDoc, 'createdAt'>,
): Promise<void> {
  try {
    await addDoc(collection(firestore, 'allScans'), {
      ...data,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    // Non-critical — don't break the scan flow
    console.error('Failed to write to allScans:', e);
  }
}

/**
 * Log a revenue / metrics event for the admin dashboard.
 */
export async function logAdminEvent(
  firestore: Firestore,
  data: Omit<AdminEventDoc, 'createdAt'>,
): Promise<void> {
  try {
    await addDoc(collection(firestore, 'adminEvents'), {
      ...data,
      createdAt: serverTimestamp(),
    });
  } catch (e) {
    console.error('Failed to write adminEvent:', e);
  }
}

// ─── Helpers ──────────────────────────────────────────────────────

/** Map a scan type + raw data to a normalised alert level. */
export function deriveAlertLevel(
  moduleType: string,
  data: Record<string, unknown>,
): string {
  const score =
    typeof data.risk_score === 'number'
      ? data.risk_score
      : typeof data.risk === 'number'
        ? data.risk
        : 0;

  if (moduleType === 'lure') {
    return (data.is_lure as boolean)
      ? ((data.confidence as number) >= 0.8 ? 'high' : 'medium')
      : 'low';
  }
  if (moduleType === 'email') {
    return (data.impersonation_risk as string) || 'low';
  }
  if (moduleType === 'sms') {
    const v = data.verdict as string;
    if (v === 'critical') return 'critical';
    if (v === 'high_risk') return 'high';
    if (v === 'suspicious') return 'medium';
    return 'low';
  }
  if (moduleType === 'deepfake') {
    const v = data.verdict as string;
    if (v === 'confirmed_deepfake') return 'critical';
    if (v === 'likely_deepfake') return 'high';
    if (v === 'suspicious') return 'medium';
    return 'low';
  }

  // link / video — use numeric score
  if (score >= 9) return 'critical';
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

/** Derive a human-readable summary from scan data. */
export function deriveSummary(
  moduleType: string,
  data: Record<string, unknown>,
  subject?: string,
): string {
  switch (moduleType) {
    case 'link':
      return subject
        ? `${subject} — ${data.reason || ''}`
        : (data.reason as string) || '';
    case 'lure':
      return (data.trigger_phrase as string) || `${data.scam_type || 'social engineering'} pattern detected`;
    case 'video':
      return Array.isArray(data.suspicious_elements)
        ? (data.suspicious_elements as string[]).join(', ')
        : 'Media header audit complete';
    case 'email':
    case 'sms':
    case 'deepfake':
      return (data.summary as string) || '';
    default:
      return '';
  }
}

/** Check if a scan result indicates a threat was detected. */
export function isThreatDetected(
  moduleType: string,
  data: Record<string, unknown>,
): boolean {
  switch (moduleType) {
    case 'link':
      return data.status !== 'safe';
    case 'lure':
      return data.is_lure === true;
    case 'video':
      return data.malware_indicator === true || (typeof data.risk === 'number' && data.risk > 5);
    case 'email':
      return data.status !== 'safe';
    case 'sms':
      return data.verdict === 'high_risk' || data.verdict === 'critical';
    case 'deepfake':
      return data.verdict === 'likely_deepfake' || data.verdict === 'confirmed_deepfake';
    default:
      return false;
  }
}

/** Extract a numeric risk score (0-10) from any module's output. */
export function extractRiskScore(
  moduleType: string,
  data: Record<string, unknown>,
): number {
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
  // link, video
  return typeof data.risk_score === 'number'
    ? data.risk_score
    : typeof data.risk === 'number'
      ? data.risk
      : 0;
}
