/**
 * Threat Intelligence Ingestion - AbuseIPDB
 * Fetches abusive IP addresses from AbuseIPDB API.
 */

import { initializeFirebase } from '@/firebase';
import { writeBatch, doc, Timestamp } from 'firebase/firestore';

interface AbuseIPDBReport {
  ipAddress: string;
  isPublic: boolean;
  ipVersion: number;
  isWhitelisted: boolean;
  abuseConfidenceScore: number;
  countryCode: string | null;
  countryName: string | null;
  usageType: string | null;
  isp: string | null;
  domain: string | null;
  hostnames: string[];
  totalReports: number;
  numDistinctUsers: number;
  lastReportedAt: string;
}

const ABUSEIPDB_API_BASE = 'https://api.abuseipdb.com/api/v2';
const THREAT_INTEL_COLLECTION = 'threatIntel';

export async function ingestAbuseIPDB(apiKey: string, options: { confidenceMinimum?: number; limit?: number } = {}): Promise<{ ingested: number; errors: number }> {
  const { firestore } = initializeFirebase();
  let ingested = 0;
  let errors = 0;

  try {
    const url = new URL(`${ABUSEIPDB_API_BASE}/blacklist`);
    url.searchParams.set('confidenceMinimum', (options.confidenceMinimum || 75).toString());
    url.searchParams.set('limit', (options.limit || 10000).toString());
    url.searchParams.set('plaintext', 'false');

    const response = await fetch(url.toString(), {
      headers: {
        'Key': apiKey,
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(60000)
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('AbuseIPDB rate limited');
      }
      throw new Error(`AbuseIPDB API returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json() as { data: AbuseIPDBReport[] };

    const batch = writeBatch(firestore);
    const now = Timestamp.now();

    for (const report of data.data) {
      try {
        const docId = `IPv4:${report.ipAddress}`;
        const ref = doc(firestore, THREAT_INTEL_COLLECTION, docId);

        const tags = new Set<string>(['abuseipdb', 'malicious-ip']);
        if (report.countryCode) tags.add(`country:${report.countryCode.toLowerCase()}`);
        if (report.isp) tags.add(`isp:${report.isp.toLowerCase().replace(/\s+/g, '-')}`);
        if (report.usageType) tags.add(`usage:${report.usageType.toLowerCase()}`);

        batch.set(ref, {
          type: 'IPv4',
          value: report.ipAddress,
          sources: ['ABUSEIPDB'],
          confidence: Math.min(0.99, report.abuseConfidenceScore / 100),
          tags: Array.from(tags),
          firstSeen: report.lastReportedAt,
          lastSeen: report.lastReportedAt,
          tlp: 'WHITE',
          rawData: {
            isPublic: report.isPublic,
            ipVersion: report.ipVersion,
            isWhitelisted: report.isWhitelisted,
            abuseConfidenceScore: report.abuseConfidenceScore,
            countryCode: report.countryCode,
            countryName: report.countryName,
            usageType: report.usageType,
            isp: report.isp,
            domain: report.domain,
            hostnames: report.hostnames,
            totalReports: report.totalReports,
            numDistinctUsers: report.numDistinctUsers,
          },
          cve: null,
          updatedAt: now,
        }, { merge: true });

        ingested++;
      } catch (error) {
        errors++;
        console.error(`[AbuseIPDB] Error processing IP ${report.ipAddress}:`, error);
      }
    }

    await batch.commit();

  } catch (error) {
    console.error('[AbuseIPDB] Ingestion error:', error);
    errors++;
  }

  return { ingested, errors };
}