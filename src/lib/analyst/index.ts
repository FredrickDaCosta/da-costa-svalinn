/**
 * Da-Costa Svalinn — Autonomous Cybersecurity Analyst
 *
 * Central orchestrator that detects, verifies, correlates,
 * explains, and acts — without human delay.
 */

// processScan is intentionally NOT re-exported here. It's server-only
// (Admin SDK) and must be called from an API route with withAuth, e.g.
// src/app/api/scan/log-result/route.ts -- never directly from a client
// component. Import it from '@/lib/analyst/orchestrator' server-side only.
export { extractIOCs } from './ioc-extractor';
export { enrichDomain } from './enrichment';
export { triageAlert, triageBatch } from './triage';
export { correlateAlerts } from './correlator';
export { generateForensicReport, generateUserExplanation } from './report-generator';

export type {
  Incident,
  ModuleAlert,
  IOC,
  IOCType,
  ModuleType,
  ThreatLevel,
  TriageResult,
  ForensicReport,
  DomainEnrichment,
  OrchestratorInput,
  OrchestratorResult,
  AutoActionResult,
  AnalystDashboardData,
  GeoInfo,
  TimelineEvent,
} from './types';
