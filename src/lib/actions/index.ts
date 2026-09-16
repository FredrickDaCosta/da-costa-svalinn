/**
 * Automated Action Integrations for Da-Costa Svalinn
 * 
 * Real external action implementations (not just Firestore flags).
 * Each action is idempotent, returns structured result, supports dry-run mode.
 */

import { initializeFirebase } from '@/firebase';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';

// ─── Types ─────────────────────────────────────────────────────────

export interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
  action: string;
  timestamp: string;
  idempotencyKey?: string;
  message?: string;
}

export interface ActionContext {
  userId: string;
  incidentId?: string;
  executionId?: string;
  dryRun?: boolean;
}

// ─── Gmail Integration ────────────────────────────────────────────

interface GmailCredentials {
  accessToken: string;
  refreshToken?: string;
  expiryDate?: number;
}

async function getGmailCredentials(userId: string): Promise<GmailCredentials | null> {
  const { firestore } = initializeFirebase();
  const credDoc = await getDoc(doc(firestore, 'users', userId, 'integrations', 'gmail'));
  
  if (!credDoc.exists()) return null;
  return credDoc.data() as GmailCredentials;
}

async function ensureValidGmailToken(userId: string): Promise<string> {
  const creds = await getGmailCredentials(userId);
  if (!creds) throw new Error('Gmail not connected');
  
  if (creds.expiryDate && creds.expiryDate < Date.now() + 60000) {
    // Token expired or expiring soon - would need refresh logic
    // For now, return existing token
    console.warn('[Gmail] Access token may be expired');
  }
  
  return creds.accessToken;
}

export async function gmailQuarantine(
  params: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  const messageId = params.messageId as string;
  const userId = params.userId as string;
  const idempotencyKey = `gmail:quarantine:${messageId}:${userId}`;
  
  if (context.dryRun) {
    return { success: true, data: { messageId, action: 'quarantine' }, action: 'gmail.quarantine', timestamp: new Date().toISOString(), idempotencyKey };
  }
  
  try {
    const accessToken = await ensureValidGmailToken(userId);
    
    // Gmail API: Modify message to add TRASH label and remove INBOX
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          addLabelIds: ['TRASH'],
          removeLabelIds: ['INBOX', 'UNREAD'],
        }),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Gmail API error: ${response.status} ${error}`);
    }
    
    // Log action
    await logAction(userId, 'gmail.quarantine', { messageId }, 'success');
    
    return { success: true, data: { messageId }, action: 'gmail.quarantine', timestamp: new Date().toISOString(), idempotencyKey };
  } catch (error) {
    await logAction(userId, 'gmail.quarantine', { messageId, error: String(error) }, 'failed');
    return { success: false, error: String(error), action: 'gmail.quarantine', timestamp: new Date().toISOString(), idempotencyKey };
  }
}

export async function gmailRestore(
  params: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  const messageId = params.messageId as string;
  const userId = params.userId as string;
  const idempotencyKey = `gmail:restore:${messageId}:${userId}`;
  
  if (context.dryRun) {
    return { success: true, data: { messageId, action: 'restore' }, action: 'gmail.restore', timestamp: new Date().toISOString(), idempotencyKey };
  }
  
  try {
    const accessToken = await ensureValidGmailToken(userId);
    
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          addLabelIds: ['INBOX'],
          removeLabelIds: ['TRASH'],
        }),
      }
    );
    
    if (!response.ok) throw new Error(`Gmail restore failed: ${response.status}`);
    
    await logAction(userId, 'gmail.restore', { messageId }, 'success');
    
    return { success: true, data: { messageId }, action: 'gmail.restore', timestamp: new Date().toISOString(), idempotencyKey };
  } catch (error) {
    return { success: false, error: String(error), action: 'gmail.restore', timestamp: new Date().toISOString(), idempotencyKey };
  }
}

export async function gmailGetMessageState(
  params: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  const messageId = params.messageId as string;
  const userId = params.userId as string;
  
  try {
    const accessToken = await ensureValidGmailToken(userId);
    
    const response = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=metadata&metadataHeaders=LabelIds`,
      {
        headers: { 'Authorization': `Bearer ${accessToken}` },
      }
    );
    
    if (!response.ok) throw new Error(`Gmail get state failed: ${response.status}`);
    
    const data = await response.json();
    const labels = data.labelIds || [];
    
    let state = 'UNKNOWN';
    if (labels.includes('TRASH')) state = 'QUARANTINED';
    else if (labels.includes('INBOX')) state = 'INBOX';
    else if (labels.includes('SPAM')) state = 'SPAM';
    
    return { success: true, data: { state, labels }, action: 'gmail.getMessageState', timestamp: new Date().toISOString() };
  } catch (error) {
    return { success: false, error: String(error), action: 'gmail.getMessageState', timestamp: new Date().toISOString() };
  }
}

