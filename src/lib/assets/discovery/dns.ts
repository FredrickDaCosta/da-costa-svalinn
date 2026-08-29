/**
 * DNS Discovery Worker for Da-Costa Svalinn
 * Discovers subdomains and related domains for a given root domain.
 * Uses free sources: crt.sh (Certificate Transparency), DNS enumeration
 */

import { initializeFirebase } from '@/firebase';
import { createAsset, updateAssetScanStatus, Asset, AssetType, bulkCreateAssets, getAsset, listAssets } from '../registry';

interface SubdomainResult {
  subdomain: string;
  source: string;
  ip?: string;
}

/**
 * Discover subdomains via Certificate Transparency logs (crt.sh).
 */
async function discoverViaCrtSh(domain: string): Promise<SubdomainResult[]> {
  try {
    const response = await fetch(
      `https://crt.sh/?q=%.${domain}&output=json`,
      { signal: AbortSignal.timeout(15000) }
    );
    
    if (!response.ok) {
      throw new Error(`crt.sh returned ${response.status}`);
    }
    
    const data = await response.json() as Array<{ name_value: string }>;
    const subdomains = new Set<string>();
    
    for (const entry of data) {
      const names = entry.name_value.split('\n');
      for (const name of names) {
        const clean = name.trim().toLowerCase();
        if (clean.endsWith(`.${domain}`) || clean === domain) {
          subdomains.add(clean);
        }
      }
    }
    
    return Array.from(subdomains).map(sub => ({
      subdomain: sub,
      source: 'crt.sh'
    }));
  } catch (error) {
    console.error('[dns-discovery] crt.sh error:', error);
    return [];
  }
}

/**
 * Discover subdomains via DNS brute force (common prefixes).
 */
async function discoverViaBruteForce(domain: string): Promise<SubdomainResult[]> {
  const commonPrefixes = [
    'www', 'mail', 'ftp', 'localhost', 'webmail', 'smtp', 'pop', 'ns1', 'ns2',
    'dns1', 'dns2', 'mx1', 'mx2', 'imap', 'pop3', 'vpn', 'remote', 'admin',
    'portal', 'api', 'app', 'dev', 'test', 'staging', 'prod', 'beta', 'alpha',
    'dashboard', 'panel', 'cpanel', 'whm', 'plesk', 'webdisk', 'cpcalendars',
    'cpcontacts', 'autodiscover', 'autoconfig', 'mobile', 'owa', 'exchange',
    'blog', 'shop', 'store', 'support', 'help', 'docs', 'wiki', 'forum',
    'community', 'status', 'monitor', 'grafana', 'kibana', 'jenkins', 'gitlab',
    'github', 'bitbucket', 'jira', 'confluence', 'sonar', 'nexus', 'artifactory',
    'registry', 'harbor', 'rancher', 'kubernetes', 'k8s', 'rancher', 'vault',
    'consul', 'nomad', 'traefik', 'nginx', 'apache', 'haproxy', 'varnish',
    'redis', 'memcached', 'mongodb', 'mysql', 'postgres', 'postgresql', 'mssql',
    'oracle', 'db', 'database', 'sql', 'backup', 'backups', 'archive', 'old',
    'new', 'tmp', 'temp', 'cache', 'static', 'media', 'assets', 'cdn', 'img',
    'images', 'video', 'videos', 'audio', 'files', 'download', 'uploads',
    's3', 'storage', 'bucket', 'cloud', 'aws', 'azure', 'gcp', 'gcloud',
    'digitalocean', 'linode', 'vultr', 'hetzner', 'ovh', 'scaleway'
  ];
  
  const results: SubdomainResult[] = [];
  
  // Check in batches of 10 to avoid overwhelming DNS
  for (let i = 0; i < commonPrefixes.length; i += 10) {
    const batch = commonPrefixes.slice(i, i + 10);
    await Promise.all(batch.map(async (prefix) => {
      const subdomain = `${prefix}.${domain}`;
      try {
        // Use DNS over HTTPS (Google) for resolution
        const response = await fetch(
          `https://dns.google/resolve?name=${subdomain}&type=A`,
          { signal: AbortSignal.timeout(5000) }
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.Answer && data.Answer.length > 0) {
            const ip = data.Answer[0].data;
            results.push({ subdomain, source: 'brute-force', ip });
          }
        }
      } catch {
        // Ignore individual failures
      }
    }));
  }
  
  return results;
}

