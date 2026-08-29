/**
 * Notification Channels for Da-Costa Svalinn
 * 
 * Multi-channel alerting: SendGrid Email, Slack, Twilio SMS, FCM Push.
 * Template-based with user preferences.
 */

import { initializeFirebase } from '@/firebase';
import { collection, doc, getDoc, getDocs, query, where, addDoc, Timestamp } from 'firebase/firestore';

// ─── Types ─────────────────────────────────────────────────────────

export interface NotificationChannel {
  id: string;
  type: 'email' | 'slack' | 'sms' | 'push';
  name: string;
  config: Record<string, unknown>;
  enabled: boolean;
  priority: number; // 1-10
}

export interface UserNotificationPrefs {
  userId: string;
  channels: {
    email: { enabled: boolean; severityThreshold: 'low' | 'medium' | 'high' | 'critical'; address?: string };
    slack: { enabled: boolean; severityThreshold: 'low' | 'medium' | 'high' | 'critical'; webhookUrl?: string; channel?: string };
    sms: { enabled: boolean; severityThreshold: 'low' | 'medium' | 'high' | 'critical'; number?: string };
    push: { enabled: boolean; severityThreshold: 'low' | 'medium' | 'high' | 'critical' };
  };
  quietHours?: { start: string; end: string; timezone: string };
  digestEnabled: boolean;
  digestFrequency: 'realtime' | 'hourly' | 'daily';
  updatedAt: string;
}

export interface NotificationTemplate {
  id: string;
  name: string;
  description: string;
  channels: ('email' | 'slack' | 'sms' | 'push')[];
  subject?: string; // for email
  body: string; // template with {{variables}}
  variables: string[]; // required variables
}

export interface NotificationDispatch {
  userId: string;
  templateId: string;
  channels: ('email' | 'slack' | 'sms' | 'push')[];
  data: Record<string, unknown>;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  scheduledFor?: string;
  idempotencyKey?: string;
}

export interface NotificationLog {
  id?: string;
  userId: string;
  templateId: string;
  channel: 'email' | 'slack' | 'sms' | 'push';
  status: 'sent' | 'failed' | 'pending' | 'skipped';
  sentAt?: string;
  error?: string;
  data: Record<string, unknown>;
  dispatchedAt: string;
}

// ─── Default Templates ────────────────────────────────────────────

