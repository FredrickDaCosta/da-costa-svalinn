/**
 * Threat Intelligence Ingestion - URLhaus
 * Fetches active malware URLs from URLhaus API.
 */

import { initializeFirebase } from '@/firebase';
import { writeBatch, doc, Timestamp } from 'firebase/firestore';

interface URLhausPayload {
  query_status: string;
  urls: URLhausURL[];
}

interface URLhausURL {
  id: string;
  dateadded: string;
  url: string;
  url_status: 'online' | 'offline';
  threat: string;
  tags: string[];
  urlhaus_link: string;
  reporter: string;
}

const URLHAUS_API_BASE = 'https://urlhaus-api.abuse.ch/v1';
const THREAT_INTEL_COLLECTION = 'threatIntel';

export async function ingestURLhaus(options: { limit?: number } = {}): Promise<{ ingested: number; errors: number }> {
  const { firestore } = initializeFirebase();
  let ingested = 0;
  let errors = 0;

  try {
    // Get recent URLs (last 24 hours)
    const response = await fetch(`${URLHAUS_API_BASE}/urls/recent/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ limit: options.limit || 1000 }),
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      throw new Error(`URLhaus API returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json() as URLhausPayload;

    if (data.query_status !== 'ok' || !data.urls) {
      throw new Error('URLhaus returned no URLs');
    }

    const batch = writeBatch(firestore);
    const now = Timestamp.now();

    for (const urlEntry of data.urls) {
      if (urlEntry.url_status !== 'online') continue;

      try {
        // Extract domain from URL
        let domain: string;
        try {
          domain = new URL(urlEntry.url).hostname;
        } catch {
          continue;
        }

        const docId = `URL:${urlEntry.url}`.toLowerCase().replace(/[^a-z0-9:]/g, '_');
        const ref = doc(firestore, THREAT_INTEL_COLLECTION, docId);

        const tags = new Set<string>(['urlhaus', 'malware-url', urlEntry.threat]);
        for (const tag of urlEntry.tags) tags.add(tag.toLowerCase());

        batch.set(ref, {
          type: 'URL',
          value: urlEntry.url,
          domain,
          sources: ['URLHAUS'],
          confidence: 0.9,
          tags: Array.from(tags),
          firstSeen: urlEntry.dateadded,
          lastSeen: new Date().toISOString(),
          tlp: 'WHITE',
          rawData: {
            urlhausId: urlEntry.id,
            threat: urlEntry.threat,
            tags: urlEntry.tags,
            reporter: urlEntry.reporter,
            urlhausLink: urlEntry.urlhaus_link,
          },
          cve: null,
          updatedAt: now,
        }, { merge: true });

        ingested++;
      } catch (error) {
        errors++;
        console.error(`[URLhaus] Error processing URL ${urlEntry.url}:`, error);
      }
    }

    await batch.commit();

  } catch (error) {
    console.error('[URLhaus] Ingestion error:', error);
    errors++;
  }

  return { ingested, errors };
}