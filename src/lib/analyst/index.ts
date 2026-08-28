/**
 * Da-Costa Svalinn — Autonomous Cybersecurity Analyst
 *
 * Central orchestrator that detects, verifies, correlates,
 * explains, and acts — without human delay.
 */

export { processScan, explainResult } from './orchestrator';
export { extractIOCs } from './ioc-extractor';
export { enrichDomain } from './enrichment';
export { triageAlert, triageBatch } from './triage';
export { correlateAlerts } from './correlator';
export { generateForensicReport, generateUserExplanation } from './report-generator';
export { executeAutoResponse } from './auto-response';

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
