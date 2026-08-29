/**
 * Case Management for Da-Costa Svalinn
 * 
 * Full incident response workflow: Incident → Case → Assignment → SLA → Resolution.
 */

import { initializeFirebase } from '@/firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit,
  updateDoc,
  Timestamp,
  writeBatch
} from 'firebase/firestore';

// ─── Types ─────────────────────────────────────────────────────────

export type CaseStatus = 'open' | 'investigating' | 'contained' | 'resolved' | 'closed';
export type CaseSeverity = 'low' | 'medium' | 'high' | 'critical';
export type CasePriority = 'P1' | 'P2' | 'P3' | 'P4';

export interface Case {
  id: string;
  incidentId: string;
  title: string;
  description?: string;
  status: CaseStatus;
  severity: CaseSeverity;
  priority: CasePriority;
  assigneeUid?: string;
  assigneeName?: string;
  reporterUid: string;
  reporterName?: string;
  createdAt: string;
  updatedAt: string;
  slaDueAt?: string;
  slaBreached: boolean;
  resolvedAt?: string;
  closedAt?: string;
  tags: string[];
  timeline: CaseTimelineEvent[];
  evidence: CaseEvidence[];
  notes: CaseNote[];
  metrics: CaseMetrics;
}

export interface CaseTimelineEvent {
  id: string;
  at: string;
  by: string; // user ID
  byName?: string;
  action: CaseAction;
  description: string;
  details?: Record<string, unknown>;
}

export type CaseAction = 
  | 'created' 
  | 'assigned' 
  | 'reassigned' 
  | 'status_changed' 
  | 'playbook_executed' 
  | 'evidence_added' 
  | 'note_added' 
  | 'sla_warning' 
  | 'sla_breached' 
  | 'contained' 
  | 'resolved' 
  | 'closed' 
  | 'reopened';

export interface CaseEvidence {
  id: string;
  type: 'ioc' | 'screenshot' | 'log' | 'file' | 'link' | 'artifact';
  title: string;
  description?: string;
  url?: string;
  data?: Record<string, unknown>;
  addedBy: string;
  addedAt: string;
}

export interface CaseNote {
  id: string;
  authorUid: string;
  authorName?: string;
  content: string;
  createdAt: string;
  updatedAt?: string;
  isInternal: boolean; // true = analyst only, false = visible to stakeholders
}

export interface CaseMetrics {
  timeToAssign?: number; // minutes
  timeToFirstResponse?: number; // minutes
  timeToContain?: number; // minutes
  timeToResolve?: number; // minutes
  totalPlaybooksExecuted: number;
  totalActionsTaken: number;
  escalationCount: number;
}

// ─── SLA Configuration ────────────────────────────────────────────

export const SLA_CONFIG: Record<CaseSeverity, { 
  responseMinutes: number; 
  resolveHours: number;
  escalationHours: number;
}> = {
  critical: { responseMinutes: 15, resolveHours: 4, escalationHours: 1 },
  high: { responseMinutes: 60, resolveHours: 24, escalationHours: 4 },
  medium: { responseMinutes: 240, resolveHours: 72, escalationHours: 24 },
  low: { responseMinutes: 1440, resolveHours: 168, escalationHours: 72 },
};

export const PRIORITY_MAP: Record<CaseSeverity, CasePriority> = {
  critical: 'P1',
  high: 'P2',
  medium: 'P3',
  low: 'P4',
};

// ─── Case Manager ────────────────────────────────────────────────

const CASES_COLLECTION = 'cases';

/**
 * Create a new case from an incident.
 */
