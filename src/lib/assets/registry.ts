/**
 * Asset Registry for Da-Costa Svalinn
 * Central registry of user attack surface: domains, IP ranges, GitHub repos, GCP/Azure resources.
 */

import { Timestamp, type Firestore } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase-admin';

export type AssetType = 'DOMAIN' | 'IP_RANGE' | 'GITHUB_REPO' | 'GCP_PROJECT' | 'AZURE_SUB';

export interface AssetMetadata {
  // Domain-specific
  registrar?: string;
  nameservers?: string[];
  sslEnabled?: boolean;
  sslIssuer?: string;
  sslExpiry?: string;

  // IP-specific
  asn?: string;
  isp?: string;
  country?: string;

  // GitHub-specific
  owner?: string;
  repo?: string;
  visibility?: 'public' | 'private';
  defaultBranch?: string;

  // Cloud-specific
  projectId?: string;
  region?: string;
  services?: string[];

  // Generic
  [key: string]: unknown;
}

export interface Asset {
  id?: string;
  type: AssetType;
  value: string;
  displayName: string;
  tags: string[];
  discoveredAt: string;
  lastScanned: string | null;
  scanStatus: 'never' | 'pending' | 'completed' | 'failed';
  metadata: AssetMetadata;
  autoDiscovered: boolean;
  discoverySource?: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
}

const ASSETS_COLLECTION = 'assets';

async function getAssetsRef(userId: string) {
  const firestore = await getAdminFirestore();
  if (!firestore) throw new Error('Admin Firestore unavailable');
  return firestore.collection('users').doc(userId).collection(ASSETS_COLLECTION);
}

/**
 * Create a new asset in the registry.
 */
export async function createAsset(userId: string, asset: Omit<Asset, 'id' | 'discoveredAt'>): Promise<string> {
  const assetsRef = await getAssetsRef(userId);
  const now = new Date().toISOString();

  const docRef = await assetsRef.add({
    ...asset,
    discoveredAt: now,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });

  return docRef.id;
}

/**
 * Get a single asset by ID.
 */
export async function getAsset(userId: string, assetId: string): Promise<Asset | null> {
  const assetsRef = await getAssetsRef(userId);
  const assetDoc = await assetsRef.doc(assetId).get();

  if (!assetDoc.exists) {
    return null;
  }

  return { id: assetDoc.id, ...assetDoc.data() } as Asset;
}

/**
 * List assets for a user with optional filters.
 */
export async function listAssets(
  userId: string,
  options: {
    type?: AssetType;
    tag?: string;
    status?: Asset['scanStatus'];
    limit?: number;
  } = {}
): Promise<Asset[]> {
  const assetsRef = await getAssetsRef(userId);
  let q: FirebaseFirestore.Query = assetsRef.orderBy('discoveredAt', 'desc');

  if (options.type) {
    q = q.where('type', '==', options.type);
  }

  if (options.tag) {
    q = q.where('tags', 'array-contains', options.tag);
  }

  if (options.status) {
    q = q.where('scanStatus', '==', options.status);
  }

  if (options.limit) {
    q = q.limit(options.limit);
  }

  const snap = await q.get();
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Asset));
}

/**
 * Update an asset.
 */
export async function updateAsset(
  userId: string,
  assetId: string,
  updates: Partial<Omit<Asset, 'id' | 'discoveredAt'>>
): Promise<void> {
  const assetsRef = await getAssetsRef(userId);
  await assetsRef.doc(assetId).update({
    ...updates,
    updatedAt: Timestamp.now(),
  });
}

/**
 * Update asset scan status.
 */
export async function updateAssetScanStatus(
  userId: string,
  assetId: string,
  status: Asset['scanStatus'],
  error?: string
): Promise<void> {
  const updates: Partial<Asset> = {
    scanStatus: status,
    lastScanned: new Date().toISOString(),
  };

  if (error) {
    updates.metadata = { ...((await getAsset(userId, assetId))?.metadata || {}), lastError: error };
  }

  await updateAsset(userId, assetId, updates);
}

