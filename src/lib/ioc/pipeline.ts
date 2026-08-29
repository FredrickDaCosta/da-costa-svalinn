/**
 * IOC Normalization & Deduplication Pipeline
 * Merges IOCs from module scans + TI feeds; deduplicates; boosts confidence on multi-source hits.
 */

import { initializeFirebase } from '@/firebase';
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  writeBatch, 
  Timestamp,
  orderBy,
  limit,
  updateDoc
} from 'firebase/firestore';

export type IOCType = 
  | 'IPv4' 
  | 'IPv6' 
  | 'DOMAIN' 
  | 'HOSTNAME'
  | 'URL' 
  | 'HASH_MD5' 
  | 'HASH_SHA1' 
  | 'HASH_SHA256' 
  | 'HASH_SHA512' 
  | 'EMAIL' 
  | 'CVE' 
  | 'CRYPTO_WALLET'
  | 'IP_RANGE';

export interface RawIOC {
  type: IOCType;
  value: string;
  source: string;
  confidence: number;
  tags?: string[];
  firstSeen?: string;
  lastSeen?: string;
  rawData?: Record<string, unknown>;
  cve?: Record<string, unknown> | null;
}

export interface NormalizedIOC {
  id: string; // type:value normalized
  type: IOCType;
  value: string;
  normalizedValue: string; // lowercase, defanged
  sources: string[];
  confidence: number; // max confidence across sources
  tags: string[];
  firstSeen: string;
  lastSeen: string;
  tlp: 'WHITE' | 'GREEN' | 'AMBER' | 'RED';
  rawData: Record<string, unknown>;
  cve: Record<string, unknown> | null;
  relatedIncidents: string[];
  relatedAssets: string[];
  enrichment?: {
    whois?: Record<string, unknown>;
    ssl?: Record<string, unknown>;
    reputation?: string;
    geo?: Record<string, unknown>;
  };
  updatedAt: string;
}

/**
 * Normalize an IOC value for comparison and storage.
 */
