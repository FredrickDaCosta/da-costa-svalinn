/**
 * Threat Intelligence Ingestion - NVD CVE Feed
 * Fetches CVE data from NIST National Vulnerability Database.
 */

import { initializeFirebase } from '@/firebase';
import { writeBatch, doc, Timestamp, collection, getDocs, query, where } from 'firebase/firestore';

interface NVDCVE {
  cve: {
    id: string;
    sourceIdentifier: string;
    published: string;
    lastModified: string;
    vulnStatus: string;
    descriptions: Array<{ lang: string; value: string }>;
    metrics: {
      cvssMetricV31?: Array<{
        cvssData: {
          version: string;
          vectorString: string;
          attackVector: string;
          attackComplexity: string;
          privilegesRequired: string;
          userInteraction: string;
          scope: string;
          confidentialityImpact: string;
          integrityImpact: string;
          availabilityImpact: string;
          baseScore: number;
          baseSeverity: string;
        };
        exploitabilityScore: number;
        impactScore: number;
      }>;
      cvssMetricV2?: Array<{
        cvssData: {
          version: string;
          vectorString: string;
          accessVector: string;
          accessComplexity: string;
          authentication: string;
          confidentialityImpact: string;
          integrityImpact: string;
          availabilityImpact: string;
          baseScore: number;
        };
        exploitabilityScore: number;
        impactScore: number;
      }>;
    };
    weaknesses: Array<{
      source: string;
      type: string;
      description: Array<{ lang: string; value: string }>;
    }>;
    configurations: Array<{
      nodes: Array<{
        operator: string;
        cpeMatch: Array<{
          vulnerable: boolean;
          criteria: string;
          matchCriteriaId: string;
        }>;
      }>;
    }>;
    references: Array<{ url: string; source: string; tags: string[] }>;
  };
}

const NVD_API_BASE = 'https://services.nvd.nist.gov/rest/json/cves/2.0';
const CVE_COLLECTION = 'cves';
const THREAT_INTEL_COLLECTION = 'threatIntel';

