/**
 * Threat Intelligence Ingestion - URLhaus
 * Fetches active malware URLs from URLhaus API.
 */

import { requireAdminFirestore, adminBatch, adminDoc, Timestamp } from '@/lib/admin-firestore';

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
// Firestore hard-caps a single WriteBatch at 500 operations.
const WRITE_BATCH_CHUNK_SIZE = 500;

export async function ingestURLhaus(apiKey: string, options: { limit?: number } = {}): Promise<{ ingested: number; errors: number }> {
  const firestore = await requireAdminFirestore();
  let ingested = 0;
  let errors = 0;

  try {
    // abuse.ch requires an Auth-Key header on all their current APIs
    // (URLhaus, MalwareBazaar, ThreatFox all share this scheme) --
    // the previous unauthenticated call 401'd with {"error":"Unauthorized"}
    // (confirmed directly against the real endpoint). The endpoint is also
    // GET-only now, not POST -- confirmed the same way: a real trigger
    // with a valid key got a real 405 {"query_status":"http_get_expected"},
    // and a plain GET (even unauthenticated) got 401 instead of 405. Their
    // community feed returns at most 1000 entries from the last 3 days
    // with no request params, so options.limit is applied client-side.
    const response = await fetch(`${URLHAUS_API_BASE}/urls/recent/`, {
      method: 'GET',
      headers: { 'Auth-Key': apiKey },
      signal: AbortSignal.timeout(30000)
    });

    if (!response.ok) {
      throw new Error(`URLhaus API returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json() as URLhausPayload;
    if (options.limit && data.urls) {
      data.urls = data.urls.slice(0, options.limit);
    }

    if (data.query_status !== 'ok' || !data.urls) {
      throw new Error('URLhaus returned no URLs');
    }

    const now = Timestamp.now();
    const writes: Array<{ ref: FirebaseFirestore.DocumentReference; data: FirebaseFirestore.DocumentData }> = [];

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
        const ref = adminDoc(firestore, THREAT_INTEL_COLLECTION, docId);

        const tags = new Set<string>(['urlhaus', 'malware-url', urlEntry.threat]);
        for (const tag of urlEntry.tags) tags.add(tag.toLowerCase());

        writes.push({
          ref,
          data: {
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
          },
        });

        ingested++;
      } catch (error) {
        errors++;
        console.error(`[URLhaus] Error processing URL ${urlEntry.url}:`, error);
      }
    }

    // Firestore hard-caps a single WriteBatch at 500 ops -- URLhaus's
    // default limit (1000) can exceed that, same fix as tonight's other
    // batch-writing sources.
    for (let i = 0; i < writes.length; i += WRITE_BATCH_CHUNK_SIZE) {
      const chunk = writes.slice(i, i + WRITE_BATCH_CHUNK_SIZE);
      const batch = adminBatch(firestore);
      for (const { ref, data } of chunk) batch.set(ref, data, { merge: true });
      await batch.commit();
    }

  } catch (error) {
    console.error('[URLhaus] Ingestion error:', error);
    errors++;
  }

  return { ingested, errors };
}