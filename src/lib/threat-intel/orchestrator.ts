/**
 * Threat Intelligence Ingestion Orchestrator
 * Coordinates ingestion from all TI sources.
 */

import { initializeFirebase } from '@/firebase';
import { ingestOTX } from './ingest/otx';
import { ingestAbuseIPDB } from './ingest/abuseipdb';
import { ingestURLhaus } from './ingest/urlhaus';
import { ingestPhishTank } from './ingest/phishtank';
import { incrementalNVDSync, fullNVDSync } from './ingest/nvd';

export interface IngestionResult {
  source: string;
  ingested: number;
  errors: number;
  timestamp: string;
}

export async function runThreatIntelIngestion(
  apiKeys: {
    otx?: string;
    abuseipdb?: string;
    phishtank?: string;
  },
  options: {
    fullNVD?: boolean;
    nvdDaysBack?: number;
  } = {}
): Promise<IngestionResult[]> {
  const results: IngestionResult[] = [];
  
  console.log('[TI Ingestion] Starting threat intelligence ingestion...');

  // Run OTX ingestion
  if (apiKeys.otx) {
    try {
      console.log('[TI Ingestion] Ingesting OTX...');
      const result = await ingestOTX(apiKeys.otx);
      results.push({ source: 'OTX', ...result, timestamp: new Date().toISOString() });
      console.log(`[TI Ingestion] OTX: ${result.ingested} IOCs, ${result.errors} errors`);
    } catch (error) {
      results.push({ source: 'OTX', ingested: 0, errors: 1, timestamp: new Date().toISOString() });
      console.error('[TI Ingestion] OTX failed:', error);
    }
  }

  // Run AbuseIPDB ingestion
  if (apiKeys.abuseipdb) {
    try {
      console.log('[TI Ingestion] Ingesting AbuseIPDB...');
      const result = await ingestAbuseIPDB(apiKeys.abuseipdb);
      results.push({ source: 'ABUSEIPDB', ...result, timestamp: new Date().toISOString() });
      console.log(`[TI Ingestion] AbuseIPDB: ${result.ingested} IPs, ${result.errors} errors`);
    } catch (error) {
      results.push({ source: 'ABUSEIPDB', ingested: 0, errors: 1, timestamp: new Date().toISOString() });
      console.error('[TI Ingestion] AbuseIPDB failed:', error);
    }
  }

  // Run URLhaus ingestion
  try {
    console.log('[TI Ingestion] Ingesting URLhaus...');
    const result = await ingestURLhaus();
    results.push({ source: 'URLHAUS', ...result, timestamp: new Date().toISOString() });
    console.log(`[TI Ingestion] URLhaus: ${result.ingested} URLs, ${result.errors} errors`);
  } catch (error) {
    results.push({ source: 'URLHAUS', ingested: 0, errors: 1, timestamp: new Date().toISOString() });
    console.error('[TI Ingestion] URLhaus failed:', error);
  }

  // Run PhishTank ingestion
  if (apiKeys.phishtank) {
    try {
      console.log('[TI Ingestion] Ingesting PhishTank...');
      const result = await ingestPhishTank(apiKeys.phishtank);
      results.push({ source: 'PHISHTANK', ...result, timestamp: new Date().toISOString() });
      console.log(`[TI Ingestion] PhishTank: ${result.ingested} URLs, ${result.errors} errors`);
    } catch (error) {
      results.push({ source: 'PHISHTANK', ingested: 0, errors: 1, timestamp: new Date().toISOString() });
      console.error('[TI Ingestion] PhishTank failed:', error);
    }
  }

  // Run NVD CVE ingestion
  try {
    console.log('[TI Ingestion] Ingesting NVD CVE...');
    const result = options.fullNVD 
      ? await fullNVDSync()
      : await incrementalNVDSync(options.nvdDaysBack || 7);
    results.push({ source: 'NVD', ...result, timestamp: new Date().toISOString() });
    console.log(`[TI Ingestion] NVD: ${result.ingested} CVEs, ${result.errors} errors`);
  } catch (error) {
    results.push({ source: 'NVD', ingested: 0, errors: 1, timestamp: new Date().toISOString() });
    console.error('[TI Ingestion] NVD failed:', error);
  }

  // Store ingestion results for monitoring
  await storeIngestionResults(results);

  console.log('[TI Ingestion] Completed.');
  return results;
}

async function storeIngestionResults(results: IngestionResult[]): Promise<void> {
  const { firestore } = initializeFirebase();
  const { collection, addDoc, Timestamp } = await import('firebase/firestore');
  
  for (const result of results) {
    await addDoc(collection(firestore, 'tiIngestionLogs'), {
      ...result,
      createdAt: Timestamp.now(),
    });
  }
}

/**
 * Scheduled ingestion job - runs daily.
 */
export async function runScheduledTIIngestion(): Promise<void> {
  const apiKeys = {
    otx: process.env.OTX_API_KEY,
    abuseipdb: process.env.ABUSEIPDB_API_KEY,
    phishtank: process.env.PHISHTANK_API_KEY,
  };

  // Only run sources that have API keys configured
  const configuredSources = Object.entries(apiKeys).filter(([, v]) => v).map(([k]) => k);
  console.log(`[TI Ingestion] Configured sources: ${configuredSources.join(', ')}`);

  if (configuredSources.length === 0) {
    console.log('[TI Ingestion] No API keys configured, skipping ingestion');
    return;
  }

  await runThreatIntelIngestion(apiKeys as typeof apiKeys, {
    fullNVD: false, // Incremental daily
    nvdDaysBack: 1,
  });
}

/**
 * Weekly deep ingestion - runs full NVD sync.
 */
export async function runWeeklyTIIngestion(): Promise<void> {
  const apiKeys = {
    otx: process.env.OTX_API_KEY,
    abuseipdb: process.env.ABUSEIPDB_API_KEY,
    phishtank: process.env.PHISHTANK_API_KEY,
  };

  await runThreatIntelIngestion(apiKeys as typeof apiKeys, {
    fullNVD: true,
  });
}