export async function createCase(params: {
  incidentId: string;
  title: string;
  severity: CaseSeverity;
  description?: string;
  assigneeUid?: string;
  assigneeName?: string;
  reporterUid: string;
  reporterName?: string;
  tags?: string[];
}): Promise<string> {
  const { firestore } = initializeFirebase();
  
  const slaConfig = SLA_CONFIG[params.severity];
  const now = new Date();
  const slaDueAt = new Date(now.getTime() + slaConfig.resolveHours * 60 * 60 * 1000).toISOString();
  
  const caseData: Omit<Case, 'id'> = {
    incidentId: params.incidentId,
    title: params.title,
    description: params.description,
    status: 'open',
    severity: params.severity,
    priority: PRIORITY_MAP[params.severity],
    assigneeUid: params.assigneeUid,
    assigneeName: params.assigneeName,
    reporterUid: params.reporterUid,
    reporterName: params.reporterName,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    slaDueAt,
    slaBreached: false,
    tags: params.tags || [],
    timeline: [{
      id: `evt-${Date.now()}`,
      at: now.toISOString(),
      by: params.reporterUid,
      byName: params.reporterName,
      action: 'created',
      description: `Case created from incident ${params.incidentId}`,
    }],
    evidence: [],
    notes: [],
    metrics: {
      totalPlaybooksExecuted: 0,
      totalActionsTaken: 0,
      escalationCount: 0,
    },
  };
  
  const ref = await addDoc(collection(firestore, CASES_COLLECTION), caseData);
  
  // If assignee specified, add assignment event
  if (params.assigneeUid) {
    await updateCase(ref.id, {
      timeline: [
        ...caseData.timeline,
        {
          id: `evt-${Date.now() + 1}`,
          at: new Date().toISOString(),
          by: 'system',
          action: 'assigned',
          description: `Assigned to ${params.assigneeName || params.assigneeUid}`,
        },
      ],
    });
  }
  
  return ref.id;
}

/**
 * Get a case by ID.
 */
export async function getCase(caseId: string): Promise<Case | null> {
  const { firestore } = initializeFirebase();
  const snap = await getDoc(doc(firestore, CASES_COLLECTION, caseId));
  
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Case;
}

/**
 * List cases with filters.
 */