export const DEFAULT_TEMPLATES: NotificationTemplate[] = [
  {
    id: 'phishing_contained',
    name: 'Phishing Email Contained',
    description: 'Sent when a phishing email is automatically quarantined',
    channels: ['email', 'slack', 'push'],
    subject: '🛡️ Phishing Email Quarantined: {{subject}}',
    body: `**Phishing Email Contained**

**Incident:** {{incidentId}}
**Sender:** {{sender}}
**Subject:** {{subject}}
**Action Taken:** Email quarantined, sender domain blocked

The Cybersecurity Analyst detected and automatically contained a phishing attempt targeting your account. No action is required on your part.

[View Incident Details]({{dashboardUrl}}/dashboard/analyst?incident={{incidentId}})`,
    variables: ['incidentId', 'sender', 'subject', 'dashboardUrl'],
  },
  {
    id: 'smishing_blocked',
    name: 'Smishing SMS Blocked',
    description: 'Sent when a smishing SMS is blocked',
    channels: ['email', 'slack', 'push', 'sms'],
    subject: '📱 Smishing Attempt Blocked',
    body: `**Smishing Attempt Blocked**

**Incident:** {{incidentId}}
**Sender:** {{senderNumber}}
**Message Preview:** {{messagePreview}}

A malicious SMS was detected and blocked. The sender number has been added to your blocklist.

[View Incident Details]({{dashboardUrl}}/dashboard/analyst?incident={{incidentId}})`,
    variables: ['incidentId', 'senderNumber', 'messagePreview', 'dashboardUrl'],
  },
  {
    id: 'deepfake_alert',
    name: 'Deepfake Media Detected',
    description: 'Sent when deepfake audio/video is flagged',
    channels: ['email', 'slack', 'push'],
    subject: '🎭 Deepfake Detected: {{type}}',
    body: `**Deepfake Media Flagged**

**Incident:** {{incidentId}}
**Type:** {{type}}
**Confidence:** {{confidence}}%

The Cybersecurity Analyst has flagged a piece of media as a likely deepfake. Please review carefully before taking any action based on this content.

[View Incident Details]({{dashboardUrl}}/dashboard/analyst?incident={{incidentId}})`,
    variables: ['incidentId', 'type', 'confidence', 'dashboardUrl'],
  },
  {
    id: 'credential_theft_critical',
    name: 'Critical: Credential Theft Detected',
    description: 'High-priority alert for credential theft/account takeover',
    channels: ['email', 'slack', 'push', 'sms'],
    subject: '🚨 CRITICAL: Credential Theft Detected - Immediate Action Required',
    body: `**CRITICAL SECURITY ALERT**

**Incident:** {{incidentId}}
**User:** {{userId}}
**Threat:** Credential theft / Account takeover attempt

**Immediate Actions Taken:**
- All sessions revoked
- Password reset forced
- MFA enforcement enabled

**Required Actions:**
1. Check account for unauthorized activity
2. Review recent login history
3. Update recovery options

[View Incident Details]({{dashboardUrl}}/dashboard/analyst?incident={{incidentId}})

**This is an automated high-priority alert. Do not ignore.**`,
    variables: ['incidentId', 'userId', 'dashboardUrl'],
  },
  {
    id: 'sla_warning',
    name: 'SLA Warning',
    description: 'Sent when a case is approaching SLA deadline',
    channels: ['email', 'slack', 'push'],
    subject: '⏰ SLA Warning: {{title}}',
    body: `**SLA Deadline Approaching**

**Case:** {{caseId}}
**Title:** {{title}}
**Severity:** {{severity}}
**Due:** {{dueAt}}
**Time Remaining:** {{timeRemaining}}

This case is approaching its SLA deadline. Please prioritize resolution.

[View Case]({{dashboardUrl}}/dashboard/cases?case={{caseId}})`,
    variables: ['caseId', 'title', 'severity', 'dueAt', 'timeRemaining', 'dashboardUrl'],
  },
  {
    id: 'sla_breached',
    name: 'SLA Breached',
    description: 'Sent when a case breaches its SLA',
    channels: ['email', 'slack', 'push'],
    subject: '🚨 SLA BREACHED: {{title}}',
    body: `**SLA BREACHED**

**Case:** {{caseId}}
**Title:** {{title}}
**Severity:** {{severity}}
**Was Due:** {{dueAt}}
**Overdue By:** {{overdueBy}}

This case has breached its SLA deadline. Immediate escalation recommended.

[View Case]({{dashboardUrl}}/dashboard/cases?case={{caseId}})`,
    variables: ['caseId', 'title', 'severity', 'dueAt', 'overdueBy', 'dashboardUrl'],
  },
  {
    id: 'new_critical_incident',
    name: 'New Critical Incident',
    description: 'Real-time alert for new critical/high incidents',
    channels: ['push', 'slack'],
    body: `🚨 **{{threatLevel}} Incident**: {{title}}

Risk: {{riskScore}}/10 | Modules: {{modules}}

[View]({{dashboardUrl}}/dashboard/analyst?incident={{incidentId}})`,
    variables: ['threatLevel', 'title', 'riskScore', 'modules', 'incidentId', 'dashboardUrl'],
  },
  {
    id: 'playbook_executed',
    name: 'Playbook Executed',
    description: 'Notification when a response playbook completes',
    channels: ['email', 'slack'],
    subject: '✅ Playbook Executed: {{playbookName}}',
    body: `**Playbook Execution Complete**

**Playbook:** {{playbookName}}
**Incident:** {{incidentId}}
**Result:** {{result}}
**Steps Completed:** {{stepsCompleted}}/{{totalSteps}}
**Duration:** {{duration}}s

[View Execution]({{dashboardUrl}}/dashboard/cases?execution={{executionId}})`,
    variables: ['playbookName', 'incidentId', 'result', 'stepsCompleted', 'totalSteps', 'duration', 'executionId', 'dashboardUrl'],
  },
];

// ─── Notification Dispatcher ────────────────────────────────────

const SEVERITY_ORDER = { low: 1, medium: 2, high: 3, critical: 4 };

function shouldNotify(prefs: UserNotificationPrefs, channel: keyof UserNotificationPrefs['channels'], severity: 'low' | 'medium' | 'high' | 'critical'): boolean {
  const channelPref = prefs.channels[channel];
  if (!channelPref?.enabled) return false;
  return SEVERITY_ORDER[severity] >= SEVERITY_ORDER[channelPref.severityThreshold];
}

