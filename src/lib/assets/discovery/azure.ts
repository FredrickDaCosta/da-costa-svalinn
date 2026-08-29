/**
 * Azure Discovery Worker for Da-Costa Svalinn
 * Discovers Azure resources using Azure Resource Graph / Management API.
 */

import { initializeFirebase } from '@/firebase';
import { createAsset, updateAssetScanStatus, Asset, AssetType, bulkCreateAssets, getAsset } from '../registry';

interface AzureResource {
  id: string;
  name: string;
  type: string;
  location: string;
  resourceGroup: string;
  subscriptionId: string;
  tags: Record<string, string>;
}

/**
 * Fetch Azure resources via Azure Resource Graph.
 */
async function fetchAzureResources(
  subscriptionId: string,
  accessToken: string
): Promise<AzureResource[]> {
  const resources: AzureResource[] = [];
  
  const query = `
    Resources
    | project id, name, type, location, resourceGroup, subscriptionId, tags
    | where subscriptionId == '${subscriptionId}'
  `;
  
  try {
    const response = await fetch(
      `https://management.azure.com/providers/Microsoft.ResourceGraph/resources?api-version=2021-03-01`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query,
          subscriptions: [subscriptionId],
          options: { resultFormat: 'objectArray' }
        }),
        signal: AbortSignal.timeout(30000)
      }
    );
    
    if (!response.ok) {
      throw new Error(`Azure Resource Graph returned ${response.status}: ${await response.text()}`);
    }
    
    const data = await response.json();
    
    if (data.data && Array.isArray(data.data)) {
      for (const item of data.data) {
        resources.push({
          id: item.id,
          name: item.name,
          type: item.type,
          location: item.location,
          resourceGroup: item.resourceGroup,
          subscriptionId: item.subscriptionId,
          tags: item.tags || {},
        });
      }
    }
    
  } catch (error) {
    console.error('[azure-discovery] Error fetching resources:', error);
  }
  
  return resources;
}

/**
 * Main Azure discovery function.
 */
export async function discoverAzureAssets(
  userId: string,
  subscriptionId: string,
  accessToken: string
): Promise<Asset[]> {
  const discovered: Asset[] = [];
  
  try {
    const resources = await fetchAzureResources(subscriptionId, accessToken);
    console.log(`[azure-discovery] Found ${resources.length} resources in subscription ${subscriptionId}`);
    
    // Group by resource type
    const typeGroups = new Map<string, AzureResource[]>();
    for (const resource of resources) {
      const group = typeGroups.get(resource.type) || [];
      group.push(resource);
      typeGroups.set(resource.type, group);
    }
    
    // Create assets for each resource type
    for (const [assetType, resourcesOfType] of typeGroups) {
      const assetsToCreate = resourcesOfType.map(resource => ({
        type: 'AZURE_SUB' as AssetType,
        value: resource.id,
        displayName: resource.name,
        tags: ['auto-discovered', 'azure', assetType.replace('Microsoft.', '').replace('/', '-'), resource.resourceGroup],
        lastScanned: null,
        scanStatus: 'never' as const,
        metadata: {
          resourceId: resource.id,
          resourceType: assetType,
          resourceGroup: resource.resourceGroup,
          subscriptionId,
          location: resource.location,
          tags: resource.tags,
        },
        autoDiscovered: true,
        discoverySource: 'azure:resource-graph',
        priority: assetType.includes('Security') || assetType.includes('Firewall') || assetType.includes('KeyVault') ? 'high' : 'medium',
      })) as Omit<Asset, 'id' | 'discoveredAt'>[];
      
      if (assetsToCreate.length > 0) {
        const ids = await bulkCreateAssets(userId, assetsToCreate);
        
        for (const id of ids) {
          const asset = await getAsset(userId, id);
          if (asset) discovered.push(asset);
        }
      }
    }
    
  } catch (error) {
    console.error('[azure-discovery] Error discovering assets:', error);
  }
  
  return discovered;
}

export async function runAzureDiscoveryJob(
  userId: string,
  subscriptionId: string,
  accessToken: string
): Promise<{ processed: number; discovered: number; errors: number }> {
  try {
    const discovered = await discoverAzureAssets(userId, subscriptionId, accessToken);
    return { processed: 1, discovered: discovered.length, errors: 0 };
  } catch (error) {
    console.error('[azure-discovery] Job failed:', error);
    return { processed: 0, discovered: 0, errors: 1 };
  }
}