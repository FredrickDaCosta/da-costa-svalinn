/**
 * Playbook Engine for Da-Costa Svalinn
 * 
 * Executes declarative, versioned response playbooks stored in Firestore.
 * Playbooks define automated response actions with verification and rollback.
 */

import { initializeFirebase } from '@/firebase';
import { collection, doc, getDoc, getDocs, query, where, orderBy, limit, addDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';
import * as yaml from 'js-yaml';

// ─── Types ─────────────────────────────────────────────────────────

export interface Playbook {
  id: string;
  name: string;
  version: number;
  description?: string;
  trigger: PlaybookTrigger;
  steps: PlaybookStep[];
  rollback?: PlaybookStep[];
  metadata: {
    author: string;
    createdAt: string;
    updatedAt: string;
    tags: string[];
    successRate?: number;
    executionCount?: number;
  };
}

export interface PlaybookTrigger {
  incidentType?: string;
  minSeverity?: 'low' | 'medium' | 'high' | 'critical';
  modules?: string[];
  conditions?: PlaybookCondition[];
}

export interface PlaybookCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'contains' | 'gt' | 'lt' | 'gte' | 'lte' | 'in' | 'not_in';
  value: unknown;
}

export interface PlaybookStep {
  id: string;
  action: string;
  name?: string;
  description?: string;
  params: Record<string, unknown>;
  verify?: PlaybookVerification;
  onFailure: 'continue' | 'stop' | 'rollback';
  timeoutMs?: number;
  retryCount?: number;
}

export interface PlaybookVerification {
  action: string;
  params: Record<string, unknown>;
  expected: unknown;
  operator: 'equals' | 'contains' | 'exists' | 'not_equals';
}

export interface PlaybookExecution {
  id: string;
  playbookId: string;
  playbookVersion: number;
  incidentId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'rolled_back';
  currentStep: number;
  steps: PlaybookStepExecution[];
  startedAt: string;
  completedAt?: string;
  error?: string;
  context: Record<string, unknown>;
}

export interface PlaybookStepExecution {
  stepId: string;
  action: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  params: Record<string, unknown>;
  result?: unknown;
  verification?: {
    passed: boolean;
    expected: unknown;
    actual: unknown;
  };
  startedAt: string;
  completedAt?: string;
  error?: string;
  retryCount: number;
}

export interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ActionContext {
  userId: string;
  incidentId?: string;
  executionId?: string;
  dryRun?: boolean;
}

// ─── Built-in Actions ────────────────────────────────────────────

type ActionHandler = (params: Record<string, unknown>, context: ActionContext) => Promise<ActionResult>;

const actionRegistry = new Map<string, ActionHandler>();

/**
 * Register a built-in action handler.
 */
export function registerAction(name: string, handler: ActionHandler): void {
  actionRegistry.set(name, handler);
}

/**
 * Get an action handler by name.
 */
export function getAction(name: string): ActionHandler | undefined {
  return actionRegistry.get(name);
}

/**
 * Execute a playbook step.
 */
async function executeStep(
  step: PlaybookStep,
  context: ActionContext
): Promise<{ result: ActionResult; verification?: { passed: boolean; expected: unknown; actual: unknown } }> {
  const handler = actionRegistry.get(step.action);
  
  if (!handler) {
    return {
      result: { success: false, error: `Unknown action: ${step.action}` },
    };
  }

  // Interpolate parameters with context
  const interpolatedParams = interpolateParams(step.params, context as unknown as Record<string, unknown>);
  
  let result: ActionResult = { success: false, error: 'Not executed' };
  let lastError: string | undefined;
  
  // Retry logic
  const maxRetries = step.retryCount ?? 3;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      result = await handler(interpolatedParams, context);
      if (result.success) break;
      lastError = result.error;
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';
    }
    
    if (attempt < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1))); // Exponential backoff
    }
  }

  if (!result?.success) {
    result = { success: false, error: lastError };
  }

  // Verification
  let verification;
  if (result.success && step.verify) {
    const verifyHandler = actionRegistry.get(step.verify.action);
    if (verifyHandler) {
      const verifyParams = interpolateParams(step.verify.params, { 
    ...(context as unknown as Record<string, unknown>), 
    ...(result.data as Record<string, unknown> || {}) 
  });
      const verifyResult = await verifyHandler(verifyParams, context);
      
      let passed = false;
      switch (step.verify.operator) {
        case 'equals':
          passed = JSON.stringify(verifyResult.data) === JSON.stringify(step.verify.expected);
          break;
        case 'contains':
          passed = JSON.stringify(verifyResult.data).includes(JSON.stringify(step.verify.expected));
          break;
        case 'exists':
          passed = verifyResult.data !== null && verifyResult.data !== undefined;
          break;
        case 'not_equals':
          passed = JSON.stringify(verifyResult.data) !== JSON.stringify(step.verify.expected);
          break;
      }
      
      verification = {
        passed,
        expected: step.verify.expected,
        actual: verifyResult.data,
      };
      
      if (!passed) {
        result = { success: false, error: `Verification failed: expected ${step.verify.operator} ${JSON.stringify(step.verify.expected)}, got ${JSON.stringify(verifyResult.data)}` };
      }
    }
  }

  return { result: result!, verification };
}

