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

export interface OrchestratorResult {
  incident?: Incident; // Created if cross-module correlation found
  alert: ModuleAlert;
  enrichment?: DomainEnrichment;
  triage: TriageResult;
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