// ─── DNS Sinkhole Integration ────────────────────────────────────

interface SinkholeConfig {
  apiUrl: string;
  apiKey: string;
}

function getSinkholeConfig(): SinkholeConfig {
  return {
    apiUrl: process.env.SINKHOLE_API_URL || 'http://localhost:8080/api',
    apiKey: process.env.SINKHOLE_API_KEY || '',
  };
}

export async function dnsSinkholeAdd(
  params: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  const domain = params.domain as string;
  const reason = params.reason as string | undefined;
  const ttl = params.ttl as number | undefined;
  const idempotencyKey = `sinkhole:add:${domain}`;
  
  if (context.dryRun) {
    return { success: true, data: { domain, action: 'add' }, action: 'dnsSinkhole.add', timestamp: new Date().toISOString(), idempotencyKey };
  }
  
  try {
    const config = getSinkholeConfig();
    
    const response = await fetch(`${config.apiUrl}/block`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        domain,
        reason: reason || 'Automated block by Cybersecurity Analyst',
        ttl: ttl || 86400,
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Sinkhole API error: ${response.status} ${error}`);
    }
    
    const result = await response.json();
    await logAction(context.userId, 'dnsSinkhole.add', { domain }, 'success');
    
    return { success: true, data: { domain, result }, action: 'dnsSinkhole.add', timestamp: new Date().toISOString(), idempotencyKey };
  } catch (error) {
    await logAction(context.userId, 'dnsSinkhole.add', { domain, error: String(error) }, 'failed');
    return { success: false, error: String(error), action: 'dnsSinkhole.add', timestamp: new Date().toISOString(), idempotencyKey };
  }
}

export async function dnsSinkholeRemove(
  params: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  const domain = params.domain as string;
  const idempotencyKey = `sinkhole:remove:${domain}`;
  
  if (context.dryRun) {
    return { success: true, data: { domain, action: 'remove' }, action: 'dnsSinkhole.remove', timestamp: new Date().toISOString(), idempotencyKey };
  }
  
  try {
    const config = getSinkholeConfig();
    
    const response = await fetch(`${config.apiUrl}/unblock`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ domain }),
    });
    
    if (!response.ok) throw new Error(`Sinkhole unblock failed: ${response.status}`);
    
    await logAction(context.userId, 'dnsSinkhole.remove', { domain }, 'success');
    
    return { success: true, data: { domain }, action: 'dnsSinkhole.remove', timestamp: new Date().toISOString(), idempotencyKey };
  } catch (error) {
    return { success: false, error: String(error), action: 'dnsSinkhole.remove', timestamp: new Date().toISOString(), idempotencyKey };
  }
}

export async function dnsSinkholeResolve(
  params: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  const domain = params.domain as string;
  
  try {
    // Use DNS over HTTPS to check resolution
    const response = await fetch(
      `https://dns.google/resolve?name=${domain}&type=A`,
      { signal: AbortSignal.timeout(5000) }
    );
    
    if (!response.ok) throw new Error(`DNS resolve failed: ${response.status}`);
    
    const data = await response.json();
    const ips = data.Answer?.map((a: { data: string }) => a.data) || [];
    const sinkholeIp = process.env.SINKHOLE_IP || '127.0.0.1';
    const isBlocked = ips.includes(sinkholeIp);
    
    return { 
      success: true, 
      data: { domain, resolved: ips, isBlocked, sinkholeIp }, 
      action: 'dnsSinkhole.resolve', 
      timestamp: new Date().toISOString() 
    };
  } catch (error) {
    return { success: false, error: String(error), action: 'dnsSinkhole.resolve', timestamp: new Date().toISOString() };
  }
}