/**
 * Interpolate template parameters with context values.
 * Supports {{variable}} and {{object.property}} syntax.
 */
function interpolateParams(params: Record<string, unknown>, context: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      result[key] = value.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
        const parts = path.split('.');
        let obj: unknown = context;
        for (const part of parts) {
          if (obj && typeof obj === 'object' && part in obj) {
            obj = (obj as Record<string, unknown>)[part];
          } else {
            return match; // Keep original if not found
          }
        }
        return String(obj);
      });
    } else if (typeof value === 'object' && value !== null) {
      result[key] = interpolateParams(value as Record<string, unknown>, context);
    } else {
      result[key] = value;
    }
  }
  
  return result;
}

// ─── Playbook CRUD ──────────────────────────────────────────────

const PLAYBOOKS_COLLECTION = 'playbooks';

/**
 * Save a playbook to Firestore.
 */
export async function savePlaybook(playbook: Omit<Playbook, 'id'> & { id?: string }): Promise<string> {
  const { firestore } = initializeFirebase();
  const now = new Date().toISOString();
  
  const playbookData = {
    ...playbook,
    metadata: {
      ...playbook.metadata,
      updatedAt: now,
      executionCount: playbook.metadata.executionCount || 0,
    },
  };
  
  if (playbook.id) {
    await updateDoc(doc(firestore, PLAYBOOKS_COLLECTION, playbook.id), playbookData);
    return playbook.id;
  } else {
    const ref = await addDoc(collection(firestore, PLAYBOOKS_COLLECTION), {
      ...playbookData,
      metadata: {
        ...playbookData.metadata,
        createdAt: now,
      },
    });
    return ref.id;
  }
}

/**
 * Get a playbook by ID.
 */
export async function getPlaybook(playbookId: string): Promise<Playbook | null> {
  const { firestore } = initializeFirebase();
  const snap = await getDoc(doc(firestore, PLAYBOOKS_COLLECTION, playbookId));
  
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Playbook;
}

/**
 * List playbooks with optional filters.
 */
export async function listPlaybooks(options: { 
  tag?: string; 
  limit?: number;
} = {}): Promise<Playbook[]> {
  const { firestore } = initializeFirebase();
  
  let q = query(
    collection(firestore, PLAYBOOKS_COLLECTION),
    orderBy('metadata.updatedAt', 'desc'),
    limit(options.limit || 50)
  );
  
  if (options.tag) {
    q = query(q, where('metadata.tags', 'array-contains', options.tag));
  }
  
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Playbook));
}

/**
 * Parse a YAML playbook definition.
 */
export function parsePlaybookYAML(yamlString: string): Omit<Playbook, 'id'> {
  const parsed = yaml.load(yamlString) as Playbook;
  
  // Validate required fields
  if (!parsed.name) throw new Error('Playbook must have a name');
  if (!parsed.trigger) throw new Error('Playbook must have a trigger');
  if (!parsed.steps || !Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    throw new Error('Playbook must have at least one step');
  }
  if (!parsed.version) parsed.version = 1;
  if (!parsed.metadata) parsed.metadata = { author: 'system', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), tags: [] };
  
  return parsed;
}

/**
 * Match playbooks against an incident.
 */
export async function matchPlaybooks(incident: {
  id: string;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  modules: string[];
  title: string;
}): Promise<Playbook[]> {
  const allPlaybooks = await listPlaybooks();
  const matched: Playbook[] = [];
  
  for (const playbook of allPlaybooks) {
    if (evaluateTrigger(playbook.trigger, incident)) {
      matched.push(playbook);
    }
  }
  
  // Sort by specificity (more conditions = more specific)
  matched.sort((a, b) => {
    const aCond = a.trigger.conditions?.length || 0;
    const bCond = b.trigger.conditions?.length || 0;
    return bCond - aCond;
  });
  
  return matched;
}

