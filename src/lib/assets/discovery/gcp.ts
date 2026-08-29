/**
 * GCP Asset Discovery Worker for Da-Costa Svalinn
 * Discovers Google Cloud resources using Cloud Asset Inventory API.
 */

import { initializeFirebase } from '@/firebase';
import { createAsset, updateAssetScanStatus, Asset, AssetType } from '../registry';

interface GCPResource {
  name: string;
  assetType: string;
  project: string;
  location?: string;
  updateTime: string;
}

/**
 * Fetch GCP resources via Cloud Asset Inventory API.
 */
async function fetchGCPResources(
  projectId: string,
  accessToken: string
): Promise<GCPResource[]> {
  const resources: GCPResource[] = [];
  let pageToken: string | undefined;
  
  const assetTypes = [
    'compute.googleapis.com/Instance',
    'compute.googleapis.com/Disk',
    'compute.googleapis.com/Network',
    'compute.googleapis.com/Subnetwork',
    'compute.googleapis.com/Firewall',
    'compute.googleapis.com/Address',
    'compute.googleapis.com/ForwardingRule',
    'compute.googleapis.com/TargetPool',
    'compute.googleapis.com/BackendService',
    'compute.googleapis.com/UrlMap',
    'compute.googleapis.com/TargetHttpProxy',
    'compute.googleapis.com/TargetHttpsProxy',
    'compute.googleapis.com/SslCertificate',
    'storage.googleapis.com/Bucket',
    'sqladmin.googleapis.com/Instance',
    'container.googleapis.com/Cluster',
    'run.googleapis.com/Service',
    'cloudfunctions.googleapis.com/CloudFunction',
    'apigateway.googleapis.com/Api',
    'apigateway.googleapis.com/Gateway',
    'servicemanagement.googleapis.com/Service',
    'iam.googleapis.com/ServiceAccount',
    'secretmanager.googleapis.com/Secret',
    'pubsub.googleapis.com/Topic',
    'pubsub.googleapis.com/Subscription',
    'bigquery.googleapis.com/Dataset',
    'bigquery.googleapis.com/Table',
  ];
  
  const assetTypesParam = assetTypes.join(',');
  
  do {
    try {
      const url = new URL(`https://cloudasset.googleapis.com/v1/projects/${projectId}:batchGetAssetsHistory`);
      url.searchParams.set('assetNames', assetTypesParam);
      url.searchParams.set('contentType', 'RESOURCE');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      
      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(30000)
      });
      
      if (!response.ok) {
        throw new Error(`Cloud Asset API returned ${response.status}: ${await response.text()}`);
      }
      
      const data = await response.json();
      
      if (data.assets) {
        for (const asset of data.assets) {
          resources.push({
            name: asset.name,
            assetType: asset.assetType,
            project: projectId,
            updateTime: asset.updateTime,
          });
        }
      }
      
      pageToken = data.nextPageToken;
      
    } catch (error) {
      console.error('[gcp-discovery] Error fetching resources:', error);
      break;
    }
  } while (pageToken);
  
  return resources;
}

/**
 * Main GCP discovery function.
 */
export async function discoverGCPAssets(
  userId: string,
  projectId: string,
  accessToken: string
): Promise<Asset[]> {
  const discovered: Asset[] = [];
  
  try {
    const resources = await fetchGCPResources(projectId, accessToken);
    console.log(`[gcp-discovery] Found ${resources.length} resources in project ${projectId}`);
    
    // Group by resource type for better tagging
    const typeGroups = new Map<string, GCPResource[]>();
    for (const resource of resources) {
      const group = typeGroups.get(resource.assetType) || [];
      group.push(resource);
      typeGroups.set(resource.assetType, group);
    }
    
    // Create assets for each resource type
    for (const [assetType, resourcesOfType] of typeGroups) {
      const assetsToCreate = resourcesOfType.map(resource => ({
        type: 'GCP_PROJECT' as AssetType,
        value: resource.name,
        displayName: resource.name.split('/').pop() || resource.name,
        tags: ['auto-discovered', 'gcp', assetType.replace('googleapis.com/', '').replace('/', '-')],
        lastScanned: null,
        scanStatus: 'never',
        metadata: {
          assetName: resource.name,
          assetType: resource.assetType,
          projectId,
          location: resource.location,
          updateTime: resource.updateTime,
        },
        autoDiscovered: true,
        discoverySource: 'gcp:asset-inventory',
        priority: assetType.includes('Firewall') || assetType.includes('Instance') ? 'high' : 'medium',
      }));
      
      if (assetsToCreate.length > 0) {
        const { bulkCreateAssets } = await import('../registry');
        const ids = await bulkCreateAssets(userId, assetsToCreate);
        
        for (const id of ids) {
          const asset = await getAsset(userId, id);
          if (asset) discovered.push(asset);
        }
      }
    }
    
  } catch (error) {
    console.error('[gcp-discovery] Error discovering assets:', error);
  }
  
  return discovered;
}

async function getAsset(userId: string, assetId: string): Promise<Asset | null> {
  const { getAsset } = await import('../registry');
  return getAsset(userId, assetId);
}

export async function runGCPDiscoveryJob(
  userId: string,
  projectId: string,
  accessToken: string
): Promise<{ processed: number; discovered: number; errors: number }> {
  try {
    const discovered = await discoverGCPAssets(userId, projectId, accessToken);
    return { processed: 1, discovered: discovered.length, errors: 0 };
  } catch (error) {
    console.error('[gcp-discovery] Job failed:', error);
    return { processed: 0, discovered: 0, errors: 1 };
  }
}