export async function listCases(options: {
  status?: CaseStatus[];
  severity?: CaseSeverity[];
  assigneeUid?: string;
  reporterUid?: string;
  incidentId?: string;
  limit?: number;
  offset?: number;
} = {}): Promise<{ cases: Case[]; total: number }> {
  const { firestore } = initializeFirebase();
  
  let q = query(
    collection(firestore, CASES_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(options.limit || 50)
  );
  
  if (options.status && options.status.length > 0) {
    q = query(q, where('status', 'in', options.status));
  }
  
  if (options.severity && options.severity.length > 0) {
    q = query(q, where('severity', 'in', options.severity));
  }
  
  if (options.assigneeUid) {
    q = query(q, where('assigneeUid', '==', options.assigneeUid));
  }
  
  if (options.reporterUid) {
    q = query(q, where('reporterUid', '==', options.reporterUid));
  }
  
  if (options.incidentId) {
    q = query(q, where('incidentId', '==', options.incidentId));
  }
  
  const snap = await getDocs(q);
  const cases = snap.docs.map(d => ({ id: d.id, ...d.data() } as Case));
  
  // Get total count (approximate)
  const totalQuery = query(collection(firestore, CASES_COLLECTION));
  const totalSnap = await getDocs(totalQuery);
  
  return { cases, total: totalSnap.size };
}

/**
 * Update a case.
 */
export async function updateCase(caseId: string, updates: Partial<Omit<Case, 'id' | 'createdAt'>>): Promise<void> {
  const { firestore } = initializeFirebase();
  
  const updateData = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  await updateDoc(doc(firestore, CASES_COLLECTION, caseId), updateData);
}

/**
 * Assign a case to an analyst.
 */
export async function assignCase(caseId: string, assigneeUid: string, assigneeName: string, assignedByUid: string): Promise<void> {
  const { firestore } = initializeFirebase();
  const caseRef = doc(firestore, CASES_COLLECTION, caseId);
  const caseSnap = await getDoc(caseRef);
  
  if (!caseSnap.exists()) throw new Error('Case not found');
  
  const caseData = caseSnap.data() as Case;
  const now = new Date().toISOString();
  
  const updates: Partial<Case> = {
    assigneeUid,
    assigneeName,
    status: 'investigating',
    updatedAt: now,
    timeline: [
      ...caseData.timeline,
      {
        id: `evt-${Date.now()}`,
        at: now,
        by: assignedByUid,
        action: 'assigned',
        description: `Assigned to ${assigneeName}`,
      },
    ],
  };
  
  // Calculate time to assign
  const createdAt = new Date(caseData.createdAt).getTime();
  const timeToAssign = Math.round((Date.now() - createdAt) / 60000);
  if (!caseData.metrics.timeToAssign) {
    updates.metrics = { ...caseData.metrics, timeToAssign };
  }
  
  await updateDoc(caseRef, updates);
}

/**
 * Update case status.
 */
export async function updateCaseStatus(
  caseId: string, 
  status: CaseStatus, 
  updatedByUid: string,
  updatedByName: string,
  reason?: string
): Promise<void> {
  const { firestore } = initializeFirebase();
  const caseRef = doc(firestore, CASES_COLLECTION, caseId);
  const caseSnap = await getDoc(caseRef);
  
  if (!caseSnap.exists()) throw new Error('Case not found');
  
  const caseData = caseSnap.data() as Case;
  const now = new Date().toISOString();
  
  const updates: Partial<Case> = {
    status,
    updatedAt: now,
    timeline: [
      ...caseData.timeline,
      {
        id: `evt-${Date.now()}`,
        at: now,
        by: updatedByUid,
        byName: updatedByName,
        action: 'status_changed',
        description: `Status changed to ${status}${reason ? `: ${reason}` : ''}`,
      },
    ],
  };
  
  // Calculate metrics based on status
  const createdAt = new Date(caseData.createdAt).getTime();
  
  if (status === 'contained' && !caseData.metrics.timeToContain) {
    updates.metrics = { 
      ...caseData.metrics, 
      timeToContain: Math.round((Date.now() - createdAt) / 60000) 
    };
  }
  
  if (status === 'resolved') {
    updates.resolvedAt = now;
    if (!caseData.metrics.timeToResolve) {
      updates.metrics = { 
        ...updates.metrics, 
        ...caseData.metrics, 
        timeToResolve: Math.round((Date.now() - createdAt) / 60000) 
      };
    }
  }
  
  if (status === 'closed') {
    updates.closedAt = now;
  }
  
  await updateDoc(caseRef, updates);
}

/**
 * Add evidence to a case.
 */
export async function addEvidence(caseId: string, evidence: Omit<CaseEvidence, 'id' | 'addedAt'>): Promise<void> {
  const { firestore } = initializeFirebase();
  const caseRef = doc(firestore, CASES_COLLECTION, caseId);
  const caseSnap = await getDoc(caseRef);
  
  if (!caseSnap.exists()) throw new Error('Case not found');
  
  const caseData = caseSnap.data() as Case;
  const newEvidence: CaseEvidence = {
    ...evidence,
    id: `ev-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    addedAt: new Date().toISOString(),
  };
  
  await updateDoc(caseRef, {
    evidence: [...caseData.evidence, newEvidence],
    updatedAt: new Date().toISOString(),
    timeline: [
      ...caseData.timeline,
      {
        id: `evt-${Date.now()}`,
        at: new Date().toISOString(),
        by: evidence.addedBy,
        action: 'evidence_added',
        description: `Added evidence: ${evidence.title}`,
      },
    ],
  });
}

/**
 * Add a note to a case.
 */
export async function addNote(caseId: string, note: Omit<CaseNote, 'id' | 'createdAt'>): Promise<void> {
  const { firestore } = initializeFirebase();
  const caseRef = doc(firestore, CASES_COLLECTION, caseId);
  const caseSnap = await getDoc(caseRef);
  
  if (!caseSnap.exists()) throw new Error('Case not found');
  
  const caseData = caseSnap.data() as Case;
  const newNote: CaseNote = {
    ...note,
    id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  };
  
  await updateDoc(caseRef, {
    notes: [...caseData.notes, newNote],
    updatedAt: new Date().toISOString(),
    timeline: [
      ...caseData.timeline,
      {
        id: `evt-${Date.now()}`,
        at: new Date().toISOString(),
        by: note.authorUid,
        byName: note.authorName,
        action: 'note_added',
        description: `Added ${note.isInternal ? 'internal' : 'stakeholder'} note`,
      },
    ],
  });
}

/**
 * Execute a playbook and record it in the case.
 */
export async function recordPlaybookExecution(
  caseId: string,
  playbookId: string,
  playbookName: string,
  executionId: string,
  result: 'success' | 'failed',
  executedBy: string
): Promise<void> {
  const { firestore } = initializeFirebase();
  const caseRef = doc(firestore, CASES_COLLECTION, caseId);
  const caseSnap = await getDoc(caseRef);
  
  if (!caseSnap.exists()) throw new Error('Case not found');
  
  const caseData = caseSnap.data() as Case;
  const now = new Date().toISOString();
  
  await updateDoc(caseRef, {
    updatedAt: now,
    metrics: {
      ...caseData.metrics,
      totalPlaybooksExecuted: caseData.metrics.totalPlaybooksExecuted + 1,
      totalActionsTaken: caseData.metrics.totalActionsTaken + 1,
    },
    timeline: [
      ...caseData.timeline,
      {
        id: `evt-${Date.now()}`,
        at: now,
        by: executedBy,
        action: 'playbook_executed',
        description: `Playbook "${playbookName}" ${result}`,
        details: { playbookId, executionId, result },
      },
    ],
  });
}

/**
 * Escalate a case.
 */
export async function escalateCase(caseId: string, escalatedByUid: string, escalatedByName: string, reason: string): Promise<void> {
  const { firestore } = initializeFirebase();
  const caseRef = doc(firestore, CASES_COLLECTION, caseId);
  const caseSnap = await getDoc(caseRef);
  
  if (!caseSnap.exists()) throw new Error('Case not found');
  
  const caseData = caseSnap.data() as Case;
  const now = new Date().toISOString();
  
  // Increase severity if possible
  const severityOrder: CaseSeverity[] = ['low', 'medium', 'high', 'critical'];
  const currentIndex = severityOrder.indexOf(caseData.severity);
  const newSeverity = currentIndex < severityOrder.length - 1 ? severityOrder[currentIndex + 1] : caseData.severity;
  
  const updates: Partial<Case> = {
    severity: newSeverity,
    priority: PRIORITY_MAP[newSeverity],
    updatedAt: now,
    metrics: {
      ...caseData.metrics,
      escalationCount: caseData.metrics.escalationCount + 1,
    },
    timeline: [
      ...caseData.timeline,
      {
        id: `evt-${Date.now()}`,
        at: now,
        by: escalatedByUid,
        byName: escalatedByName,
        action: 'status_changed',
        description: `Escalated: ${reason}`,
        details: { previousSeverity: caseData.severity, newSeverity },
      },
    ],
  };
  
  // Recalculate SLA due date
  const slaConfig = SLA_CONFIG[newSeverity];
  updates.slaDueAt = new Date(Date.now() + slaConfig.resolveHours * 60 * 60 * 1000).toISOString();
  
  await updateDoc(caseRef, updates);
}

/**
 * Get cases with SLA breaches or warnings.
 */
export async function getSLACases(): Promise<{ breached: Case[]; warning: Case[] }> {
  const { firestore } = initializeFirebase();
  const now = new Date().toISOString();
  const warningThreshold = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour warning
  
  // Get all open/investigating cases
  const q = query(
    collection(firestore, CASES_COLLECTION),
    where('status', 'in', ['open', 'investigating', 'contained'])
  );
  
  const snap = await getDocs(q);
  const cases = snap.docs.map(d => ({ id: d.id, ...d.data() } as Case));
  
  const breached = cases.filter(c => c.slaDueAt && c.slaDueAt < now && !c.slaBreached);
  const warning = cases.filter(c => c.slaDueAt && c.slaDueAt < warningThreshold && c.slaDueAt >= now);
  
  // Mark breached cases
  if (breached.length > 0) {
    const batch = writeBatch(firestore);
    for (const c of breached) {
      batch.update(doc(firestore, CASES_COLLECTION, c.id), { 
        slaBreached: true,
        updatedAt: now,
        timeline: [
          ...c.timeline,
          {
            id: `evt-${Date.now()}`,
            at: now,
            by: 'system',
            action: 'sla_breached',
            description: 'SLA breached - resolution overdue',
          },
        ],
      });
    }
    await batch.commit();
  }
  
  return { breached, warning };
}

/**
 * SLA Monitor Job - runs every 15 minutes via Cloud Scheduler.
 */
export async function runSLAMonitor(): Promise<{ checked: number; breached: number; warnings: number }> {
  const { breached, warning } = await getSLACases();
  
  // Send notifications for warnings and breaches
  for (const c of [...breached, ...warning]) {
    if (c.assigneeUid) {
      await notifySLA(c, breached.includes(c) ? 'breached' : 'warning');
    }
  }
  
  return { checked: breached.length + warning.length, breached: breached.length, warnings: warning.length };
}

async function notifySLA(caseData: Case, type: 'breached' | 'warning'): Promise<void> {
  if (!caseData.assigneeUid) return;
  
  const { firestore } = initializeFirebase();
  const { collection, addDoc, Timestamp } = await import('firebase/firestore');
  
  await addDoc(collection(firestore, 'notifications'), {
    userId: caseData.assigneeUid,
    type: `sla_${type}`,
    title: `SLA ${type === 'breached' ? 'Breached' : 'Warning'}: ${caseData.title}`,
    body: `Case ${caseData.id} (${caseData.severity}) ${type === 'breached' ? 'has breached its SLA' : 'is approaching SLA deadline'}. Due: ${caseData.slaDueAt}`,
    data: { caseId: caseData.id },
    read: false,
    createdAt: Timestamp.now(),
  });
}

/**
 * Get case statistics for dashboard.
 */
export async function getCaseStats(userId?: string): Promise<{
  total: number;
  byStatus: Record<CaseStatus, number>;
  bySeverity: Record<CaseSeverity, number>;
  slaBreached: number;
  avgTimeToResolve: number; // hours
  avgTimeToContain: number; // hours
}> {
  const { firestore } = initializeFirebase();
  
  let q = query(collection(firestore, CASES_COLLECTION));
  
  if (userId) {
    q = query(q, where('assigneeUid', '==', userId));
  }
  
  const snap = await getDocs(q);
  const cases = snap.docs.map(d => d.data() as Case);
  
  const byStatus: Record<CaseStatus, number> = { open: 0, investigating: 0, contained: 0, resolved: 0, closed: 0 };
  const bySeverity: Record<CaseSeverity, number> = { low: 0, medium: 0, high: 0, critical: 0 };
  let slaBreached = 0;
  let totalResolveTime = 0;
  let resolveCount = 0;
  let totalContainTime = 0;
  let containCount = 0;
  
  for (const c of cases) {
    byStatus[c.status]++;
    bySeverity[c.severity]++;
    if (c.slaBreached) slaBreached++;
    if (c.metrics.timeToResolve) {
      totalResolveTime += c.metrics.timeToResolve;
      resolveCount++;
    }
    if (c.metrics.timeToContain) {
      totalContainTime += c.metrics.timeToContain;
      containCount++;
    }
  }
  
  return {
    total: cases.length,
    byStatus,
    bySeverity,
    slaBreached,
    avgTimeToResolve: resolveCount > 0 ? Math.round(totalResolveTime / resolveCount / 60) : 0,
    avgTimeToContain: containCount > 0 ? Math.round(totalContainTime / containCount / 60) : 0,
  };
}