/**
 * Atomically claim an asset for scanning, or refuse if it was already
 * scanned within `minIntervalHours` (including "already claimed by
 * another in-flight request a moment ago").
 *
 * A plain read-then-write ("check lastScanned, then update it") is not
 * safe against two near-simultaneous scheduled-scan requests -- both
 * could read the same stale lastScanned before either has written its
 * own, and both proceed to scan. This runs the check-and-write as one
 * Firestore transaction, so only one of two concurrent callers ever
 * observes lastScanned as "not recent enough" and wins the claim; the
 * other's transaction re-reads inside the same attempt and correctly
 * sees the just-written value.
 *
 * Returns true if the caller should proceed to scan (and has already
 * stamped lastScanned + scanStatus:'pending' as of this call -- the
 * caller does not need to write those again before scanning, only
 * updateAssetScanStatus() with the final 'completed'/'failed' status
 * once done). Returns false if the asset was scanned too recently or
 * is already claimed by another in-flight request.
 */
export async function claimAssetForScan(
  userId: string,
  assetId: string,
  minIntervalHours: number
): Promise<boolean> {
  const firestore = await getAdminFirestore();
  if (!firestore) throw new Error('Admin Firestore unavailable');

  const ref = firestore.collection('users').doc(userId).collection(ASSETS_COLLECTION).doc(assetId);
  const cutoff = Date.now() - minIntervalHours * 60 * 60 * 1000;

  return firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return false;

    const lastScanned = (snap.data() as Asset).lastScanned;
    if (lastScanned && new Date(lastScanned).getTime() > cutoff) {
      return false; // scanned (or claimed) too recently
    }

    tx.update(ref, {
      lastScanned: new Date().toISOString(),
      scanStatus: 'pending',
      updatedAt: Timestamp.now(),
    });
    return true;
  });
}

/**
 * Delete an asset.
 */
export async function deleteAsset(userId: string, assetId: string): Promise<void> {
  const assetsRef = await getAssetsRef(userId);
  await assetsRef.doc(assetId).delete();
}

/**
 * Bulk create assets (for discovery workers).
 */
export async function bulkCreateAssets(
  userId: string,
  assets: Omit<Asset, 'id' | 'discoveredAt'>[]
): Promise<string[]> {
  const firestore = await getAdminFirestore();
  if (!firestore) throw new Error('Admin Firestore unavailable');
  const assetsRef = await getAssetsRef(userId);
  const batch = firestore.batch();
  const now = new Date().toISOString();
  const ids: string[] = [];

  for (const asset of assets) {
    const docRef = assetsRef.doc();
    ids.push(docRef.id);
    batch.set(docRef, {
      ...asset,
      discoveredAt: now,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }

  await batch.commit();
  return ids;
}

/**
 * Get assets due for scanning (never scanned or older than interval).
 */
export async function getAssetsDueForScan(
  userId: string,
  maxAgeHours: number = 24
): Promise<Asset[]> {
  const assetsRef = await getAssetsRef(userId);
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();

  const snap = await assetsRef
    .where('scanStatus', 'in', ['never', 'completed', 'failed'])
    .where('priority', 'in', ['critical', 'high', 'medium'])
    .orderBy('priority')
    .orderBy('lastScanned')
    .limit(100)
    .get();

  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Asset))
    .filter(asset => !asset.lastScanned || asset.lastScanned < cutoff);
}

/**
 * Search assets by value (partial match).
 */
export async function searchAssets(userId: string, searchTerm: string): Promise<Asset[]> {
  const assetsRef = await getAssetsRef(userId);
  // Firestore doesn't support full-text search natively
  // This does a prefix match on value
  const snap = await assetsRef
    .where('value', '>=', searchTerm)
    .where('value', '<=', searchTerm + '')
    .limit(50)
    .get();

  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Asset));
}
