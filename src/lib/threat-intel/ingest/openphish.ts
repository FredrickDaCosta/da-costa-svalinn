/**
 * Threat Intelligence Ingestion - OpenPhish
 * Fetches active phishing URLs from OpenPhish's free community feed.
 *
 * Replaces PhishTank as the phishing-URL source: PhishTank closed new
 * user registration, so no API key can be obtained for it (see
 * ingest/phishtank.ts, left in place but dormant pending them reopening
 * registration -- an external platform restriction, not a code or
 * credential issue on our end). OpenPhish's community feed needs no
 * account, no key, no registration -- feed.txt is a plain-text list,
 * one URL per line, refreshed periodically by OpenPhish themselves.
 */

import { requireAdminFirestore, adminBatch, adminDoc, Timestamp } from '@/lib/admin-firestore';

const OPENPHISH_FEED_URL = 'https://openphish.com/feed.txt';
const THREAT_INTEL_COLLECTION = 'threatIntel';
// Firestore hard-caps a single WriteBatch at 500 operations -- OpenPhish's
// free feed commonly runs into the thousands of active URLs, so writes
// are chunked the same way tonight's ioc/pipeline.ts fix was.
const WRITE_BATCH_CHUNK_SIZE = 500;

export async function ingestOpenPhish(options: { limit?: number } = {}): Promise<{ ingested: number; errors: number }> {
  const firestore = await requireAdminFirestore();
  let ingested = 0;
  let errors = 0;

  try {
    const response = await fetch(OPENPHISH_FEED_URL, {
      headers: {
        // Not required by OpenPhish specifically, but some threat-intel
        // providers rate-limit or block generic/blank User-Agent strings
        // (the lesson from this session's PhishTank/URLhaus research).
        'User-Agent': 'DaCostaSvalinn-ThreatIntel/1.0 (+https://dacosta-svalinn.com)',
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`OpenPhish feed returned ${response.status}: ${await response.text()}`);
    }

    const text = await response.text();
    const urls = text
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .slice(0, options.limit || 5000);

    if (urls.length === 0) {
      return { ingested: 0, errors: 0 };
    }

    const now = Timestamp.now();
    const writes: Array<{ ref: FirebaseFirestore.DocumentReference; data: FirebaseFirestore.DocumentData }> = [];

    for (const rawUrl of urls) {
      try {
        let domain: string;
        try {
          domain = new URL(rawUrl).hostname;
        } catch {
          continue;
        }

        const docId = `URL:${rawUrl}`.toLowerCase().replace(/[^a-z0-9:]/g, '_');
        const ref = adminDoc(firestore, THREAT_INTEL_COLLECTION, docId);

        writes.push({
          ref,
          data: {
            type: 'URL',
            value: rawUrl,
            domain,
            sources: ['OPENPHISH'],
            // OpenPhish's free feed lists currently-active phishing URLs
            // without individual verification metadata (unlike PhishTank's
            // community-voted "verified" flag) -- slightly lower
            // confidence than URLhaus/PhishTank's own explicit verification.
            confidence: 0.8,
            tags: ['openphish', 'phishing'],
            // The plain-text feed carries no per-entry timestamp, only a
            // point-in-time snapshot of currently-active URLs -- ingestion
            // time is the closest real signal available.
            firstSeen: now.toDate().toISOString(),
            lastSeen: now.toDate().toISOString(),
            tlp: 'WHITE',
            rawData: { feedUrl: OPENPHISH_FEED_URL },
            cve: null,
            updatedAt: now,
          },
        });

        ingested++;
      } catch (error) {
        errors++;
        console.error(`[OpenPhish] Error processing URL ${rawUrl}:`, error);
      }
    }

    for (let i = 0; i < writes.length; i += WRITE_BATCH_CHUNK_SIZE) {
      const chunk = writes.slice(i, i + WRITE_BATCH_CHUNK_SIZE);
      const batch = adminBatch(firestore);
      for (const { ref, data } of chunk) {
        batch.set(ref, data, { merge: true });
      }
      await batch.commit();
    }

  } catch (error) {
    console.error('[OpenPhish] Ingestion error:', error);
    errors++;
  }

  return { ingested, errors };
}