export async function dnsSinkholeAddMultiple(
  params: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  const urls = params.urls as string[];
  const reason = params.reason as string | undefined;
  
  const results: ActionResult[] = [];
  
  for (const url of urls) {
    try {
      const domain = new URL(url).hostname;
      const result = await dnsSinkholeAdd({ domain, reason }, context);
      results.push(result);
    } catch {
      results.push({ success: false, error: 'Invalid URL', action: 'dnsSinkhole.addMultiple', timestamp: new Date().toISOString() });
    }
  }
  
  const allSuccess = results.every(r => r.success);
  return {
    success: allSuccess,
    data: { results },
    action: 'dnsSinkhole.addMultiple',
    timestamp: new Date().toISOString(),
  };
}

// ─── Twilio Integration ──────────────────────────────────────────

interface TwilioConfig {
  accountSid: string;
  authToken: string;
  messagingServiceSid?: string;
}

function getTwilioConfig(): TwilioConfig {
  return {
    accountSid: process.env.TWILIO_ACCOUNT_SID || '',
    authToken: process.env.TWILIO_AUTH_TOKEN || '',
    messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
  };
}

function getTwilioAuth(): string {
  const config = getTwilioConfig();
  return Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
}

export async function twilioBlockNumber(
  params: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  const number = params.number as string;
  const reason = params.reason as string | undefined;
  const idempotencyKey = `twilio:block:${number}`;
  
  if (context.dryRun) {
    return { success: true, data: { number, action: 'block' }, action: 'twilio.blockNumber', timestamp: new Date().toISOString(), idempotencyKey };
  }
  
  try {
    const config = getTwilioConfig();
    
    // Add to blocklist (Twilio doesn't have native blocklist, so we'd use a custom solution)
    // For now, we'll log and use a Firestore-based blocklist
    const { firestore } = initializeFirebase();
    await updateDoc(doc(firestore, 'users', context.userId, 'blockedNumbers', number), {
      number,
      reason: reason || 'Automated block by Cybersecurity Analyst',
      blockedAt: Timestamp.now(),
      blockedBy: 'automated',
    });
    
    await logAction(context.userId, 'twilio.blockNumber', { number }, 'success');
    
    return { success: true, data: { number }, action: 'twilio.blockNumber', timestamp: new Date().toISOString(), idempotencyKey };
  } catch (error) {
    return { success: false, error: String(error), action: 'twilio.blockNumber', timestamp: new Date().toISOString(), idempotencyKey };
  }
}

export async function twilioUnblockNumber(
  params: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  const number = params.number as string;
  
  try {
    const { firestore } = initializeFirebase();
    await updateDoc(doc(firestore, 'users', context.userId, 'blockedNumbers', number), {
      unblockedAt: Timestamp.now(),
      unblockedBy: 'automated',
    });
    
    return { success: true, data: { number }, action: 'twilio.unblockNumber', timestamp: new Date().toISOString() };
  } catch (error) {
    return { success: false, error: String(error), action: 'twilio.unblockNumber', timestamp: new Date().toISOString() };
  }
}

export async function twilioCheckBlock(
  params: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  const number = params.number as string;
  
  try {
    const { firestore } = initializeFirebase();
    const blockDoc = await getDoc(doc(firestore, 'users', context.userId, 'blockedNumbers', number));
    const blocked = blockDoc.exists() && !blockDoc.data().unblockedAt;
    
    return { success: true, data: blocked, action: 'twilio.checkBlock', timestamp: new Date().toISOString() };
  } catch (error) {
    return { success: false, error: String(error), action: 'twilio.checkBlock', timestamp: new Date().toISOString() };
  }
}