function isInQuietHours(prefs: UserNotificationPrefs): boolean {
  if (!prefs.quietHours) return false;
  
  const now = new Date();
  const userTime = new Date(now.toLocaleString('en-US', { timeZone: prefs.quietHours.timezone }));
  const currentHour = userTime.getHours();
  const currentMinute = userTime.getMinutes();
  const currentTime = currentHour * 60 + currentMinute;
  
  const [startHour, startMinute] = prefs.quietHours.start.split(':').map(Number);
  const [endHour, endMinute] = prefs.quietHours.end.split(':').map(Number);
  const startTime = startHour * 60 + startMinute;
  const endTime = endHour * 60 + endMinute;
  
  if (startTime <= endTime) {
    return currentTime >= startTime && currentTime < endTime;
  } else {
    // Overnight quiet hours (e.g., 22:00 - 07:00)
    return currentTime >= startTime || currentTime < endTime;
  }
}

/**
 * Render a template with data.
 */
function renderTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
    const parts = path.split('.');
    let obj: unknown = data;
    for (const part of parts) {
      if (obj && typeof obj === 'object' && part in obj) {
        obj = (obj as Record<string, unknown>)[part];
      } else {
        return match;
      }
    }
    return String(obj);
  });
}

/**
 * Dispatch a notification to all applicable channels.
 */
export async function dispatchNotification(dispatch: NotificationDispatch): Promise<{ sent: number; failed: number; logs: NotificationLog[] }> {
  const { firestore } = initializeFirebase();
  const logs: NotificationLog[] = [];
  let sent = 0;
  let failed = 0;
  
  try {
    // Get template
    const templateDoc = await getDoc(doc(firestore, 'notificationTemplates', dispatch.templateId));
    if (!templateDoc.exists()) {
      throw new Error(`Template not found: ${dispatch.templateId}`);
    }
    const template = templateDoc.data() as NotificationTemplate;
    
    // Get user preferences
    const prefsDoc = await getDoc(doc(firestore, 'notificationPrefs', dispatch.userId));
    const prefs = prefsDoc.exists() ? prefsDoc.data() as UserNotificationPrefs : getDefaultPrefs(dispatch.userId);
    
    // Check quiet hours (skip non-urgent)
    if (dispatch.priority !== 'urgent' && isInQuietHours(prefs)) {
      console.log(`[Notifications] Skipping - quiet hours for user ${dispatch.userId}`);
      return { sent: 0, failed: 0, logs: [] };
    }
    
    // Check idempotency
    if (dispatch.idempotencyKey) {
      const existingLog = await getDocs(query(
        collection(firestore, 'notificationLogs'),
        where('idempotencyKey', '==', dispatch.idempotencyKey),
        limit(1)
      ));
      if (!existingLog.empty) {
        console.log(`[Notifications] Duplicate dispatch skipped: ${dispatch.idempotencyKey}`);
        return { sent: 0, failed: 0, logs: [] };
      }
    }
    
    // Render template
    const renderedSubject = template.subject ? renderTemplate(template.subject, dispatch.data) : '';
    const renderedBody = renderTemplate(template.body, dispatch.data);
    
    // Determine which channels to use
    const targetChannels = dispatch.channels.filter(c => 
      template.channels.includes(c) && shouldNotify(prefs, c, (dispatch.data.severity as any) || 'medium')
    );
    
    // Send to each channel
    for (const channel of targetChannels) {
      const log: NotificationLog = {
        userId: dispatch.userId,
        templateId: dispatch.templateId,
        channel,
        status: 'pending',
        data: dispatch.data,
        dispatchedAt: new Date().toISOString(),
        idempotencyKey: dispatch.idempotencyKey,
      };
      
      try {
        let result: { success: boolean; error?: string };
        
        switch (channel) {
          case 'email':
            result = await sendEmailNotification(prefs, renderedSubject, renderedBody);
            break;
          case 'slack':
            result = await sendSlackNotification(prefs, renderedBody);
            break;
          case 'sms':
            result = await sendSmsNotification(prefs, renderedBody);
            break;
          case 'push':
            result = await sendPushNotification(dispatch.userId, template.subject ? renderedSubject : 'Alert', renderedBody);
            break;
          default:
            result = { success: false, error: `Unknown channel: ${channel}` };
        }
        
        if (result.success) {
          log.status = 'sent';
          log.sentAt = new Date().toISOString();
          sent++;
        } else {
          log.status = 'failed';
          log.error = result.error;
          failed++;
        }
        
      } catch (error) {
        log.status = 'failed';
        log.error = String(error);
        failed++;
      }
      
      logs.push(log);
    }
    
    // Store logs
    if (logs.length > 0) {
      const batch = writeBatch(firestore);
      for (const log of logs) {
        batch.set(doc(collection(firestore, 'notificationLogs')), log);
      }
      await batch.commit();
    }
    
  } catch (error) {
    console.error('[Notifications] Dispatch error:', error);
    failed++;
  }
  
  return { sent, failed, logs };
}

