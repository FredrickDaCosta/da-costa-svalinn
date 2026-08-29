/**
 * Threat Intelligence Ingestion - PhishTank
 * Fetches verified phishing URLs from PhishTank API.
 */

import { initializeFirebase } from '@/firebase';
import { writeBatch, doc, Timestamp } from 'firebase/firestore';

interface PhishTankEntry {
  phish_id: string;
  url: string;
  phish_detail_url: string;
  submission_time: string;
  verified: string;
  verification_time: string;
  online: string;
  target: string;
  ip_address: string;
  cidr_block: string;
  announcing_network: string;
  rir: string;
  country: string;
  detail: string;
}

const PHISHTANK_API_BASE = 'https://phishtank.org/api';
const THREAT_INTEL_COLLECTION = 'threatIntel';

export async function ingestPhishTank(apiKey: string, options: { format?: 'json' | 'xml' } = {}): Promise<{ ingested: number; errors: number }> {
  const { firestore } = initializeFirebase();
  let ingested = 0;
  let errors = 0;

  try {
    const format = options.format || 'json';
    const url = `${PHISHTANK_API_BASE}/${apiKey}/online-valid.${format}`;

    const response = await fetch(url, {
      signal: AbortSignal.timeout(60000)
    });

    if (!response.ok) {
      throw new Error(`PhishTank API returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json() as PhishTankEntry[];

    const batch = writeBatch(firestore);
    const now = Timestamp.now();

    for (const entry of data) {
      if (entry.verified !== 'yes' || entry.online !== 'yes') continue;

      try {
        let domain: string;
        try {
          domain = new URL(entry.url).hostname;
        } catch {
          continue;
        }

        const docId = `URL:${entry.url}`.toLowerCase().replace(/[^a-z0-9:]/g, '_');
        const ref = doc(firestore, THREAT_INTEL_COLLECTION, docId);

        const tags = new Set<string>(['phishtank', 'phishing', entry.target.toLowerCase()]);
        if (entry.country) tags.add(`country:${entry.country.toLowerCase()}`);

        batch.set(ref, {
          type: 'URL',
          value: entry.url,
          domain,
          sources: ['PHISHTANK'],
          confidence: 0.95,
          tags: Array.from(tags),
          firstSeen: entry.submission_time,
          lastSeen: entry.verification_time,
          tlp: 'WHITE',
          rawData: {
            phishId: entry.phish_id,
            phishDetailUrl: entry.phish_detail_url,
            target: entry.target,
            ipAddress: entry.ip_address,
            cidrBlock: entry.cidr_block,
            announcingNetwork: entry.announcing_network,
            rir: entry.rir,
            country: entry.country,
            detail: entry.detail,
          },
          cve: null,
          updatedAt: now,
        }, { merge: true });

        ingested++;
      } catch (error) {
        errors++;
        console.error(`[PhishTank] Error processing entry ${entry.phish_id}:`, error);
      }
    }

    await batch.commit();

  } catch (error) {
    console.error('[PhishTank] Ingestion error:', error);
    errors++;
  }

  return { ingested, errors };
}