/**
 * Da-Costa Svalinn — Autonomous Cybersecurity Analyst
 *
 * Core types for the orchestrator engine.
 * Ingests alerts from all 6 modules, correlates them into incidents,
 * auto-prioritizes by risk score, and generates forensic reports.
 */

// ─── Incident Schema ─────────────────────────────────────────────

export type ThreatLevel = 'low' | 'medium' | 'high' | 'critical';

export type ModuleType =
  | 'link'
  | 'lure'
  | 'email'
  | 'sms'
  | 'video'
  | 'deepfake';

export type IOCType =
  | 'url'
  | 'domain'
  | 'ip'
  | 'email_address'
  | 'phone_number'
  | 'file_hash'
  | 'sender_id';

export interface IOC {
  type: IOCType;
  value: string;
  confidence: number; // 0-1
  source: ModuleType;
  firstSeen: string; // ISO timestamp
}

export interface ModuleAlert {
  id: string;
  moduleType: ModuleType;
  userId: string;
  riskScore: number; // 0-10
  threatDetected: boolean;
  alertLevel: ThreatLevel;
  summary: string;
  details: Record<string, unknown>;
  iocs: IOC[];
  scanTimestamp: string;
  /**
   * Set once this alert has been folded into an Incident. Lets a later
   * correlation pass recognize "this alert already has a home" and
   * upgrade/merge into that incident instead of building a duplicate
   * one — see correlator.ts's correlateAlerts().
   */
  incidentId?: string;
  // The two fields below aren't set by the module scan itself — they're
  // filled in by orchestrator.ts (Steps 3–4) before persistAlert() writes
  // the final record, so they belong on the persisted shape even though
  // callers building a fresh ModuleAlert never set them directly.
  enrichment?: DomainEnrichment | null;
  isFalsePositive?: boolean;
}

export interface Incident {
  id: string;
  title: string;
  description: string;
  threatLevel: ThreatLevel;
  riskScore: number; // Composite 0-10
  status: 'new' | 'investigating' | 'confirmed' | 'false_positive' | 'resolved';
  alerts: ModuleAlert[]; // Correlated alerts
  modules: ModuleType[]; // Which modules contributed
  iocs: IOC[]; // Extracted IOCs
  geo?: GeoInfo;
  timeline: TimelineEvent[];
  forensicReport?: ForensicReport;
  createdAt: string;
  updatedAt: string;

  /**
   * 'single-alert' — created from one high-confidence alert on its own
   * (riskScore >= 7), no corroborating alert from another module found
   * yet. 'cross-module' — created from >=2 alerts across different
   * modules that share an IOC/actor/CVE/subject or fall within a
   * correlation window. Distinguishes "one high-confidence detection"
   * from "confirmed multi-vector activity" without conflating severity
   * with corroboration — see correlator.ts's correlateAlerts().
   */
  correlationType: 'single-alert' | 'cross-module';

  // Enhanced correlation fields
  threatActors?: string[]; // Known threat actors from OTX/TI
  campaigns?: string[]; // Campaign names from TI
  cves?: string[]; // Related CVE IDs
  asns?: string[]; // Autonomous System Numbers from infrastructure
}

export interface GeoInfo {
  country?: string;
  city?: string;
  ip?: string;
  asn?: string;
  isp?: string;
}

export interface TimelineEvent {
  timestamp: string;
  type: 'alert_received' | 'correlation' | 'triage' | 'action' | 'report';
  description: string;
  module?: ModuleType;
}

export interface ForensicReport {
  summary: string; // AI-generated executive summary
  technicalDetails: string; // Technical breakdown
  recommendedActions: string[];
  iocSummary: IOC[];
  affectedModules: ModuleType[];
  confidenceScore: number; // 0-1
  generatedAt: string;
}

// ─── WHOIS / SSL Enrichment ──────────────────────────────────────

export interface DomainEnrichment {
  domain: string;
  registrar?: string;
  createdDate?: string;
  expiresDate?: string;
  domainAge?: number; // days
  sslValid?: boolean;
  sslIssuer?: string;
  sslExpiry?: string;
  reputation?: 'clean' | 'suspicious' | 'malicious';
  whoisAvailable: boolean;
  error?: string;
}

// ─── Orchestrator Input / Output ─────────────────────────────────

export interface OrchestratorInput {
  userId: string;
  moduleType: ModuleType;
  rawData: Record<string, unknown>;
  subject?: string; // URL, email, phone, etc.
}

/**
 * Canonical shape for the outcome of an automated response action
 * (e.g. quarantine_email, block_url). This used to be redeclared with
 * slightly different optionality in src/lib/playbooks/engine.ts and
 * src/lib/actions/index.ts, reconciled only by TypeScript's structural
 * typing tolerating the mismatch — action handlers there return a loose
 * version of this shape (action/timestamp/message optional), which both
 * files now import from here instead of hand-rolling their own.
 */
export interface ActionResult {
  success: boolean;
  action?: string;
  timestamp?: string;
  message?: string;
  data?: unknown;
  error?: string;
  idempotencyKey?: string;
}

export interface ActionContext {
  userId: string;
  incidentId?: string;
  executionId?: string;
  dryRun?: boolean;
}

/**
 * The orchestrator's finalized action outcome (OrchestratorResult.autoResponse) —
 * a narrowing of ActionResult where action/timestamp/message are always
 * populated, since orchestrator.ts resolves them before returning (see its
 * Step 5, which fills in defaults for whatever the raw handler omitted).
 */
export interface AutoActionResult extends ActionResult {
  action: string;
  timestamp: string;
  message: string;
}

export interface OrchestratorResult {
  incident?: Incident; // Created if cross-module correlation found
  alert: ModuleAlert;
  enrichment?: DomainEnrichment;
  triage: TriageResult;
  autoResponse?: AutoActionResult;
  pendingAction?: PendingAction;
}

/**
 * autoActions that require a human Approve before they execute
 * (quarantining a real email, flagging deepfake media) — as opposed to
 * 'block_url'/'block_number', which stay immediate/autonomous. This is
 * an action-type gate, not a confidence/severity one: it doesn't change
 * based on riskScore or triage.confidence.
 */
export const GATED_AUTO_ACTIONS = ['quarantine_email', 'flag_deepfake'] as const;
export type GatedAutoAction = (typeof GATED_AUTO_ACTIONS)[number];

export interface PendingAction {
  id: string;
  userId: string;
  incidentId?: string; // filled in once correlation runs (may be after creation)
  alertId: string;
  action: GatedAutoAction;
  status: 'pending' | 'approved' | 'denied' | 'executed' | 'failed';
  reasoning: string; // triage's explanation, shown to the approver
  params: Record<string, unknown>; // resolved at request time, replayed verbatim on approval
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  result?: ActionResult; // set once executed
}

export interface TriageResult {
  isFalsePositive: boolean;
  confidence: number; // 0-1
  reasoning: string;
  recommendedAction: 'block' | 'warn' | 'monitor' | 'allow';
  autoAction?: 'quarantine_email' | 'block_url' | 'block_number' | 'flag_deepfake' | 'none';
}

// ─── Analyst Dashboard ───────────────────────────────────────────

export interface AnalystDashboardData {
  activeIncidents: Incident[];
  recentAlerts: ModuleAlert[];
  stats: {
    totalIncidents: number;
    criticalCount: number;
    highCount: number;
    mediumCount: number;
    lowCount: number;
    falsePositiveRate: number;
    meanTimeToTriage: number; // seconds
    topModules: { module: ModuleType; count: number }[];
  };
  iocFeed: IOC[];
}
