import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ModuleAlert, DomainEnrichment } from '@/lib/analyst/types';

// Mock the openrouter module so triageAlert falls back to rule-based logic
vi.mock('@/lib/openrouter', () => ({
  callNemotron: vi.fn().mockRejectedValue(new Error('AI unavailable')),
}));

// Must import AFTER mock setup
import { triageAlert } from '@/lib/analyst/triage';

function makeAlert(overrides: Partial<ModuleAlert> = {}): ModuleAlert {
  return {
    id: 'ALT-test-001',
    moduleType: 'link',
    userId: 'test-user',
    riskScore: 5,
    threatDetected: true,
    alertLevel: 'medium',
    summary: 'Suspicious link detected',
    details: {},
    iocs: [],
    scanTimestamp: new Date().toISOString(),
    ...overrides,
  };
}

function makeEnrichment(overrides: Partial<DomainEnrichment> = {}): DomainEnrichment {
  return {
    domain: 'example.com',
    whoisAvailable: true,
    ...overrides,
  };
}

describe('Triage (Rule-Based Fallback)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should classify high risk score (>= 8) as less likely false positive', async () => {
    const alert = makeAlert({ riskScore: 9, alertLevel: 'critical' });
    const result = await triageAlert(alert);

    expect(result.isFalsePositive).toBe(false);
    expect(result.confidence).toBeLessThanOrEqual(0.5);
    expect(result.recommendedAction).toBe('block');
  });

  it('should classify low risk score (<= 2) as more likely false positive', async () => {
    const alert = makeAlert({ riskScore: 1, alertLevel: 'low' });
    const result = await triageAlert(alert);

    expect(result.isFalsePositive).toBe(true);
    expect(result.recommendedAction).toBe('allow');
  });

  it('should boost false positive score for old, established domains', async () => {
    const alert = makeAlert({ riskScore: 4 });
    const enrichment = makeEnrichment({
      domainAge: 400,
      sslValid: true,
      reputation: 'clean',
    });

    const result = await triageAlert(alert, enrichment);
    expect(result.isFalsePositive).toBe(true);
  });

  it('should reduce false positive score for very new domains (< 30 days)', async () => {
    const alert = makeAlert({ riskScore: 3 });
    const enrichment = makeEnrichment({
      domainAge: 5,
      sslValid: false,
      reputation: 'suspicious',
    });

    const result = await triageAlert(alert, enrichment);
    expect(result.isFalsePositive).toBe(false);
  });

  it('should flag malicious reputation as strongly not false positive', async () => {
    const alert = makeAlert({ riskScore: 5 });
    const enrichment = makeEnrichment({
      reputation: 'malicious',
    });

    const result = await triageAlert(alert, enrichment);
    expect(result.isFalsePositive).toBe(false);
  });

  it('should recommend block for risk score >= 9', async () => {
    const alert = makeAlert({
      riskScore: 9,
      moduleType: 'link',
      alertLevel: 'critical',
    });

    const result = await triageAlert(alert);
    expect(result.recommendedAction).toBe('block');
    expect(result.autoAction).toBe('block_url');
  });

  it('should recommend warn for risk score 6-8', async () => {
    const alert = makeAlert({ riskScore: 7, alertLevel: 'high' });
    const result = await triageAlert(alert);
    expect(result.recommendedAction).toBe('warn');
  });

  it('should recommend monitor for risk score < 6', async () => {
    const alert = makeAlert({ riskScore: 3, alertLevel: 'medium' });
    const result = await triageAlert(alert);
    expect(result.recommendedAction).toBe('monitor');
  });

  it('should set correct autoAction for email module', async () => {
    const alert = makeAlert({
      moduleType: 'email',
      riskScore: 9,
      alertLevel: 'critical',
    });

    const result = await triageAlert(alert);
    expect(result.autoAction).toBe('quarantine_email');
  });

  it('should set correct autoAction for SMS module', async () => {
    const alert = makeAlert({
      moduleType: 'sms',
      riskScore: 9,
      alertLevel: 'critical',
    });

    const result = await triageAlert(alert);
    expect(result.autoAction).toBe('block_number');
  });

  it('should set correct autoAction for deepfake module', async () => {
    const alert = makeAlert({
      moduleType: 'deepfake',
      riskScore: 9,
      alertLevel: 'critical',
    });

    const result = await triageAlert(alert);
    expect(result.autoAction).toBe('flag_deepfake');
  });

  it('should set autoAction to none for false positives', async () => {
    const alert = makeAlert({ riskScore: 1, alertLevel: 'low' });
    const result = await triageAlert(alert);
    expect(result.isFalsePositive).toBe(true);
    expect(result.autoAction).toBe('none');
  });

  it('should include reasoning in the result', async () => {
    const alert = makeAlert({ riskScore: 1, alertLevel: 'low' });
    const result = await triageAlert(alert);
    expect(typeof result.reasoning).toBe('string');
    expect(result.reasoning.length).toBeGreaterThan(0);
  });

  it('should handle alert with no IOCs gracefully', async () => {
    const alert = makeAlert({ iocs: [] });
    const result = await triageAlert(alert);
    expect(result).toHaveProperty('isFalsePositive');
    expect(result).toHaveProperty('recommendedAction');
  });

  it('should consider multiple IOCs as corroboration', async () => {
    const alert = makeAlert({
      riskScore: 3,
      iocs: [
        { type: 'url', value: 'https://a.com', confidence: 0.9, source: 'link', firstSeen: '' },
        { type: 'domain', value: 'a.com', confidence: 0.85, source: 'link', firstSeen: '' },
        { type: 'ip', value: '1.2.3.4', confidence: 0.8, source: 'link', firstSeen: '' },
      ],
    });

    const result = await triageAlert(alert);
    // Multiple IOCs reduce false positive score
    expect(result.isFalsePositive).toBe(false);
  });
});