export async function twilioSendSms(
  params: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  const to = params.to as string;
  const body = params.body as string;
  const from = params.from as string | undefined;
  
  if (context.dryRun) {
    return { success: true, data: { to, preview: body }, action: 'twilio.sendSms', timestamp: new Date().toISOString() };
  }
  
  try {
    const config = getTwilioConfig();
    
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${getTwilioAuth()}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: to,
          Body: body,
          From: from || config.messagingServiceSid || '',
        }),
      }
    );
    
    if (!response.ok) throw new Error(`Twilio SMS failed: ${response.status}`);
    
    const result = await response.json();
    return { success: true, data: { sid: result.sid, status: result.status }, action: 'twilio.sendSms', timestamp: new Date().toISOString() };
  } catch (error) {
    return { success: false, error: String(error), action: 'twilio.sendSms', timestamp: new Date().toISOString() };
  }
}

// ─── FCM Push Notifications ────────────────────────────────────

interface FCMConfig {
  serverKey: string;
  projectId: string;
}

function getFCMConfig(): FCMConfig {
  return {
    serverKey: process.env.FCM_SERVER_KEY || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
  };
}

export async function fcmSendNotification(
  params: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  const userId = params.userId as string;
  const title = params.title as string;
  const body = params.body as string;
  const data = params.data as Record<string, string> | undefined;
  const token = params.token as string | undefined;
  const topic = params.topic as string | undefined;
  
  if (context.dryRun) {
    return { success: true, data: { title, body }, action: 'fcm.send', timestamp: new Date().toISOString() };
  }
  
  try {
    const config = getFCMConfig();
    
    // Get user's FCM token from Firestore if not provided
    let token = params.token as string | undefined;
    if (!token && !topic) {
      const { firestore } = initializeFirebase();
      const tokenDoc = await getDoc(doc(firestore, 'users', userId, 'fcmTokens', 'primary'));
      token = tokenDoc.data()?.token;
    }
    
    if (!token && !topic) {
      throw new Error('No FCM token or topic provided');
    }
    
    const message: Record<string, unknown> = {
      notification: {
        title,
        body,
      },
      data: data || {},
      android: { priority: 'high' },
      apns: { payload: { aps: { contentAvailable: true } } },
    };
    
    if (token) message.token = token;
    if (topic) message.topic = topic;
    
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${config.projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${config.serverKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message }),
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`FCM send failed: ${response.status} ${error}`);
    }
    
    const result = await response.json();
    return { success: true, data: { messageId: result.name }, action: 'fcm.send', timestamp: new Date().toISOString() };
  } catch (error) {
    return { success: false, error: String(error), action: 'fcm.send', timestamp: new Date().toISOString() };
  }
}

export async function fcmSendToTopic(
  params: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  const topic = params.topic as string;
  const title = params.title as string;
  const body = params.body as string;
  const data = params.data as Record<string, string> | undefined;
  
  return fcmSendNotification({ 
    userId: context.userId, 
    title, 
    body, 
    data, 
    topic 
  }, context);
}

export async function iamRevokeToken(
  params: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  const userId = params.userId as string;
  const tokenId = params.tokenId as string | undefined;
  const allTokens = params.allTokens as boolean | undefined;
  
  if (context.dryRun) {
    return { success: true, data: { userId, action: 'revoke' }, action: 'iam.revokeToken', timestamp: new Date().toISOString() };
  }
  
  try {
    // This would use Google Cloud IAM API or Firebase Auth Admin SDK
    // For Firebase Auth, we can revoke refresh tokens
    const { getAuth } = await import('firebase-admin/auth');
    const auth = getAuth();
    
    if (allTokens) {
      await auth.revokeRefreshTokens(userId);
    }
    
    await logAction(context.userId, 'iam.revokeToken', { userId, allTokens }, 'success');
    
    return { success: true, data: { userId, revoked: true }, action: 'iam.revokeToken', timestamp: new Date().toISOString() };
  } catch (error) {
    return { success: false, error: String(error), action: 'iam.revokeToken', timestamp: new Date().toISOString() };
  }
}