function evaluateTrigger(trigger: PlaybookTrigger, incident: { threatLevel: string; modules: string[] }): boolean {
  // Check severity
  if (trigger.minSeverity) {
    const severityOrder: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };
    if (severityOrder[incident.threatLevel] < severityOrder[trigger.minSeverity]) {
      return false;
    }
  }
  
  // Check modules
  if (trigger.modules && trigger.modules.length > 0) {
    const hasModule = trigger.modules.some(m => incident.modules.includes(m));
    if (!hasModule) return false;
  }
  
  // Check conditions
  if (trigger.conditions && trigger.conditions.length > 0) {
    for (const condition of trigger.conditions) {
      if (!evaluateCondition(condition, incident)) {
        return false;
      }
    }
  }
  
  return true;
}

function evaluateCondition(condition: PlaybookCondition, incident: Record<string, unknown>): boolean {
  const value = getNestedValue(incident, condition.field);
  
  switch (condition.operator) {
    case 'equals':
      return value === condition.value;
    case 'not_equals':
      return value !== condition.value;
    case 'contains':
      return String(value).includes(String(condition.value));
    case 'gt':
      return Number(value) > Number(condition.value);
    case 'lt':
      return Number(value) < Number(condition.value);
    case 'gte':
      return Number(value) >= Number(condition.value);
    case 'lte':
      return Number(value) <= Number(condition.value);
    case 'in':
      return Array.isArray(condition.value) && condition.value.includes(value);
    case 'not_in':
      return Array.isArray(condition.value) && !condition.value.includes(value);
    default:
      return false;
  }
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  
  return current;
}

// ─── Playbook Execution ──────────────────────────────────────────

const EXECUTIONS_COLLECTION = 'playbookExecutions';

/**
 * Execute a playbook for an incident.
 */
