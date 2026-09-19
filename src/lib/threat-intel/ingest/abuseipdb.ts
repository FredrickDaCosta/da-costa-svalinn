/**
 * Threat Intelligence Ingestion - AbuseIPDB
 * Fetches abusive IP addresses from AbuseIPDB API.
 */

import { requireAdminFirestore, adminBatch, adminDoc, Timestamp } from '@/lib/admin-firestore';

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
// Firestore hard-caps a single WriteBatch at 500 operations -- the
// default `limit` here (10000) can massively exceed that.
const WRITE_BATCH_CHUNK_SIZE = 500;

export async function ingestAbuseIPDB(apiKey: string, options: { confidenceMinimum?: number; limit?: number } = {}): Promise<{ ingested: number; errors: number }> {
  const firestore = await requireAdminFirestore();
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

    const now = Timestamp.now();
    const writes: Array<{ ref: FirebaseFirestore.DocumentReference; data: FirebaseFirestore.DocumentData }> = [];

    for (const report of data.data) {
      try {
        const docId = `IPv4:${report.ipAddress}`;
        const ref = adminDoc(firestore, THREAT_INTEL_COLLECTION, docId);

        const tags = new Set<string>(['abuseipdb', 'malicious-ip']);
        if (report.countryCode) tags.add(`country:${report.countryCode.toLowerCase()}`);
        if (report.isp) tags.add(`isp:${report.isp.toLowerCase().replace(/\s+/g, '-')}`);
        if (report.usageType) tags.add(`usage:${report.usageType.toLowerCase()}`);

        writes.push({
          ref,
          data: {
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
          },
        });

        ingested++;
      } catch (error) {
        errors++;
        console.error(`[AbuseIPDB] Error processing IP ${report.ipAddress}:`, error);
      }
    }

    for (let i = 0; i < writes.length; i += WRITE_BATCH_CHUNK_SIZE) {
      const chunk = writes.slice(i, i + WRITE_BATCH_CHUNK_SIZE);
      const batch = adminBatch(firestore);
      for (const { ref, data } of chunk) batch.set(ref, data, { merge: true });
      await batch.commit();
    }

  } catch (error) {
    console.error('[AbuseIPDB] Ingestion error:', error);
    errors++;
  }

  return { ingested, errors };
}