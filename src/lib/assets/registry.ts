/**
 * Asset Registry for Da-Costa Svalinn
 * Central registry of user attack surface: domains, IP ranges, GitHub repos, GCP/Azure resources.
 */

import { 
  collection, 
  doc, 
  addDoc, 
  getDoc, 
  getDocs, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  orderBy, 
  limit,
  Timestamp,
  writeBatch
} from 'firebase/firestore';
import { initializeFirebase } from '@/firebase';

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

function getAssetsRef(userId: string) {
  const { firestore } = initializeFirebase();
  return collection(firestore, 'users', userId, ASSETS_COLLECTION);
}

/**
 * Create a new asset in the registry.
 */
export async function createAsset(userId: string, asset: Omit<Asset, 'id' | 'discoveredAt'>): Promise<string> {
  const assetsRef = getAssetsRef(userId);
  const now = new Date().toISOString();
  
  const docRef = await addDoc(assetsRef, {
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
  const assetsRef = getAssetsRef(userId);
  const assetDoc = await getDoc(doc(assetsRef, assetId));
  
  if (!assetDoc.exists()) {
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
  const assetsRef = getAssetsRef(userId);
  let q = query(assetsRef, orderBy('discoveredAt', 'desc'));
  
  if (options.type) {
    q = query(q, where('type', '==', options.type));
  }
  
  if (options.tag) {
    q = query(q, where('tags', 'array-contains', options.tag));
  }
  
  if (options.status) {
    q = query(q, where('scanStatus', '==', options.status));
  }
  
  if (options.limit) {
    q = query(q, limit(options.limit));
  }
  
  const snap = await getDocs(q);
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
  const assetsRef = getAssetsRef(userId);
  await updateDoc(doc(assetsRef, assetId), {
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
 * Delete an asset.
 */
export async function deleteAsset(userId: string, assetId: string): Promise<void> {
  const assetsRef = getAssetsRef(userId);
  await deleteDoc(doc(assetsRef, assetId));
}

/**
 * Bulk create assets (for discovery workers).
 */
export async function bulkCreateAssets(
  userId: string,
  assets: Omit<Asset, 'id' | 'discoveredAt'>[]
): Promise<string[]> {
  const { firestore } = initializeFirebase();
  const assetsRef = getAssetsRef(userId);
  const batch = writeBatch(firestore);
  const now = new Date().toISOString();
  const ids: string[] = [];
  
  for (const asset of assets) {
    const docRef = doc(assetsRef);
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
  const assetsRef = getAssetsRef(userId);
  const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000).toISOString();
  
  const q = query(
    assetsRef,
    where('scanStatus', 'in', ['never', 'completed', 'failed']),
    where('priority', 'in', ['critical', 'high', 'medium']),
    orderBy('priority'),
    orderBy('lastScanned'),
    limit(100)
  );
  
  const snap = await getDocs(q);
  return snap.docs
    .map(d => ({ id: d.id, ...d.data() } as Asset))
    .filter(asset => !asset.lastScanned || asset.lastScanned < cutoff);
}

/**
 * Search assets by value (partial match).
 */
export async function searchAssets(userId: string, searchTerm: string): Promise<Asset[]> {
  const assetsRef = getAssetsRef(userId);
  // Firestore doesn't support full-text search natively
  // This does a prefix match on value
  const q = query(
    assetsRef,
    where('value', '>=', searchTerm),
    where('value', '<=', searchTerm + '\uf8ff'),
    limit(50)
  );
  
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Asset));
}

// Note: For batch operations, import from '@/firebase/admin' in server-only contexts