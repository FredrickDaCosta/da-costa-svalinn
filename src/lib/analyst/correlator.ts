/**
 * Cross-Module Threat Correlator
 *
 * Links IOCs across Email + Link + SMS + Voice/Video modules
 * to detect coordinated attacks and complex threat patterns.
 */

import type { ModuleAlert, Incident, IOC, ThreatLevel } from './types';

let incidentCounter = 0;

/**
 * Correlate a new alert against existing alerts to find connected incidents.
 * Returns a new Incident if correlation found, or null if standalone.
 */
export function correlateAlerts(
  newAlert: ModuleAlert,
  existingAlerts: ModuleAlert[],
): { incident: Incident | null; correlated: ModuleAlert[] } {
  const correlated = findCorrelatedAlerts(newAlert, existingAlerts);

  if (correlated.length === 0) {
    return { incident: null, correlated: [] };
  }

  // Build incident from correlated alerts
  const allAlerts = [newAlert, ...correlated];
  const incident = buildIncident(allAlerts);

  return { incident, correlated };
}

/**
 * Find alerts that share IOCs with the new alert.
 */
function findCorrelatedAlerts(
  newAlert: ModuleAlert,
  existingAlerts: ModuleAlert[],
): ModuleAlert[] {
  const matches: ModuleAlert[] = [];
  const newIocValues = new Set(newAlert.iocs.map(i => normalizeIOCValue(i.value)));

  for (const existing of existingAlerts) {
    // Skip same module — we want CROSS-module correlation
    if (existing.moduleType === newAlert.moduleType) continue;

    // Check IOC overlap
    const existingIocValues = new Set(existing.iocs.map(i => normalizeIOCValue(i.value)));
    const overlap = [...newIocValues].filter(v => existingIocValues.has(v));

    if (overlap.length > 0) {
      matches.push(existing);
      continue;
    }

    // Also check if subjects match (e.g., same URL in link scan and email)
    if (newAlert.details && existing.details) {
      const newSubject = (newAlert.details.subject || newAlert.details.url || '') as string;
      const existingSubject = (existing.details.subject || existing.details.url || '') as string;
      if (newSubject && existingSubject && normalizeIOCValue(newSubject) === normalizeIOCValue(existingSubject)) {
        matches.push(existing);
      }
    }

    // Check temporal proximity (alerts within 5 minutes of each other)
    const timeDiff = Math.abs(
      new Date(newAlert.scanTimestamp).getTime() - new Date(existing.scanTimestamp).getTime()
    );
    if (timeDiff < 5 * 60 * 1000 && existing.alertLevel !== 'low' && newAlert.alertLevel !== 'low') {
      // Same user, different module, within 5 min, both non-low = likely coordinated
      matches.push(existing);
    }
  }

  return matches;
}

/**
 * Build an Incident from a set of correlated alerts.
 */
function buildIncident(alerts: ModuleAlert[]): Incident {
  incidentCounter++;
  const id = `INC-${Date.now()}-${incidentCounter}`;

  // Aggregate IOCs (deduplicated)
  const iocMap = new Map<string, IOC>();
  for (const alert of alerts) {
    for (const ioc of alert.iocs) {
      const key = `${ioc.type}:${normalizeIOCValue(ioc.value)}`;
      if (!iocMap.has(key)) {
        iocMap.set(key, ioc);
      } else {
        // Boost confidence when seen across modules
        const existing = iocMap.get(key)!;
        existing.confidence = Math.min(1, existing.confidence + 0.1);
      }
    }
  }
  const allIocs = [...iocMap.values()];

  // Determine modules involved
  const modules = [...new Set(alerts.map(a => a.moduleType))];

  // Calculate composite risk score (weighted average, favoring highest)
  const scores = alerts.map(a => a.riskScore);
  const maxScore = Math.max(...scores);
  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const compositeScore = Math.min(10, (maxScore * 0.7) + (avgScore * 0.3));

  // Multi-module attacks are more severe
  const moduleMultiplier = modules.length >= 3 ? 1.3 : modules.length >= 2 ? 1.15 : 1.0;
  const adjustedScore = Math.min(10, compositeScore * moduleMultiplier);

  // Determine threat level
  const threatLevel: ThreatLevel =
    adjustedScore >= 9 ? 'critical' :
    adjustedScore >= 7 ? 'high' :
    adjustedScore >= 4 ? 'medium' : 'low';

  // Build title
  const moduleNames = modules.map(m => MODULE_DISPLAY[m] || m);
  const title = modules.length >= 3
    ? `Multi-Vector Attack: ${moduleNames.join(' + ')}`
    : modules.length === 2
      ? `Cross-Module Threat: ${moduleNames.join(' + ')}`
      : `Threat Detected via ${moduleNames[0]}`;

  // Build description
  const iocSummary = allIocs.slice(0, 5).map(i => `${i.type}: ${i.value}`).join(', ');
  const description = `Correlated ${alerts.length} alert(s) across ${modules.length} module(s). ` +
    `Key IOCs: ${iocSummary || 'none extracted'}. ` +
    `Composite risk: ${adjustedScore.toFixed(1)}/10.`;

  // Build timeline
  const timeline = alerts
    .sort((a, b) => new Date(a.scanTimestamp).getTime() - new Date(b.scanTimestamp).getTime())
    .map(a => ({
      timestamp: a.scanTimestamp,
      type: 'alert_received' as const,
      description: `${MODULE_DISPLAY[a.moduleType]}: ${a.summary}`,
      module: a.moduleType,
    }));

  const now = new Date().toISOString();

  return {
    id,
    title,
    description,
    threatLevel,
    riskScore: Math.round(adjustedScore * 10) / 10,
    status: 'new',
    alerts,
    modules,
    iocs: allIocs,
    timeline,
    createdAt: now,
    updatedAt: now,
  };
}

const MODULE_DISPLAY: Record<string, string> = {
  link: 'Link Scrutinizer',
  lure: 'Lure Detector',
  email: 'Email Analyzer',
  sms: 'SMS Shield',
  video: 'Video Auditor',
  deepfake: 'Deepfake Audio',
};

/**
 * Normalize IOC values for comparison (lowercase, trim, strip protocols).
 */
function normalizeIOCValue(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/^www\./, '')
    .replace(/\/+$/, '');
}