/**
 * Get IP addresses for a domain.
 */
async function getIpsForDomain(domain: string): Promise<string[]> {
  try {
    const response = await fetch(
      `https://dns.google/resolve?name=${domain}&type=A`,
      { signal: AbortSignal.timeout(5000) }
    );
    
    if (!response.ok) return [];
    
    const data = await response.json();
    return data.Answer?.map((a: { data: string }) => a.data) || [];
  } catch {
    return [];
  }
}

/**
 * Main DNS discovery function for a domain asset.
 */
export async function discoverDomainAssets(
  userId: string,
  rootDomain: string,
  assetId: string
): Promise<Asset[]> {
  await updateAssetScanStatus(userId, assetId, 'pending');
  
  const discovered: Asset[] = [];
  
  try {
    // 1. Certificate Transparency discovery
    const crtResults = await discoverViaCrtSh(rootDomain);
    console.log(`[dns-discovery] Found ${crtResults.length} subdomains via crt.sh for ${rootDomain}`);
    
    // 2. DNS brute force
    const bruteResults = await discoverViaBruteForce(rootDomain);
    console.log(`[dns-discovery] Found ${bruteResults.length} subdomains via brute force for ${rootDomain}`);
    
    // Combine and deduplicate
    const allSubdomains = new Map<string, SubdomainResult>();
    
    for (const result of [...crtResults, ...bruteResults]) {
      if (!allSubdomains.has(result.subdomain)) {
        allSubdomains.set(result.subdomain, result);
      }
    }
    
    // Create assets for each discovered subdomain
    const assetsToCreate: Omit<Asset, 'id' | 'discoveredAt'>[] = [];
    
    for (const [subdomain, result] of allSubdomains) {
      const ips = await getIpsForDomain(subdomain);
      
      assetsToCreate.push({
        type: 'DOMAIN' as AssetType,
        value: subdomain,
        displayName: subdomain,
        tags: ['auto-discovered', 'subdomain', result.source],
        lastScanned: null,
        scanStatus: 'never',
        metadata: {
          sourceDomain: rootDomain,
          discoverySource: result.source,
          ips,
          parentAssetId: assetId,
        },
        autoDiscovered: true,
        discoverySource: `dns:${result.source}`,
        priority: subdomain === rootDomain ? 'critical' : 'medium',
      });
    }
    
    // Bulk create
    if (assetsToCreate.length > 0) {
      const ids = await bulkCreateAssets(userId, assetsToCreate);
      
      for (let i = 0; i < ids.length; i++) {
        const asset = await getAsset(userId, ids[i]);
        if (asset) discovered.push(asset);
      }
    }
    
    await updateAssetScanStatus(userId, assetId, 'completed');
    
  } catch (error) {
    console.error('[dns-discovery] Error discovering assets:', error);
    await updateAssetScanStatus(userId, assetId, 'failed', error instanceof Error ? error.message : 'Unknown error');
  }
  
  return discovered;
}

/**
 * Scheduled discovery job - runs for all domain assets.
 */
export async function runDnsDiscoveryJob(userId: string): Promise<{ processed: number; discovered: number; errors: number }> {
  const domainAssets = await listAssets(userId, { type: 'DOMAIN', status: 'never' });
  let processed = 0;
  let discovered = 0;
  let errors = 0;
  
  for (const asset of domainAssets) {
    try {
      const newAssets = await discoverDomainAssets(userId, asset.value, asset.id || '');
      processed++;
      discovered += newAssets.length;
    } catch (error) {
      errors++;
      console.error(`[dns-discovery] Failed for ${asset.value}:`, error);
    }
  }
  
  return { processed, discovered, errors };
}