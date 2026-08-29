import { describe, it, expect } from 'vitest';
import { correlateAlerts } from '@/lib/analyst/correlator';
import type { ModuleAlert, IOC } from '@/lib/analyst/types';

function makeAlert(overrides: Partial<ModuleAlert> & { moduleType: ModuleAlert['moduleType'] }): ModuleAlert {
  return {
    id: `ALT-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    userId: 'test-user',
    riskScore: 7,
    threatDetected: true,
    alertLevel: 'high',
    summary: 'Test alert',
    details: {},
    iocs: [],
    scanTimestamp: new Date().toISOString(),
    ...overrides,
  };
}

function makeIOC(overrides: Partial<IOC> & { type: IOC['type']; value: string }): IOC {
  return {
    confidence: 0.9,
    source: 'link',
    firstSeen: new Date().toISOString(),
    ...overrides,
  };
}

describe('Correlator', () => {
  describe('correlateAlerts', () => {
    it('should return null incident when no correlated alerts', async () => {
      const newAlert = makeAlert({
        moduleType: 'link',
        iocs: [makeIOC({ type: 'url', value: 'https://unique.com' })],
      });

      const result = await correlateAlerts(newAlert, []);
      expect(result.incident).toBeNull();
      expect(result.correlated).toHaveLength(0);
    });

    it('should correlate alerts sharing the same IOC value', async () => {
      const sharedUrl = 'https://phishing-bank.com/login';
      const existingAlert = makeAlert({
        moduleType: 'email',
        iocs: [makeIOC({ type: 'url', value: sharedUrl, source: 'email' })],
      });

      const newAlert = makeAlert({
        moduleType: 'link',
        iocs: [makeIOC({ type: 'url', value: sharedUrl, source: 'link' })],
      });

      const result = await correlateAlerts(newAlert, [existingAlert]);
      expect(result.incident).not.toBeNull();
      expect(result.correlated).toHaveLength(1);
      expect(result.correlated[0].id).toBe(existingAlert.id);
    });

    it('should NOT correlate alerts from the same module', async () => {
      const sharedUrl = 'https://phishing-bank.com/login';
      const existingAlert = makeAlert({
        moduleType: 'link',
        iocs: [makeIOC({ type: 'url', value: sharedUrl, source: 'link' })],
      });

      const newAlert = makeAlert({
        moduleType: 'link',
        iocs: [makeIOC({ type: 'url', value: sharedUrl, source: 'link' })],
      });

      const result = await correlateAlerts(newAlert, [existingAlert]);
      expect(result.incident).toBeNull();
      expect(result.correlated).toHaveLength(0);
    });

    it('should correlate alerts within 5 minutes (temporal proximity)', async () => {
      const now = new Date();
      const fiveMinAgo = new Date(now.getTime() - 4 * 60 * 1000); // 4 minutes ago

      const existingAlert = makeAlert({
        moduleType: 'sms',
        alertLevel: 'high',
        scanTimestamp: fiveMinAgo.toISOString(),
        iocs: [],
      });

      const newAlert = makeAlert({
        moduleType: 'email',
        alertLevel: 'high',
        scanTimestamp: now.toISOString(),
        iocs: [],
      });

      const result = await correlateAlerts(newAlert, [existingAlert]);
      expect(result.incident).not.toBeNull();
    });

    it('should NOT correlate low-level alerts temporally', async () => {
      const now = new Date();
      const twoMinAgo = new Date(now.getTime() - 2 * 60 * 1000);

      const existingAlert = makeAlert({
        moduleType: 'sms',
        alertLevel: 'low',
        scanTimestamp: twoMinAgo.toISOString(),
        iocs: [],
      });

      const newAlert = makeAlert({
        moduleType: 'email',
        alertLevel: 'high',
        scanTimestamp: now.toISOString(),
        iocs: [],
      });

      const result = await correlateAlerts(newAlert, [existingAlert]);
      expect(result.incident).toBeNull();
    });

    it('should build incident with correct threat level (critical for score >= 9)', async () => {
      const sharedUrl = 'https://mega-phish.com';
      const existingAlert = makeAlert({
        moduleType: 'email',
        riskScore: 9,
        iocs: [makeIOC({ type: 'url', value: sharedUrl, source: 'email' })],
      });

      const newAlert = makeAlert({
        moduleType: 'link',
        riskScore: 9,
        iocs: [makeIOC({ type: 'url', value: sharedUrl, source: 'link' })],
      });

      const result = await correlateAlerts(newAlert, [existingAlert]);
      expect(result.incident).not.toBeNull();
      expect(result.incident!.threatLevel).toBe('critical');
    });

    it('should boost IOC confidence when seen across modules', async () => {
      const sharedUrl = 'https://boost-test.com';
      const existingAlert = makeAlert({
        moduleType: 'email',
        iocs: [makeIOC({ type: 'url', value: sharedUrl, confidence: 0.8, source: 'email' })],
      });

      const newAlert = makeAlert({
        moduleType: 'link',
        iocs: [makeIOC({ type: 'url', value: sharedUrl, confidence: 0.9, source: 'link' })],
      });

      const result = await correlateAlerts(newAlert, [existingAlert]);
      expect(result.incident).not.toBeNull();
      // The merged IOC should have boosted confidence
      const urlIoc = result.incident!.iocs.find((i: IOC) => i.type === 'url' && i.value === sharedUrl);
      expect(urlIoc).toBeDefined();
      expect(urlIoc!.confidence).toBeGreaterThanOrEqual(0.9); // boosted from 0.9
    });

    it('should list all contributing modules in the incident', async () => {
      const sharedUrl = 'https://multi-module.com';
      const existingAlert = makeAlert({
        moduleType: 'email',
        iocs: [makeIOC({ type: 'url', value: sharedUrl, source: 'email' })],
      });

      const newAlert = makeAlert({
        moduleType: 'link',
        iocs: [makeIOC({ type: 'url', value: sharedUrl, source: 'link' })],
      });

      const result = await correlateAlerts(newAlert, [existingAlert]);
      expect(result.incident).not.toBeNull();
      expect(result.incident!.modules).toContain('email');
      expect(result.incident!.modules).toContain('link');
    });

    it('should handle normalize IOC values (strip protocol and www)', async () => {
      const existingAlert = makeAlert({
        moduleType: 'email',
        iocs: [makeIOC({ type: 'domain', value: 'http://www.evil.com', source: 'email' })],
      });

      const newAlert = makeAlert({
        moduleType: 'link',
        iocs: [makeIOC({ type: 'domain', value: 'evil.com', source: 'link' })],
      });

      const result = await correlateAlerts(newAlert, [existingAlert]);
      expect(result.incident).not.toBeNull();
    });
  });
});
