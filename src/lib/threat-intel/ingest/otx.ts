/**
 * Threat Intelligence Ingestion - AlienVault OTX
 * Fetches pulses and IOCs from OTX API.
 */

import { initializeFirebase } from '@/firebase';
import { collection, addDoc, query, where, getDocs, Timestamp, writeBatch, doc } from 'firebase/firestore';

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
  is_active: number;
  role: string;
}

const OTX_API_BASE = 'https://otx.alienvault.com/api/v1';
const THREAT_INTEL_COLLECTION = 'threatIntel';

const TYPE_MAP: Record<string, string> = {
  'IPv4': 'IPv4',
  'IPv6': 'IPv6',
  'domain': 'DOMAIN',
  'hostname': 'DOMAIN',
  'URL': 'URL',
  'FileHash-MD5': 'HASH_MD5',
  'FileHash-SHA1': 'HASH_SHA1',
  'FileHash-SHA256': 'HASH_SHA256',
  'FileHash-SHA512': 'HASH_SHA512',
  'email': 'EMAIL',
  'CVE': 'CVE',
  'CIDR': 'IP_RANGE',
};

export async function ingestOTX(apiKey: string, options: { since?: string; limit?: number } = {}): Promise<{ ingested: number; errors: number }> {
  const { firestore } = initializeFirebase();
  let ingested = 0;
  let errors = 0;
  let page = 1;
  const perPage = 20;
  const maxPages = options.limit ? Math.ceil(options.limit / perPage) : 10;

  try {
    while (page <= maxPages) {
      const url = new URL(`${OTX_API_BASE}/pulses/subscribed`);
      url.searchParams.set('limit', perPage.toString());
      url.searchParams.set('page', page.toString());
      if (options.since) {
        url.searchParams.set('since', options.since);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'X-OTX-API-KEY': apiKey,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(30000)
      });

      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited - wait and retry
          await new Promise(resolve => setTimeout(resolve, 60000));
          continue;
        }
        throw new Error(`OTX API returned ${response.status}: ${await response.text()}`);
      }

      const data = await response.json() as { results: OTXPulse[]; next: string | null };
      
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

      // Rate limiting - OTX allows 100 requests/hour for free tier
      await new Promise(resolve => setTimeout(resolve, 40000)); // ~1.5 req/min
    }

  } catch (error) {
    console.error('[OTX] Ingestion error:', error);
    errors++;
  }

  return { ingested, errors };
}

async function processPulse(firestore: ReturnType<typeof initializeFirebase>['firestore'], pulse: OTXPulse): Promise<void> {
  const batch = writeBatch(firestore);
  const now = Timestamp.now();

  for (const indicator of pulse.indicators) {
    if (!indicator.is_active) continue;

    const iocType = TYPE_MAP[indicator.type] || indicator.type.toUpperCase();
    const docId = `${iocType}:${indicator.indicator}`.toLowerCase().replace(/[^a-z0-9:]/g, '_');
    const ref = doc(firestore, THREAT_INTEL_COLLECTION, docId);

    // Check if IOC already exists
    const existing = await ref.get();
    const existingData = existing.data();

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
  }

  await batch.commit();
}

import { doc } from 'firebase/firestore';