import { NextRequest, NextResponse } from "next/server";
import { withAuth, jsonError } from "@/lib/api-helpers";
import { listAssets, createAsset, deleteAsset, getAssetsDueForScan } from "@/lib/assets/registry";
import { runDnsDiscoveryJob } from "@/lib/assets/discovery/dns";
import { runGitHubDiscoveryJob } from "@/lib/assets/discovery/github";
import { runGCPDiscoveryJob } from "@/lib/assets/discovery/gcp";
import { runAzureDiscoveryJob } from "@/lib/assets/discovery/azure";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const authResult = await withAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(req.url);
    const typeParam = searchParams.get('type');
    const type = typeParam ? typeParam as 'DOMAIN' | 'IP_RANGE' | 'GITHUB_REPO' | 'GCP_PROJECT' | 'AZURE_SUB' : undefined;
    const tagParam = searchParams.get('tag');
    const tag = tagParam || undefined;
    const statusParam = searchParams.get('status');
    const status = statusParam ? statusParam as 'never' | 'pending' | 'completed' | 'failed' : undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 50;

    const assets = await listAssets(authResult.uid, { type, tag, status, limit });
    return NextResponse.json({ assets });
  } catch (error: unknown) {
    console.error("[assets] GET error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Failed to list assets." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const authResult = await withAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const body = await req.json();
    const action = body.action;

    switch (action) {
      case 'create': {
        const { type, value, displayName, tags, metadata, priority, autoDiscovered, discoverySource } = body;
        if (!type || !value || !displayName) {
          return jsonError(400, 'type, value, and displayName are required');
        }
        const assetId = await createAsset(authResult.uid, {
          type,
          value,
          displayName,
          tags: tags || [],
          lastScanned: null,
          scanStatus: 'never',
          metadata: metadata || {},
          autoDiscovered: autoDiscovered || false,
          discoverySource,
          priority: priority || 'medium',
        });
        return NextResponse.json({ assetId });
      }
      
      case 'discover-dns': {
        const result = await runDnsDiscoveryJob(authResult.uid);
        return NextResponse.json(result);
      }
      
      case 'discover-github': {
        const { githubToken, orgs } = body;
        if (!githubToken) {
          return jsonError(400, 'githubToken is required');
        }
        const result = await runGitHubDiscoveryJob(authResult.uid, githubToken, { orgs });
        return NextResponse.json(result);
      }
      
      case 'discover-gcp': {
        const { projectId, accessToken } = body;
        if (!projectId || !accessToken) {
          return jsonError(400, 'projectId and accessToken are required');
        }
        const result = await runGCPDiscoveryJob(authResult.uid, projectId, accessToken);
        return NextResponse.json(result);
      }
      
      case 'discover-azure': {
        const { subscriptionId, accessToken } = body;
        if (!subscriptionId || !accessToken) {
          return jsonError(400, 'subscriptionId and accessToken are required');
        }
        const result = await runAzureDiscoveryJob(authResult.uid, subscriptionId, accessToken);
        return NextResponse.json(result);
      }
      
      case 'discover-all': {
        // Run all discovery jobs
        const results = await Promise.allSettled([
          runDnsDiscoveryJob(authResult.uid),
          // GitHub, GCP, Azure would need tokens from user preferences
        ]);
        return NextResponse.json({ results });
      }
      
      case 'get-due': {
        const maxAgeHours = body.maxAgeHours || 24;
        const assets = await getAssetsDueForScan(authResult.uid, maxAgeHours);
        return NextResponse.json({ assets });
      }
      
      default:
        return jsonError(400, 'Invalid action');
    }
  } catch (error: unknown) {
    console.error("[assets] POST error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Asset operation failed." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const authResult = await withAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(req.url);
    const assetId = searchParams.get('assetId');
    
    if (!assetId) {
      return jsonError(400, 'assetId is required');
    }
    
    await deleteAsset(authResult.uid, assetId);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[assets] DELETE error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Failed to delete asset." }, { status: 500 });
  }
}