function getDefaultPrefs(userId: string): UserNotificationPrefs {
  return {
    userId,
    channels: {
      email: { enabled: true, severityThreshold: 'medium' },
      slack: { enabled: false, severityThreshold: 'high' },
      sms: { enabled: false, severityThreshold: 'critical' },
      push: { enabled: true, severityThreshold: 'high' },
    },
    digestEnabled: false,
    digestFrequency: 'realtime',
    updatedAt: new Date().toISOString(),
  };
}

// ─── Channel Implementations ────────────────────────────────────

async function sendEmailNotification(
  prefs: UserNotificationPrefs,
  subject: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) return { success: false, error: 'SendGrid API key not configured' };
    
    const email = prefs.channels.email.address || prefs.userId; // fallback
    
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email }],
          subject,
        }],
        from: { email: 'security@dacosta-svalinn.com', name: 'Da-Costa Svalinn' },
        content: [
          { type: 'text/plain', value: body },
          { type: 'text/html', value: markdownToHtml(body) },
        ],
      }),
    });
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SendGrid error: ${response.status} ${error}`);
    }
    
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

function markdownToHtml(markdown: string): string {
  // Simple markdown to HTML conversion
  return markdown
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/\n/g, '<br>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>');
}

async function sendSlackNotification(
  prefs: UserNotificationPrefs,
  body: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const webhookUrl = prefs.channels.slack.webhookUrl || process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) return { success: false, error: 'Slack webhook URL not configured' };
    
    const channel = prefs.channels.slack.channel || '#security-alerts';
    
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        channel,
        username: 'Da-Costa Svalinn',
        icon_emoji: ':shield:',
        text: body,
        mrkdwn: true,
      }),
    });
    
    if (!response.ok) throw new Error(`Slack error: ${response.status}`);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function sendSmsNotification(
  prefs: UserNotificationPrefs,
  body: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const config = {
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      authToken: process.env.TWILIO_AUTH_TOKEN,
      from: process.env.TWILIO_MESSAGING_SERVICE_SID,
    };
    
    if (!config.accountSid || !config.authToken) {
      return { success: false, error: 'Twilio not configured' };
    }
    
    const to = prefs.channels.sms.number;
    if (!to) return { success: false, error: 'No SMS number configured' };
    
    // Truncate for SMS (160 chars)
    const truncated = body.length > 150 ? body.substring(0, 150) + '...' : body;
    
    const auth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64');
    
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${auth}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          To: to,
          Body: truncated,
          From: config.from || '',
        }),
      }
    );
    
    if (!response.ok) throw new Error(`Twilio error: ${response.status}`);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

async function sendPushNotification(
  userId: string,
  title: string,
  body: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { firestore } = initializeFirebase();
    const tokenDoc = await getDoc(doc(firestore, 'users', userId, 'fcmTokens', 'primary'));
    const token = tokenDoc.data()?.token;
    
    if (!token) return { success: false, error: 'No FCM token' };
    
    const serverKey = process.env.FCM_SERVER_KEY;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    
    if (!serverKey || !projectId) return { success: false, error: 'FCM not configured' };
    
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serverKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body },
            android: { priority: 'high' },
            apns: { payload: { aps: { alert: { title, body }, sound: 'default' } } },
          },
        }),
      }
    );
    
    if (!response.ok) throw new Error(`FCM error: ${response.status}`);
    
    return { success: true };
  } catch (error) {
    return { success: false, error: String(error) };
  }
}

/**
 * Batch dispatch for digest notifications.
 */
export async function dispatchDigestNotifications(): Promise<void> {
  // Implementation for hourly/daily digests
  console.log('[Notifications] Running digest dispatch...');
}

/**
 * Initialize default templates.
 */
export async function seedNotificationTemplates(): Promise<void> {
  const { firestore } = initializeFirebase();
  
  for (const template of DEFAULT_TEMPLATES) {
    const existing = await getDoc(doc(firestore, 'notificationTemplates', template.id));
    if (!existing.exists()) {
      await addDoc(collection(firestore, 'notificationTemplates'), {
        ...template,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
      });
      console.log(`[Notifications] Seeded template: ${template.id}`);
    }
  }
}