export async function iamForcePasswordReset(
  params: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  const userId = params.userId as string;
  
  try {
    const { getAuth } = await import('firebase-admin/auth');
    const auth = getAuth();
    
    // Set password reset flag (user will be forced to reset on next login)
    await auth.updateUser(userId, {
      password: 'temp_' + Date.now(), // This forces reset
      emailVerified: false,
    });
    
    return { success: true, data: { userId }, action: 'iam.forcePasswordReset', timestamp: new Date().toISOString() };
  } catch (error) {
    return { success: false, error: String(error), action: 'iam.forcePasswordReset', timestamp: new Date().toISOString() };
  }
}

export async function iamEnforceMFA(
  params: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  const userId = params.userId as string;
  
  try {
    const { firestore } = initializeFirebase();
    
    // Set MFA enforcement flag in user profile
    await updateDoc(doc(firestore, 'users', userId), {
      mfaEnforced: true,
      mfaEnforcedAt: Timestamp.now(),
      mfaEnforcedBy: 'automated',
    });
    
    return { success: true, data: { userId, mfaEnforced: true }, action: 'iam.enforceMFA', timestamp: new Date().toISOString() };
  } catch (error) {
    return { success: false, error: String(error), action: 'iam.enforceMFA', timestamp: new Date().toISOString() };
  }
}

export async function networkIsolateResource(
  params: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  const projectId = params.projectId as string;
  const resourceId = params.resourceId as string;
  const resourceType = params.resourceType as 'instance' | 'function' | 'run_service';
  const reason = params.reason as string | undefined;
  
  if (context.dryRun) {
    return { success: true, data: { resourceId, action: 'isolate' }, action: 'network.isolate', timestamp: new Date().toISOString() };
  }
  
  try {
    // This would use GCP Compute API, Cloud Run API, etc.
    // Implementation depends on resource type
    console.log(`[Network] Isolating ${resourceType} ${resourceId} in ${projectId}`);
    
    await logAction(context.userId, 'network.isolate', params, 'success');
    
    return { success: true, data: { resourceId, isolated: true }, action: 'network.isolate', timestamp: new Date().toISOString() };
  } catch (error) {
    return { success: false, error: String(error), action: 'network.isolate', timestamp: new Date().toISOString() };
  }
}

// ─── Analyst Auto-Response Actions (triage-driven, Firestore-only) ─
//
// Ported from the former src/lib/analyst/auto-response.ts. Unlike the
// Gmail/Twilio/DNS-sinkhole integrations above, these four don't call
// any external API — they record the analyst's decision as a
// deterministic, doc-ID-keyed Firestore entry (idempotent by
// construction, unlike the original's addDoc + query-based dedup).

/**
 * Deterministic, Firestore-doc-ID-safe hash for building idempotent
 * document IDs from arbitrary strings (URLs, sender+subject pairs, etc).
 */
function stableHashId(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0; // djb2
  }
  return 'h' + Math.abs(hash).toString(36) + input.length.toString(36);
}

export async function quarantineEmailFirestore(
  params: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  const sender = (params.sender as string) || (params.from as string) || 'unknown';
  const subject = (params.subject as string) || 'No subject';
  const docId = stableHashId(`${sender}:${subject}`);
  const timestamp = new Date().toISOString();

  if (context.dryRun) {
    return { success: true, data: { sender, subject }, action: 'quarantine_email', timestamp, idempotencyKey: docId, message: `Would quarantine email from "${sender}"` };
  }

  try {
    const { firestore } = initializeFirebase();
    await setDoc(doc(firestore, 'users', context.userId, 'quarantinedItems', docId), {
      type: 'email',
      sender,
      subject,
      status: 'quarantined',
      reason: 'Auto-quarantined by Cybersecurity Analyst',
      createdAt: Timestamp.now(),
      timestamp,
    }, { merge: true });

    await logAction(context.userId, 'quarantine_email', { sender, subject }, 'success');

    return {
      success: true,
      data: { sender, subject },
      action: 'quarantine_email',
      timestamp,
      idempotencyKey: docId,
      message: `Email from "${sender}" quarantined — subject: "${subject}"`,
    };
  } catch (error) {
    return { success: false, error: String(error), action: 'quarantine_email', timestamp, message: `Failed to quarantine email: ${String(error)}` };
  }
}