export function normalizeIOCValue(type: IOCType, value: string): string {
  let normalized = value.toLowerCase().trim();
  
  switch (type) {
    case 'URL':
      // Remove protocol, www, trailing slashes
      normalized = normalized
        .replace(/^https?:\/\//, '')
        .replace(/^www\./, '')
        .replace(/\/+$/, '');
      break;
    case 'DOMAIN':
    case 'HOSTNAME':
      normalized = normalized.replace(/^www\./, '').replace(/\.+$/, '');
      break;
    case 'EMAIL':
      normalized = normalized.toLowerCase();
      break;
    case 'IPv4':
    case 'IPv6':
    case 'IP_RANGE':
      normalized = normalized.replace(/\s+/g, '');
      break;
    case 'HASH_MD5':
    case 'HASH_SHA1':
    case 'HASH_SHA256':
    case 'HASH_SHA512':
      normalized = normalized.toLowerCase();
      break;
    case 'CVE':
      normalized = normalized.toUpperCase();
      break;
  }
  
  return normalized;
}

/**
 * Generate a stable document ID for an IOC.
 */
export function generateIOCDocId(type: IOCType, normalizedValue: string): string {
  // Use a safe encoding for Firestore document IDs
  const safeValue = normalizedValue
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .substring(0, 1500); // Firestore doc ID limit
  return `${type}:${safeValue}`;
}

/**
 * Normalize a single raw IOC.
 */
export function normalizeIOC(raw: RawIOC): NormalizedIOC {
  const normalizedValue = normalizeIOCValue(raw.type, raw.value);
  const id = generateIOCDocId(raw.type, normalizedValue);
  
  return {
    id,
    type: raw.type,
    value: raw.value,
    normalizedValue,
    sources: [raw.source],
    confidence: raw.confidence,
    tags: raw.tags || [],
    firstSeen: raw.firstSeen || new Date().toISOString(),
    lastSeen: raw.lastSeen || new Date().toISOString(),
    tlp: 'WHITE',
    rawData: raw.rawData || {},
    cve: raw.cve || null,
    relatedIncidents: [],
    relatedAssets: [],
    enrichment: undefined,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Merge two normalized IOCs (existing + new).
 */
export function mergeIOCs(existing: NormalizedIOC, incoming: RawIOC): NormalizedIOC {
  const normalizedIncoming = normalizeIOC(incoming);
  
  // Merge sources
  const sources = new Set([...existing.sources, ...normalizedIncoming.sources]);
  
  // Take maximum confidence
  const confidence = Math.max(existing.confidence, normalizedIncoming.confidence);
  
  // Union of tags
  const tags = new Set([...existing.tags, ...normalizedIncoming.tags]);
  
  // Earliest firstSeen
  const firstSeen = existing.firstSeen < normalizedIncoming.firstSeen 
    ? existing.firstSeen 
    : normalizedIncoming.firstSeen;
  
  // Latest lastSeen
  const lastSeen = existing.lastSeen > normalizedIncoming.lastSeen 
    ? existing.lastSeen 
    : normalizedIncoming.lastSeen;
  
  // Merge rawData (keep existing, add new)
  const rawData = { ...existing.rawData };
  for (const [key, value] of Object.entries(normalizedIncoming.rawData)) {
    if (!rawData[key]) {
      rawData[key] = value;
    }
  }
  
  // Merge CVE data if present
  let cve = existing.cve;
  if (normalizedIncoming.cve) {
    cve = { ...(cve || {}), ...normalizedIncoming.cve };
  }
  
  return {
    ...existing,
    sources: Array.from(sources),
    confidence,
    tags: Array.from(tags),
    firstSeen,
    lastSeen,
    rawData,
    cve,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Process a batch of raw IOCs through the normalization pipeline.
 */
export async function processIOCBatch(rawIOCs: RawIOC[]): Promise<{ processed: number; merged: number; errors: number }> {
  const { firestore } = initializeFirebase();
  const IOC_COLLECTION = 'iocs';
  
  let processed = 0;
  let merged = 0;
  let errors = 0;
  
  // Group by normalized ID for batch processing
  const groups = new Map<string, RawIOC[]>();
  
  for (const raw of rawIOCs) {
    const normalizedValue = normalizeIOCValue(raw.type, raw.value);
    const id = generateIOCDocId(raw.type, normalizedValue);
    
    if (!groups.has(id)) {
      groups.set(id, []);
    }
    groups.get(id)!.push(raw);
  }
  
  const batch = writeBatch(firestore);
  const now = Timestamp.now();
  
  for (const [id, iocs] of groups) {
    try {
      const ref = doc(firestore, IOC_COLLECTION, id);
      const existing = await getDoc(ref);
      
      // Start with first IOC in group
      let normalized = normalizeIOC(iocs[0]);
      
      // Merge remaining IOCs in group
      for (let i = 1; i < iocs.length; i++) {
        normalized = mergeIOCs(normalized, iocs[i]);
      }
      
      if (existing.exists()) {
        // Merge with existing
        const existingData = existing.data() as NormalizedIOC;
        // Create a raw IOC from existing to merge
        const existingAsRaw: RawIOC = {
          type: existingData.type,
          value: existingData.value,
          source: 'MERGE',
          confidence: existingData.confidence,
          tags: existingData.tags,
          firstSeen: existingData.firstSeen,
          lastSeen: existingData.lastSeen,
          rawData: existingData.rawData,
          cve: existingData.cve,
        };
        normalized = mergeIOCs(normalized, existingAsRaw);
        merged++;
      }
      
      batch.set(ref, {
        ...normalized,
        updatedAt: now.toDate().toISOString(),
      }, { merge: true });
      
      processed++;
      
    } catch (error) {
      errors++;
      console.error(`[IOC Pipeline] Error processing ${id}:`, error);
    }
  }
  
  await batch.commit();
  
  return { processed, merged, errors };
}

/**
 * Extract IOCs from analyst alerts and threat intel, then run pipeline.
 */
export async function runIOCPipeline(options: { 
  since?: string; 
  limit?: number;
  source?: 'alerts' | 'threatIntel' | 'both';
} = {}): Promise<{ processed: number; merged: number; errors: number }> {
  const { firestore } = initializeFirebase();
  const rawIOCs: RawIOC[] = [];
  
  const since = options.since ? new Date(options.since) : new Date(Date.now() - 24 * 60 * 60 * 1000);
  const lim = options.limit || 10000;
  
  try {
    // 1. Extract from analyst alerts
    if (!options.source || options.source === 'alerts' || options.source === 'both') {
      const alertsQuery = query(
        collection(firestore, 'analystAlerts'), // This is a root-level collection for admin
        where('createdAt', '>', Timestamp.fromDate(since)),
        orderBy('createdAt', 'desc'),
        limit(lim)
      );
      
      const alertsSnap = await getDocs(alertsQuery);
      
      for (const alertDoc of alertsSnap.docs) {
        const alert = alertDoc.data();
        if (alert.iocs && Array.isArray(alert.iocs)) {
          for (const ioc of alert.iocs) {
            rawIOCs.push({
              type: ioc.type,
              value: ioc.value,
              source: `ALERT:${alert.moduleType}`,
              confidence: ioc.confidence,
              firstSeen: ioc.firstSeen,
              rawData: { alertId: alertDoc.id },
            });
          }
        }
      }
    }
    
    // 2. Extract from threatIntel collection
    if (!options.source || options.source === 'threatIntel' || options.source === 'both') {
      const intelQuery = query(
        collection(firestore, 'threatIntel'),
        where('updatedAt', '>', Timestamp.fromDate(since)),
        orderBy('updatedAt', 'desc'),
        limit(lim)
      );
      
      const intelSnap = await getDocs(intelQuery);
      
      for (const intelDoc of intelSnap.docs) {
        const intel = intelDoc.data();
        rawIOCs.push({
          type: intel.type,
          value: intel.value,
          source: intel.sources?.[0] || 'THREAT_INTEL',
          confidence: intel.confidence,
          tags: intel.tags,
          firstSeen: intel.firstSeen,
          lastSeen: intel.lastSeen,
          rawData: intel.rawData,
          cve: intel.cve,
        });
      }
    }
    
    console.log(`[IOC Pipeline] Collected ${rawIOCs.length} raw IOCs`);
    
    if (rawIOCs.length === 0) {
      return { processed: 0, merged: 0, errors: 0 };
    }
    
    // Run the normalization pipeline
    return processIOCBatch(rawIOCs);
    
  } catch (error) {
    console.error('[IOC Pipeline] Error:', error);
    return { processed: 0, merged: 0, errors: 1 };
  }
}

/**
 * Enrich an IOC with additional data (WHOIS, SSL, GeoIP, etc.).
 */
export async function enrichIOC(iocId: string): Promise<NormalizedIOC | null> {
  const { firestore } = initializeFirebase();
  const ref = doc(firestore, 'iocs', iocId);
  const snap = await getDoc(ref);
  
  if (!snap.exists()) return null;
  
  const ioc = snap.data() as NormalizedIOC;
  const enrichment: NormalizedIOC['enrichment'] = {};
  
  // Only enrich domains and IPs
  if (ioc.type === 'DOMAIN' || ioc.type === 'URL') {
    const domain = ioc.type === 'URL' 
      ? new URL(ioc.value).hostname 
      : ioc.value;
    
    try {
      // WHOIS enrichment (reuse existing enrichment module)
      const { enrichDomain } = await import('@/lib/analyst/enrichment');
      const whois = await enrichDomain(domain);
      enrichment.whois = whois as unknown as Record<string, unknown>;
    } catch {
      // Ignore enrichment errors
    }
  }
  
  if (ioc.type === 'IPv4') {
    try {
      // GeoIP enrichment (free ip-api.com)
      const geoRes = await fetch(`http://ip-api.com/json/${ioc.value}?fields=country,regionName,city,isp,org,as,query`);
      if (geoRes.ok) {
        const geo = await geoRes.json();
        enrichment.geo = geo;
      }
    } catch {
      // Ignore
    }
  }
  
  if (Object.keys(enrichment).length > 0) {
    await updateDoc(ref, { 
      enrichment, 
      updatedAt: new Date().toISOString() 
    });
  }
  
  return { ...ioc, enrichment };
}

/**
 * Search IOCs by type, value, or tags.
 */
export async function searchIOCs(options: {
  type?: IOCType;
  value?: string; // partial match on normalized value
  tag?: string;
  source?: string;
  minConfidence?: number;
  limit?: number;
}): Promise<NormalizedIOC[]> {
  const { firestore } = initializeFirebase();
  
  let q = query(
    collection(firestore, 'iocs'),
    orderBy('lastSeen', 'desc'),
    limit(options.limit || 100)
  );
  
  if (options.type) {
    q = query(q, where('type', '==', options.type));
  }
  
  if (options.tag) {
    q = query(q, where('tags', 'array-contains', options.tag));
  }
  
  if (options.source) {
    q = query(q, where('sources', 'array-contains', options.source));
  }
  
  if (options.minConfidence !== undefined) {
    q = query(q, where('confidence', '>=', options.minConfidence));
  }
  
  // Note: Firestore doesn't support partial match on normalizedValue easily
  // For value search, we'd need to do client-side filtering or use a search index
  
  const snap = await getDocs(q);
  let results = snap.docs.map(d => d.data() as NormalizedIOC);
  
  // Client-side filter for value if provided
  if (options.value) {
    const searchTerm = options.value.toLowerCase();
    results = results.filter(ioc => 
      ioc.normalizedValue.includes(searchTerm) || 
      ioc.value.toLowerCase().includes(searchTerm)
    );
  }
  
  return results;
}