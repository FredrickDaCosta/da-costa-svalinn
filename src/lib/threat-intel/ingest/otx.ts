/**
 * Threat Intelligence Ingestion - AlienVault OTX
 * Fetches pulses and IOCs from OTX API.
 */

import { requireAdminFirestore, adminBatch, adminDoc, adminGetAll, Timestamp, type Firestore } from '@/lib/admin-firestore';

interface OTXPulse {
  id: string;
  name: string;
  description: string;
  author_name: string;
  created: string;
  modified: string;
  public: number;
  tags: string[];
  indicators: OTXIndicator[];
}

interface OTXIndicator {
  id: string;
  indicator: string;
  type: string;
  title: string;
  description: string;
  content: string;
  access_type: string;
  access_reason: string;
  created: string;
  modified?: string;
  is_active: number;
  role: string;
}

const OTX_API_BASE = 'https://otx.alienvault.com/api/v1';
const THREAT_INTEL_COLLECTION = 'threatIntel';

const TYPE_MAP: Record<string, string> = {
  'IPv4': 'IPv4',
  'IPv6': 'IPv6',
  'domain': 'DOMAIN',
  'hostname': 'HOSTNAME',
  'URL': 'URL',
  'FileHash-MD5': 'HASH_MD5',
  'FileHash-SHA1': 'HASH_SHA1',
  'FileHash-SHA256': 'HASH_SHA256',
  'FileHash-SHA512': 'HASH_SHA512',
  'email': 'EMAIL',
  'CVE': 'CVE',
  'CIDR': 'IP_RANGE',
};

export async function ingestOTX(apiKey: string, options: { modifiedSince?: string; limit?: number } = {}): Promise<{ ingested: number; errors: number }> {
  const firestore = await requireAdminFirestore();
  let ingested = 0;
  let errors = 0;
  let page = 1;
  const perPage = 20;
  // Hard ceiling regardless of caller-supplied limit: this function runs
  // inside an HTTP request bounded by Cloud Run's 180s timeout, not a
  // long-running batch job. A real trigger with the previous defaults
  // (10 pages, no modifiedSince bound, a 40s sleep between every page)
  // measured a confirmed hang -- Cloud Run's own log showed "reached the
  // maximum request timeout" twice (the original call and Cloud
  // Scheduler's automatic retry), stuck at page 1 or 2. 4 pages is a
  // real, tested-safe ceiling; a daily job should rarely need more once
  // modifiedSince is actually bounding the window (see below).
  const maxPages = Math.min(options.limit ? Math.ceil(options.limit / perPage) : 4, 4);

  try {
    while (page <= maxPages) {
      const url = new URL(`${OTX_API_BASE}/pulses/subscribed`);
      url.searchParams.set('limit', perPage.toString());
      url.searchParams.set('page', page.toString());
      if (options.modifiedSince) {
        // OTX's real parameter name (confirmed against their published
        // API docs) -- the previous code sent `since`, which OTX's API
        // silently ignores, so every call fetched the full unbounded
        // subscribed-pulse history regardless of cadence.
        url.searchParams.set('modified_since', options.modifiedSince);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'X-OTX-API-KEY': apiKey,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        // No blocking retry-sleep on 429 here (a previous version slept
        // 60s and retried in place) -- inside a request-bound function,
        // report and stop rather than risk compounding into a hang.
        throw new Error(`OTX API returned ${response.status}: ${await response.text()}`);
      }

      const data = await response.json() as { results: OTXPulse[]; next: string | null };
      console.log(`[OTX] Page ${page}: ${data.results?.length || 0} pulses`);

      if (!data.results || data.results.length === 0) {
        break;
      }

      // Process each pulse
      for (const pulse of data.results) {
        try {
          await processPulse(firestore, pulse);
          ingested += pulse.indicators.length;
        } catch (error) {
          errors++;
          console.error(`[OTX] Error processing pulse ${pulse.id}:`, error);
        }
      }

      if (!data.next) break;
      page++;
      // No inter-page sleep: OTX's free tier allows 100 requests/hour,
      // and this loop is now hard-capped at 4 requests total -- nowhere
      // near that limit, and the sleep was the dominant cause of the
      // real timeout above.
    }

  } catch (error) {
    console.error('[OTX] Ingestion error:', error);
    errors++;
  }

  return { ingested, errors };
}

async function processPulse(firestore: Firestore, pulse: OTXPulse): Promise<void> {
  const now = Timestamp.now();
  const activeIndicators = pulse.indicators.filter(i => i.is_active);
  if (activeIndicators.length === 0) return;

  // Batched existence check: one getAll() round-trip for every indicator
  // in this pulse instead of a sequential adminGetDoc() per indicator --
  // the same fix already applied tonight to ioc/pipeline.ts's
  // processIOCBatch, for the same reason (this loop is what a real
  // scheduler trigger measured hanging inside).
  const refs = activeIndicators.map(indicator => {
    const iocType = TYPE_MAP[indicator.type] || indicator.type.toUpperCase();
    const docId = `${iocType}:${indicator.indicator}`.toLowerCase().replace(/[^a-z0-9:]/g, '_');
    return adminDoc(firestore, THREAT_INTEL_COLLECTION, docId);
  });
  const existingSnaps = await adminGetAll(firestore, refs);

  const batch = adminBatch(firestore);

  activeIndicators.forEach((indicator, i) => {
    const iocType = TYPE_MAP[indicator.type] || indicator.type.toUpperCase();
    const ref = refs[i];
    const existingData = existingSnaps[i].data();

    const sources = new Set(existingData?.sources || []);
    sources.add('OTX');

    const tags = new Set(existingData?.tags || []);
    for (const tag of pulse.tags) tags.add(tag);
    tags.add(pulse.author_name);

    batch.set(ref, {
      type: iocType,
      value: indicator.indicator,
      sources: Array.from(sources),
      confidence: Math.min(0.95, (existingData?.confidence || 0.5) + 0.1), // Boost confidence on re-seen
      tags: Array.from(tags),
      firstSeen: existingData?.firstSeen?.toDate?.()?.toISOString() || indicator.created,
      lastSeen: indicator.modified || new Date().toISOString(),
      tlp: 'WHITE',
      rawData: {
        pulseId: pulse.id,
        pulseName: pulse.name,
        pulseDescription: pulse.description,
        indicatorTitle: indicator.title,
        indicatorDescription: indicator.description,
        indicatorRole: indicator.role,
      },
      cve: iocType === 'CVE' ? { cveId: indicator.indicator } : null,
      updatedAt: now,
    }, { merge: true });
  });

  await batch.commit();
}