export async function executePlaybook(
  playbookId: string,
  incidentId: string,
  context: Record<string, unknown> = {}
): Promise<PlaybookExecution> {
  const { firestore } = initializeFirebase();
  
  const playbook = await getPlaybook(playbookId);
  if (!playbook) {
    throw new Error(`Playbook not found: ${playbookId}`);
  }
  
  // Create execution record
  const executionId = `EXEC-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const execution: PlaybookExecution = {
    id: executionId,
    playbookId,
    playbookVersion: playbook.version,
    incidentId,
    status: 'running',
    currentStep: 0,
    steps: playbook.steps.map(s => ({
      stepId: s.id,
      action: s.action,
      status: 'pending',
      params: s.params,
      retryCount: 0,
      startedAt: '',
      completedAt: '',
    })),
    startedAt: new Date().toISOString(),
    context,
  };
  
  await addDoc(collection(firestore, EXECUTIONS_COLLECTION), execution);
  
  try {
    // Execute each step
    for (let i = 0; i < playbook.steps.length; i++) {
      const step = playbook.steps[i];
      execution.currentStep = i;
      execution.steps[i].status = 'running';
      execution.steps[i].startedAt = new Date().toISOString();
      
      await updateExecution(firestore, executionId, execution);
      
      const { result, verification } = await executeStep(step, { ...context, incidentId, executionId } as ActionContext);
      
      execution.steps[i].status = result.success ? 'completed' : 'failed';
      execution.steps[i].completedAt = new Date().toISOString();
      execution.steps[i].result = result.data;
      execution.steps[i].error = result.error;
      execution.steps[i].verification = verification;
      
      await updateExecution(firestore, executionId, execution);
      
      if (!result.success) {
        // Handle failure
        if (step.onFailure === 'stop') {
          execution.status = 'failed';
          execution.error = result.error;
          break;
        } else if (step.onFailure === 'rollback') {
          execution.status = 'rolled_back';
          await executeRollback(playbook, execution, context as unknown as ActionContext);
          break;
        } else {
          // continue - log error but proceed
          console.warn(`[Playbook] Step ${step.id} failed but continuing: ${result.error}`);
        }
      }
      
      // Add step result to context for next steps
      if (result.data) {
        context[`step_${step.id}_result`] = result.data;
      }
    }
    
    if (execution.status === 'running') {
      execution.status = 'completed';
    }
    
    execution.completedAt = new Date().toISOString();
    await updateExecution(firestore, executionId, execution);
    
    // Update playbook stats
    await updateDoc(doc(firestore, PLAYBOOKS_COLLECTION, playbookId), {
      'metadata.executionCount': (playbook.metadata.executionCount || 0) + 1,
      'metadata.lastExecutedAt': execution.completedAt,
    });
    
    return execution;
    
  } catch (error) {
    execution.status = 'failed';
    execution.error = error instanceof Error ? error.message : 'Unknown error';
    execution.completedAt = new Date().toISOString();
    await updateExecution(firestore, executionId, execution);
    throw error;
  }
}

/**
 * Execute rollback steps.
 */
async function executeRollback(
  playbook: Playbook,
  execution: PlaybookExecution,
  context: ActionContext
): Promise<void> {
  if (!playbook.rollback || playbook.rollback.length === 0) return;
  
  console.log(`[Playbook] Executing rollback for ${execution.id}`);
  
  // Execute rollback steps in reverse order
  for (const step of [...playbook.rollback].reverse()) {
    try {
      const handler = actionRegistry.get(step.action);
      if (handler) {
        const params = interpolateParams(step.params, { ...context, ...execution.context });
        await handler(params, context as ActionContext);
      }
    } catch (error) {
      console.error(`[Playbook] Rollback step ${step.id} failed:`, error);
    }
  }
}

async function updateExecution(firestore: any, executionId: string, execution: PlaybookExecution): Promise<void> {
  await updateDoc(doc(firestore, EXECUTIONS_COLLECTION, executionId), {
    status: execution.status,
    currentStep: execution.currentStep,
    steps: execution.steps,
    completedAt: execution.completedAt,
    error: execution.error,
    context: execution.context,
  });
}

/**
 * Get execution history for an incident.
 */
export async function getExecutionHistory(incidentId: string): Promise<PlaybookExecution[]> {
  const { firestore } = initializeFirebase();
  
  const q = query(
    collection(firestore, EXECUTIONS_COLLECTION),
    where('incidentId', '==', incidentId),
    orderBy('startedAt', 'desc'),
    limit(20)
  );
  
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as PlaybookExecution));
}

// ─── Default Playbook Seeding ────────────────────────────────────

export async function seedDefaultPlaybooks(): Promise<void> {
  const defaultPlaybooks = [
    phishingEmailPlaybook(),
    smishingPlaybook(),
    deepfakePlaybook(),
    malwareUrlPlaybook(),
    credentialTheftPlaybook(),
  ];
  
  for (const pb of defaultPlaybooks) {
    const existing = await listPlaybooks({ tag: pb.metadata.tags[0] });
    if (existing.length === 0) {
      await savePlaybook(pb);
      console.log(`[Playbook] Seeded default playbook: ${pb.name}`);
    }
  }
}

function phishingEmailPlaybook(): Omit<Playbook, 'id'> {
  return {
    name: 'Phishing Email Containment',
    version: 1,
    description: 'Automated containment for phishing emails with BEC indicators',
    trigger: {
      incidentType: 'EMAIL_PHISHING',
      minSeverity: 'high',
      conditions: [
        { field: 'threatLevel', operator: 'in', value: ['high', 'critical'] },
        { field: 'modules', operator: 'contains', value: 'email' },
      ],
    },
    steps: [
      {
        id: 'quarantine_email',
        name: 'Quarantine Phishing Email',
        action: 'gmail.quarantine',
        params: {
          messageId: '{{incident.alerts[0].details.messageId}}',
          userId: '{{incident.alerts[0].userId}}',
        },
        verify: {
          action: 'gmail.getMessageState',
          params: { messageId: '{{incident.alerts[0].details.messageId}}' },
          expected: 'QUARANTINED',
          operator: 'equals',
        },
        onFailure: 'rollback',
      },
      {
        id: 'extract_iocs',
        name: 'Extract IOCs from Email',
        action: 'iocExtractor.extract',
        params: {
          text: '{{incident.alerts[0].details.emailContent}}',
          subject: '{{incident.alerts[0].details.subject}}',
        },
        onFailure: 'continue',
      },
      {
        id: 'block_sender_domain',
        name: 'Block Sender Domain',
        action: 'dnsSinkhole.add',
        params: {
          domain: '{{incident.alerts[0].details.senderDomain}}',
          reason: 'Phishing sender domain',
        },
        verify: {
          action: 'dnsSinkhole.resolve',
          params: { domain: '{{incident.alerts[0].details.senderDomain}}' },
          expected: 'SINKHOLE_IP',
          operator: 'equals',
        },
        onFailure: 'rollback',
      },
      {
        id: 'notify_user',
        name: 'Notify User',
        action: 'notifications.send',
        params: {
          userId: '{{incident.alerts[0].userId}}',
          channels: ['EMAIL', 'SLACK', 'PUSH'],
          template: 'phishing_contained',
          data: {
            sender: '{{incident.alerts[0].details.sender}}',
            subject: '{{incident.alerts[0].details.subject}}',
            incidentId: '{{incident.id}}',
          },
        },
        onFailure: 'continue',
      },
      {
        id: 'create_case',
        name: 'Create Incident Response Case',
        action: 'cases.create',
        params: {
          incidentId: '{{incidentId}}',
          title: 'Phishing: {{incident.alerts[0].details.subject}}',
          severity: 'HIGH',
          assignee: 'auto',
        },
        onFailure: 'continue',
      },
    ],
    rollback: [
      {
        id: 'restore_email',
        action: 'gmail.restore',
        params: { messageId: '{{incident.alerts[0].details.messageId}}' },
        onFailure: 'continue',
      },
      {
        id: 'remove_sinkhole',
        action: 'dnsSinkhole.remove',
        params: { domain: '{{incident.alerts[0].details.senderDomain}}' },
        onFailure: 'continue',
      },
    ],
    metadata: {
      author: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['phishing', 'email', 'containment', 'default'],
    },
  };
}

function smishingPlaybook(): Omit<Playbook, 'id'> {
  return {
    name: 'Smishing Containment',
    version: 1,
    description: 'Automated response to SMS phishing (smishing) attacks',
    trigger: {
      incidentType: 'SMS_PHISHING',
      minSeverity: 'high',
      conditions: [
        { field: 'modules', operator: 'contains', value: 'sms' },
        { field: 'threatLevel', operator: 'in', value: ['high', 'critical'] },
      ],
    },
    steps: [
      {
        id: 'block_number',
        name: 'Block Sender Number',
        action: 'twilio.blockNumber',
        params: {
          number: '{{incident.alerts[0].details.senderNumber}}',
          reason: 'Smishing campaign',
        },
        verify: {
          action: 'twilio.checkBlock',
          params: { number: '{{incident.alerts[0].details.senderNumber}}' },
          expected: true,
          operator: 'equals',
        },
        onFailure: 'rollback',
      },
      {
        id: 'block_urls',
        name: 'Block URLs in SMS',
        action: 'dnsSinkhole.addMultiple',
        params: {
          urls: '{{incident.iocs.filter(i => i.type === "url").map(i => i.value)}}',
          reason: 'Smishing URLs',
        },
        onFailure: 'continue',
      },
      {
        id: 'notify_user',
        name: 'Notify User',
        action: 'notifications.send',
        params: {
          userId: '{{incident.alerts[0].userId}}',
          channels: ['EMAIL', 'PUSH', 'SMS'],
          template: 'smishing_blocked',
          data: { incidentId: '{{incidentId}}' },
        },
        onFailure: 'continue',
      },
    ],
    rollback: [
      {
        id: 'unblock_number',
        action: 'twilio.unblockNumber',
        params: { number: '{{incident.alerts[0].details.senderNumber}}' },
        onFailure: 'continue',
      },
    ],
    metadata: {
      author: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['smishing', 'sms', 'containment', 'default'],
    },
  };
}

function deepfakePlaybook(): Omit<Playbook, 'id'> {
  return {
    name: 'Deepfake Media Flagging',
    version: 1,
    description: 'Flag and contain deepfake audio/video content',
    trigger: {
      incidentType: 'DEEPFAKE_DETECTED',
      minSeverity: 'high',
      conditions: [
        { field: 'modules', operator: 'contains', value: 'deepfake' },
      ],
    },
    steps: [
      {
        id: 'flag_media',
        name: 'Flag Media as Deepfake',
        action: 'firestore.flagDeepfake',
        params: {
          userId: '{{incident.alerts[0].userId}}',
          mediaId: '{{incident.alerts[0].details.mediaId}}',
          verdict: '{{incident.alerts[0].details.verdict}}',
          confidence: '{{incident.alerts[0].riskScore}}',
        },
        onFailure: 'continue',
      },
      {
        id: 'notify_user',
        name: 'Notify User of Deepfake',
        action: 'notifications.send',
        params: {
          userId: '{{incident.alerts[0].userId}}',
          channels: ['EMAIL', 'PUSH', 'SLACK'],
          template: 'deepfake_alert',
          data: {
            type: '{{incident.alerts[0].moduleType}}',
            confidence: '{{incident.alerts[0].riskScore}}%',
            incidentId: '{{incidentId}}',
          },
        },
        onFailure: 'continue',
      },
    ],
    metadata: {
      author: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['deepfake', 'audio', 'video', 'flagging', 'default'],
    },
  };
}

function malwareUrlPlaybook(): Omit<Playbook, 'id'> {
  return {
    name: 'Malicious URL Containment',
    version: 1,
    description: 'Block and sinkhole malicious URLs detected across modules',
    trigger: {
      incidentType: 'MALICIOUS_URL',
      minSeverity: 'medium',
      conditions: [
        { field: 'modules', operator: 'contains', value: 'link' },
      ],
    },
    steps: [
      {
        id: 'block_url',
        name: 'Block Malicious URL',
        action: 'dnsSinkhole.add',
        params: {
          url: '{{incident.alerts[0].details.url}}',
          domain: '{{incident.alerts[0].details.domain}}',
          reason: 'Malicious URL detected',
        },
        verify: {
          action: 'dnsSinkhole.resolve',
          params: { domain: '{{incident.alerts[0].details.domain}}' },
          expected: 'SINKHOLE_IP',
          operator: 'equals',
        },
        onFailure: 'rollback',
      },
      {
        id: 'scan_related',
        name: 'Scan Related Assets',
        action: 'assets.scanRelated',
        params: {
          domain: '{{incident.alerts[0].details.domain}}',
          userId: '{{incident.alerts[0].userId}}',
        },
        onFailure: 'continue',
      },
    ],
    rollback: [
      {
        id: 'unblock_domain',
        action: 'dnsSinkhole.remove',
        params: { domain: '{{incident.alerts[0].details.domain}}' },
        onFailure: 'continue',
      },
    ],
    metadata: {
      author: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['malware', 'url', 'link', 'containment', 'default'],
    },
  };
}

function credentialTheftPlaybook(): Omit<Playbook, 'id'> {
  return {
    name: 'Credential Theft Response',
    version: 1,
    description: 'Automated response to credential theft / account takeover attempts',
    trigger: {
      incidentType: 'CREDENTIAL_THEFT',
      minSeverity: 'critical',
      conditions: [
        { field: 'threatLevel', operator: 'equals', value: 'critical' },
        { field: 'modules', operator: 'contains', value: 'email' },
      ],
    },
    steps: [
      {
        id: 'revoke_sessions',
        name: 'Revoke All User Sessions',
        action: 'auth.revokeAllSessions',
        params: {
          userId: '{{incident.alerts[0].userId}}',
          reason: 'Credential theft detected',
        },
        verify: {
          action: 'auth.checkSessionsRevoked',
          params: { userId: '{{incident.alerts[0].userId}}' },
          expected: true,
          operator: 'equals',
        },
        onFailure: 'stop',
      },
      {
        id: 'force_password_reset',
        name: 'Force Password Reset',
        action: 'auth.forcePasswordReset',
        params: {
          userId: '{{incident.alerts[0].userId}}',
        },
        onFailure: 'stop',
      },
      {
        id: 'enable_mfa',
        name: 'Enforce MFA',
        action: 'auth.enforceMFA',
        params: {
          userId: '{{incident.alerts[0].userId}}',
        },
        onFailure: 'continue',
      },
      {
        id: 'notify_admin',
        name: 'Notify Security Admin',
        action: 'notifications.send',
        params: {
          userId: 'ADMIN',
          channels: ['EMAIL', 'SLACK', 'SMS'],
          template: 'credential_theft_critical',
          data: { incidentId: '{{incidentId}}', userId: '{{incident.alerts[0].userId}}' },
        },
        onFailure: 'continue',
      },
    ],
    rollback: [
      // Note: Rollback for credential theft is complex - typically manual
    ],
    metadata: {
      author: 'system',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['credential-theft', 'account-takeover', 'critical', 'default'],
    },
  };
}