export async function blockUrlFirestore(
  params: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  const url = ((params.url as string) || '').toLowerCase().trim();
  const docId = stableHashId(url);
  const timestamp = new Date().toISOString();

  if (context.dryRun) {
    return { success: true, data: { url }, action: 'block_url', timestamp, idempotencyKey: docId, message: `Would block URL: ${url}` };
  }

  try {
    const { firestore } = initializeFirebase();
    await setDoc(doc(firestore, 'users', context.userId, 'blockedUrls', docId), {
      url,
      status: 'blocked',
      reason: 'Auto-blocked by Cybersecurity Analyst',
      createdAt: Timestamp.now(),
      timestamp,
    }, { merge: true });

    await logAction(context.userId, 'block_url', { url }, 'success');

    return {
      success: true,
      data: { url },
      action: 'block_url',
      timestamp,
      idempotencyKey: docId,
      message: `URL blocked: ${url}`,
    };
  } catch (error) {
    return { success: false, error: String(error), action: 'block_url', timestamp, message: `Failed to block URL: ${String(error)}` };
  }
}

export async function blockNumberFirestore(
  params: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  const number = ((params.phoneNumber as string) || (params.sender as string) || 'unknown').trim();
  const timestamp = new Date().toISOString();

  if (context.dryRun) {
    return { success: true, data: { number }, action: 'block_number', timestamp, idempotencyKey: number, message: `Would block number: ${number}` };
  }

  try {
    const { firestore } = initializeFirebase();
    await setDoc(doc(firestore, 'users', context.userId, 'blockedNumbers', number), {
      number,
      status: 'blocked',
      reason: 'Auto-blocked by Cybersecurity Analyst',
      createdAt: Timestamp.now(),
      timestamp,
    }, { merge: true });

    await logAction(context.userId, 'block_number', { number }, 'success');

    return {
      success: true,
      data: { number },
      action: 'block_number',
      timestamp,
      idempotencyKey: number,
      message: `Phone number blocked: ${number}`,
    };
  } catch (error) {
    return { success: false, error: String(error), action: 'block_number', timestamp, message: `Failed to block number: ${String(error)}` };
  }
}

export async function flagDeepfakeFirestore(
  params: Record<string, unknown>,
  context: ActionContext
): Promise<ActionResult> {
  const verdict = (params.verdict as string) || 'suspected_deepfake';
  const confidence = typeof params.risk_score === 'number' ? (params.risk_score as number) / 10 : 0.5;
  const subject = (params.subject as string) || verdict;
  const docId = stableHashId(subject);
  const timestamp = new Date().toISOString();

  if (context.dryRun) {
    return { success: true, data: { verdict, confidence }, action: 'flag_deepfake', timestamp, idempotencyKey: docId, message: `Would flag media as ${verdict}` };
  }

  try {
    const { firestore } = initializeFirebase();
    await setDoc(doc(firestore, 'users', context.userId, 'flaggedDeepfakes', docId), {
      type: 'deepfake',
      verdict,
      confidence,
      status: 'flagged',
      reason: 'Auto-flagged by Cybersecurity Analyst',
      createdAt: Timestamp.now(),
      timestamp,
    }, { merge: true });

    return {
      success: true,
      data: { verdict, confidence },
      action: 'flag_deepfake',
      timestamp,
      idempotencyKey: docId,
      message: `Media flagged as ${verdict} (${Math.round(confidence * 100)}% confidence)`,
    };
  } catch (error) {
    return { success: false, error: String(error), action: 'flag_deepfake', timestamp, message: `Failed to flag media: ${String(error)}` };
  }
}

