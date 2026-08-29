/**
 * GitHub Discovery Worker for Da-Costa Svalinn
 * Discovers GitHub repositories for a user/organization.
 */

import { initializeFirebase } from '@/firebase';
import { createAsset, updateAssetScanStatus, Asset, AssetType } from '../registry';

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description: string | null;
  default_branch: string;
  updated_at: string;
  topics: string[];
  visibility: 'public' | 'private';
}

/**
 * Fetch user's repositories from GitHub API.
 */
async function fetchUserRepositories(githubToken: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;
  const perPage = 100;
  
  while (true) {
    try {
      const response = await fetch(
        `https://api.github.com/user/repos?per_page=${perPage}&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
        {
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Da-Costa-Svalinn/1.0'
          },
          signal: AbortSignal.timeout(15000)
        }
      );
      
      if (!response.ok) {
        if (response.status === 403) {
          // Rate limited
          const resetTime = response.headers.get('X-RateLimit-Reset');
          const waitTime = resetTime ? (parseInt(resetTime) * 1000 - Date.now()) : 60000;
          console.log(`[github-discovery] Rate limited, waiting ${waitTime}ms`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }
        throw new Error(`GitHub API returned ${response.status}: ${await response.text()}`);
      }
      
      const pageRepos = await response.json() as GitHubRepo[];
      if (pageRepos.length === 0) break;
      
      repos.push(...pageRepos);
      page++;
      
      // Check if we've got all repos
      if (pageRepos.length < perPage) break;
      
    } catch (error) {
      console.error('[github-discovery] Error fetching repos:', error);
      break;
    }
  }
  
  return repos;
}

/**
 * Fetch organization repositories.
 */
async function fetchOrgRepositories(githubToken: string, org: string): Promise<GitHubRepo[]> {
  const repos: GitHubRepo[] = [];
  let page = 1;
  const perPage = 100;
  
  while (true) {
    try {
      const response = await fetch(
        `https://api.github.com/orgs/${org}/repos?per_page=${perPage}&page=${page}&type=all`,
        {
          headers: {
            'Authorization': `Bearer ${githubToken}`,
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Da-Costa-Svalinn/1.0'
          },
          signal: AbortSignal.timeout(15000)
        }
      );
      
      if (!response.ok) {
        throw new Error(`GitHub API returned ${response.status}`);
      }
      
      const pageRepos = await response.json() as GitHubRepo[];
      if (pageRepos.length === 0) break;
      
      repos.push(...pageRepos);
      page++;
      
      if (pageRepos.length < perPage) break;
      
    } catch (error) {
      console.error('[github-discovery] Error fetching org repos:', error);
      break;
    }
  }
  
  return repos;
}

/**
 * Main GitHub discovery function.
 */
export async function discoverGitHubAssets(
  userId: string,
  githubToken: string,
  options: { orgs?: string[] } = {}
): Promise<Asset[]> {
  const discovered: Asset[] = [];
  
  try {
    // Get user's repos
    const userRepos = await fetchUserRepositories(githubToken);
    console.log(`[github-discovery] Found ${userRepos.length} user repositories`);
    
    // Get org repos if specified
    let orgRepos: GitHubRepo[] = [];
    for (const org of options.orgs || []) {
      const repos = await fetchOrgRepositories(githubToken, org);
      orgRepos.push(...repos);
      console.log(`[github-discovery] Found ${repos.length} repositories for org ${org}`);
    }
    
    const allRepos = [...userRepos, ...orgRepos];
    
    // Create assets for each repository
    const assetsToCreate = allRepos.map(repo => ({
      type: 'GITHUB_REPO' as AssetType,
      value: repo.full_name,
      displayName: repo.name,
      tags: ['auto-discovered', 'github', repo.visibility, ...repo.topics],
      lastScanned: null,
      scanStatus: 'never',
      metadata: {
        repoId: repo.id,
        htmlUrl: repo.html_url,
        description: repo.description,
        defaultBranch: repo.default_branch,
        visibility: repo.visibility,
        topics: repo.topics,
        updatedAt: repo.updated_at,
        owner: repo.full_name.split('/')[0],
      },
      autoDiscovered: true,
      discoverySource: 'github:api',
      priority: repo.private ? 'high' : 'medium',
    }));
    
    // Bulk create
    if (assetsToCreate.length > 0) {
      const { bulkCreateAssets } = await import('../registry');
      const ids = await bulkCreateAssets(userId, assetsToCreate);
      
      for (const id of ids) {
        const asset = await getAsset(userId, id);
        if (asset) discovered.push(asset);
      }
    }
    
  } catch (error) {
    console.error('[github-discovery] Error discovering assets:', error);
  }
  
  return discovered;
}

/**
 * Get asset by ID.
 */
async function getAsset(userId: string, assetId: string): Promise<Asset | null> {
  const { getAsset } = await import('../registry');
  return getAsset(userId, assetId);
}

/**
 * Scheduled GitHub discovery job.
 */
export async function runGitHubDiscoveryJob(
  userId: string, 
  githubToken: string,
  options?: { orgs?: string[] }
): Promise<{ processed: number; discovered: number; errors: number }> {
  let errors = 0;
  
  try {
    const discovered = await discoverGitHubAssets(userId, githubToken, options);
    return { processed: 1, discovered: discovered.length, errors: 0 };
  } catch (error) {
    console.error('[github-discovery] Job failed:', error);
    return { processed: 0, discovered: 0, errors: 1 };
  }
}