export async function ingestNVDCVE(options: { startIndex?: number; resultsPerPage?: number; pubStartDate?: string; pubEndDate?: string } = {}): Promise<{ ingested: number; errors: number }> {
  const { firestore } = initializeFirebase();
  let ingested = 0;
  let errors = 0;

  try {
    const url = new URL(NVD_API_BASE);
    url.searchParams.set('resultsPerPage', (options.resultsPerPage || 1000).toString());
    if (options.startIndex) url.searchParams.set('startIndex', options.startIndex.toString());
    if (options.pubStartDate) url.searchParams.set('pubStartDate', options.pubStartDate);
    if (options.pubEndDate) url.searchParams.set('pubEndDate', options.pubEndDate);

    const response = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(120000) // NVD can be slow
    });

    if (!response.ok) {
      if (response.status === 403) {
        throw new Error('NVD API rate limited or forbidden');
      }
      throw new Error(`NVD API returned ${response.status}: ${await response.text()}`);
    }

    const data = await response.json() as { vulnerabilities: NVDCVE[]; totalResults: number };

    if (!data.vulnerabilities || data.vulnerabilities.length === 0) {
      return { ingested: 0, errors: 0 };
    }

    const batch = writeBatch(firestore);
    const now = Timestamp.now();

    for (const vuln of data.vulnerabilities) {
      try {
        const cve = vuln.cve;
        const cveId = cve.id;
        
        // Skip if already processed recently
        const existingQuery = query(
          collection(firestore, CVE_COLLECTION),
          where('cveId', '==', cveId),
          where('updatedAt', '>', Timestamp.fromMillis(Date.now() - 24 * 60 * 60 * 1000))
        );
        const existing = await getDocs(existingQuery);
        if (!existing.empty) continue;

        // Extract CVSS v3.1 score
        let cvss = 0;
        let cvssVector = '';
        let severity = 'UNKNOWN';
        let exploitabilityScore = 0;
        
        if (cve.metrics?.cvssMetricV31?.length) {
          const metric = cve.metrics.cvssMetricV31[0];
          cvss = metric.cvssData.baseScore;
          cvssVector = metric.cvssData.vectorString;
          severity = metric.cvssData.baseSeverity;
          exploitabilityScore = metric.exploitabilityScore;
        } else if (cve.metrics?.cvssMetricV2?.length) {
          const metric = cve.metrics.cvssMetricV2[0];
          cvss = metric.cvssData.baseScore;
          cvssVector = metric.cvssData.vectorString;
          exploitabilityScore = metric.exploitabilityScore;
        }

        // Extract CWEs
        const cwes = cve.weaknesses
          .flatMap(w => w.description.filter(d => d.lang === 'en').map(d => d.value))
          .filter(v => v.startsWith('CWE-'));

        // Extract affected products (CPEs)
        const affectedProducts: string[] = [];
        for (const config of cve.configurations || []) {
          for (const node of config.nodes || []) {
            for (const cpe of node.cpeMatch || []) {
              if (cpe.vulnerable) {
                affectedProducts.push(cpe.criteria);
              }
            }
          }
        }

        // Check CISA KEV (Known Exploited Vulnerabilities) - would need separate feed
        const kevListed = false; // TODO: Integrate CISA KEV feed

        // Create CVE document
        const cveRef = doc(firestore, CVE_COLLECTION, cveId);
        batch.set(cveRef, {
          cveId,
          cvss,
          cvssVector,
          severity,
          exploitabilityScore,
          cwes,
          affectedProducts,
          kevListed,
          description: cve.descriptions.find(d => d.lang === 'en')?.value || '',
          publishedAt: cve.published,
          lastModified: cve.lastModified,
          vulnStatus: cve.vulnStatus,
          references: cve.references.map(r => r.url),
          updatedAt: now,
        });

        // Also add to threatIntel for IOC correlation
        const intelRef = doc(firestore, THREAT_INTEL_COLLECTION, `CVE:${cveId}`);
        batch.set(intelRef, {
          type: 'CVE',
          value: cveId,
          sources: ['NVD'],
          confidence: 0.9,
          tags: ['cve', `severity:${severity.toLowerCase()}`, ...cwes.map(c => c.toLowerCase())],
          firstSeen: cve.published,
          lastSeen: cve.lastModified,
          tlp: 'WHITE',
          rawData: {
            cvss,
            cvssVector,
            severity,
            cwes,
            affectedProducts: affectedProducts.slice(0, 20), // Limit
            references: cve.references.slice(0, 10).map(r => r.url),
          },
          cve: {
            cvss,
            cwe: cwes[0] || 'UNKNOWN',
            exploitable: cvss >= 7.0, // High/Critical are likely exploitable
          },
          updatedAt: now,
        }, { merge: true });

        ingested++;

      } catch (error) {
        errors++;
        console.error(`[NVD] Error processing CVE ${vuln.cve.id}:`, error);
      }
    }

    await batch.commit();

  } catch (error) {
    console.error('[NVD] Ingestion error:', error);
    errors++;
  }

  return { ingested, errors };
}

/**
 * Full NVD sync - fetches all CVEs in batches.
 */
export async function fullNVDSync(): Promise<{ ingested: number; errors: number }> {
  let totalIngested = 0;
  let totalErrors = 0;
  let startIndex = 0;
  const batchSize = 1000;
  let hasMore = true;

  while (hasMore) {
    console.log(`[NVD] Fetching batch starting at ${startIndex}...`);
    const result = await ingestNVDCVE({ startIndex, resultsPerPage: batchSize });
    totalIngested += result.ingested;
    totalErrors += result.errors;
    
    if (result.ingested < batchSize) {
      hasMore = false;
    } else {
      startIndex += batchSize;
      // Rate limit: NVD allows ~10 requests/minute
      await new Promise(resolve => setTimeout(resolve, 6000));
    }
  }

  return { ingested: totalIngested, errors: totalErrors };
}

/**
 * Incremental NVD sync - only recent CVEs.
 */
export async function incrementalNVDSync(daysBack: number = 7): Promise<{ ingested: number; errors: number }> {
  const pubStartDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  return ingestNVDCVE({ pubStartDate, resultsPerPage: 2000 });
}