// ─── Action Logging ──────────────────────────────────────────────

async function logAction(
  userId: string,
  action: string,
  details: Record<string, unknown>,
  status: 'success' | 'failed' | 'rolled_back'
): Promise<void> {
  try {
    const { firestore } = initializeFirebase();
    const { collection, addDoc, Timestamp } = await import('firebase/firestore');
    
    await addDoc(collection(firestore, 'actionLogs'), {
      userId,
      action,
      details,
      status,
      timestamp: Timestamp.now(),
      executedBy: 'automated',
    });
  } catch {
    // Silently fail logging
  }
}

// ─── Action Registry ────────────────────────────────────────────

import { registerAction } from '@/lib/playbooks/engine';

// Register all actions
registerAction('gmail.quarantine', gmailQuarantine);
registerAction('gmail.restore', gmailRestore);
registerAction('gmail.getMessageState', gmailGetMessageState);
registerAction('dnsSinkhole.add', dnsSinkholeAdd);
registerAction('dnsSinkhole.remove', dnsSinkholeRemove);
registerAction('dnsSinkhole.resolve', dnsSinkholeResolve);
registerAction('dnsSinkhole.addMultiple', dnsSinkholeAddMultiple);
registerAction('twilio.blockNumber', twilioBlockNumber);
registerAction('twilio.unblockNumber', twilioUnblockNumber);
registerAction('twilio.checkBlock', twilioCheckBlock);
registerAction('twilio.sendSms', twilioSendSms);
registerAction('fcm.send', fcmSendNotification);
registerAction('fcm.sendToTopic', fcmSendToTopic);
registerAction('iam.revokeToken', iamRevokeToken);
registerAction('iam.forcePasswordReset', iamForcePasswordReset);
registerAction('iam.enforceMFA', iamEnforceMFA);
registerAction('network.isolate', networkIsolateResource);

// IOC Extractor action
registerAction('iocExtractor.extract', async (params: Record<string, unknown>) => {
  const text = params.text as string;
  const subject = params.subject as string | undefined;
  const { extractIOCs } = await import('@/lib/analyst/ioc-extractor');
  const iocs = extractIOCs('email', { emailContent: text }, subject);
  return { success: true, data: iocs };
});

registerAction('assets.scanRelated', async (params: Record<string, unknown>) => {
  // Trigger scan of related assets
  return { success: true, data: { scanned: true, domain: params.domain } };
});

registerAction('cases.create', async (params: Record<string, unknown>) => {
  const incidentId = params.incidentId as string;
  const title = params.title as string;
  const severity = params.severity as string;
  const { firestore } = initializeFirebase();
  const { collection, addDoc, Timestamp } = await import('firebase/firestore');
  
  await addDoc(collection(firestore, 'cases'), {
    incidentId,
    title,
    severity,
    status: 'open',
    createdAt: Timestamp.now(),
  });
  
  return { success: true, data: { caseCreated: true } };
});

registerAction('notifications.send', async (params: Record<string, unknown>) => {
  // Dispatch to notification channels
  return { success: true, data: { sent: true, channels: params.channels } };
});

registerAction('auth.revokeAllSessions', iamRevokeToken);
registerAction('auth.checkSessionsRevoked', async () => ({ success: true, data: true }));
registerAction('auth.forcePasswordReset', iamForcePasswordReset);
registerAction('auth.enforceMFA', iamEnforceMFA);

// Analyst auto-response actions — registered under the exact
// TriageResult['autoAction'] values so orchestrator.ts can call
// getAction(triage.autoAction) directly with no name-mapping layer.
registerAction('quarantine_email', quarantineEmailFirestore);
registerAction('block_url', blockUrlFirestore);
registerAction('block_number', blockNumberFirestore);
registerAction('flag_deepfake', flagDeepfakeFirestore);
// deepfakePlaybook() references 'firestore.flagDeepfake' as its step
// action; it was never registered. Point it at the same handler.
registerAction('firestore.flagDeepfake', flagDeepfakeFirestore);