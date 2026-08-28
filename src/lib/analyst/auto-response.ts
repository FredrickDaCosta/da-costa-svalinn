/**
 * Automated Response Actions
 *
 * Executes response actions based on triage results:
 * - quarantine_email: Flags email as quarantined in Firestore
 * - block_url: Adds URL to user's blocked list
 * - block_number: Adds phone number to user's blocked list
 * - flag_deepfake: Flags audio/video as deepfake in Firestore
 *
 * These actions are logged to the analyst timeline for audit trail.
 */

import { collection, addDoc, serverTimestamp, getDocs, query, where, deleteDoc, doc } from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';
import type { ModuleType, TriageResult } from './types';

export interface AutoActionResult {
  action: string;
  success: boolean;
  message: string;
  timestamp: string;
}

/**
 * Execute the recommended auto-action from triage.
 */
export async function executeAutoResponse(
  userId: string,
  moduleType: ModuleType,
  triage: TriageResult,
  rawData: Record<string, unknown>,
  subject?: string,
): Promise<AutoActionResult | null> {
  const action = triage.autoAction;
  if (!action || action === 'none') return null;

  const { firestore } = initializeFirebase();
  const timestamp = new Date().toISOString();

  try {
    switch (action) {
      case 'quarantine_email':
        return await quarantineEmail(firestore, userId, rawData, timestamp);
      case 'block_url':
        return await blockUrl(firestore, userId, subject || (rawData.url as string) || '', timestamp);
      case 'block_number':
        return await blockNumber(firestore, userId, rawData, timestamp);
      case 'flag_deepfake':
        return await flagDeepfake(firestore, userId, rawData, timestamp);
      default:
        return null;
    }
  } catch (e: any) {
    return {
      action,
      success: false,
      message: `Action failed: ${e.message}`,
      timestamp,
    };
  }
}

/**
 * Quarantine an email — flag it in Firestore so the user knows to avoid it.
 */
async function quarantineEmail(
  firestore: ReturnType<typeof initializeFirebase>['firestore'],
  userId: string,
  data: Record<string, unknown>,
  timestamp: string,
): Promise<AutoActionResult> {
  const sender = (data.sender as string) || (data.from as string) || 'unknown';
  const subject = (data.subject as string) || 'No subject';

  await addDoc(collection(firestore, 'users', userId, 'quarantinedItems'), {
    type: 'email',
    sender,
    subject,
    status: 'quarantined',
    reason: 'Auto-quarantined by Cybersecurity Analyst',
    createdAt: serverTimestamp(),
    timestamp,
  });

  return {
    action: 'quarantine_email',
    success: true,
    message: `Email from "${sender}" quarantined — subject: "${subject}"`,
    timestamp,
  };
}

/**
 * Block a URL — add it to the user's blocked list.
 */
async function blockUrl(
  firestore: ReturnType<typeof initializeFirebase>['firestore'],
  userId: string,
  url: string,
  timestamp: string,
): Promise<AutoActionResult> {
  // Normalize the URL
  const normalized = url.toLowerCase().trim();

  // Check if already blocked
  const existing = await getDocs(
    query(collection(firestore, 'users', userId, 'blockedUrls'), where('url', '==', normalized)),
  );
  if (!existing.empty) {
    return {
      action: 'block_url',
      success: true,
      message: `URL already blocked: ${normalized}`,
      timestamp,
    };
  }

  await addDoc(collection(firestore, 'users', userId, 'blockedUrls'), {
    url: normalized,
    status: 'blocked',
    reason: 'Auto-blocked by Cybersecurity Analyst',
    createdAt: serverTimestamp(),
    timestamp,
  });

  return {
    action: 'block_url',
    success: true,
    message: `URL blocked: ${normalized}`,
    timestamp,
  };
}

/**
 * Block a phone number — add it to the user's blocked list.
 */
async function blockNumber(
  firestore: ReturnType<typeof initializeFirebase>['firestore'],
  userId: string,
  data: Record<string, unknown>,
  timestamp: string,
): Promise<AutoActionResult> {
  const number = (data.phoneNumber as string) || (data.sender as string) || 'unknown';

  await addDoc(collection(firestore, 'users', userId, 'blockedNumbers'), {
    number,
    status: 'blocked',
    reason: 'Auto-blocked by Cybersecurity Analyst',
    createdAt: serverTimestamp(),
    timestamp,
  });

  return {
    action: 'block_number',
    success: true,
    message: `Phone number blocked: ${number}`,
    timestamp,
  };
}

/**
 * Flag audio/video as a suspected deepfake.
 */
async function flagDeepfake(
  firestore: ReturnType<typeof initializeFirebase>['firestore'],
  userId: string,
  data: Record<string, unknown>,
  timestamp: string,
): Promise<AutoActionResult> {
  const verdict = (data.verdict as string) || 'suspected_deepfake';
  const confidence = typeof data.risk_score === 'number' ? data.risk_score / 10 : 0.5;

  await addDoc(collection(firestore, 'users', userId, 'flaggedDeepfakes'), {
    type: 'deepfake',
    verdict,
    confidence,
    status: 'flagged',
    reason: 'Auto-flagged by Cybersecurity Analyst',
    createdAt: serverTimestamp(),
    timestamp,
  });

  return {
    action: 'flag_deepfake',
    success: true,
    message: `Media flagged as ${verdict} (${Math.round(confidence * 100)}% confidence)`,
    timestamp,
  };
}
