import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth, jsonError } from "@/lib/api-helpers";
import { initializeFirebase } from "@/firebase";
import { runThreatIntelIngestion } from "@/lib/threat-intel/orchestrator";
import { ingestOTX } from "@/lib/threat-intel/ingest/otx";
import { ingestAbuseIPDB } from "@/lib/threat-intel/ingest/abuseipdb";
import { ingestURLhaus } from "@/lib/threat-intel/ingest/urlhaus";
import { ingestPhishTank } from "@/lib/threat-intel/ingest/phishtank";
import { incrementalNVDSync, fullNVDSync } from "@/lib/threat-intel/ingest/nvd";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const authResult = await withAdminAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const body = await req.json();
    const source = body.source || 'all';
    const options = body.options || {};

    const apiKeys = {
      otx: process.env.OTX_API_KEY,
      abuseipdb: process.env.ABUSEIPDB_API_KEY,
      phishtank: process.env.PHISHTANK_API_KEY,
    };

    let results;

    switch (source) {
      case 'otx': {
        if (!apiKeys.otx) return jsonError(400, 'OTX_API_KEY not configured');
        const result = await ingestOTX(apiKeys.otx, options);
        results = [{ source: 'OTX', ...result }];
        break;
      }
      case 'abuseipdb': {
        if (!apiKeys.abuseipdb) return jsonError(400, 'ABUSEIPDB_API_KEY not configured');
        const result = await ingestAbuseIPDB(apiKeys.abuseipdb, options);
        results = [{ source: 'ABUSEIPDB', ...result }];
        break;
      }
      case 'urlhaus': {
        const result = await ingestURLhaus(options);
        results = [{ source: 'URLHAUS', ...result }];
        break;
      }
      case 'phishtank': {
        if (!apiKeys.phishtank) return jsonError(400, 'PHISHTANK_API_KEY not configured');
        const result = await ingestPhishTank(apiKeys.phishtank, options);
        results = [{ source: 'PHISHTANK', ...result }];
        break;
      }
      case 'nvd': {
        const result = options.full ? await fullNVDSync() : await incrementalNVDSync(options.daysBack || 7);
        results = [{ source: 'NVD', ...result }];
        break;
      }
      case 'all':
      default: {
        results = await runThreatIntelIngestion(apiKeys as any, {
          fullNVD: options.fullNVD || false,
          nvdDaysBack: options.nvdDaysBack || 7,
        });
        break;
      }
    }

    return NextResponse.json({ 
      success: true, 
      results,
      timestamp: new Date().toISOString()
    });

  } catch (error: unknown) {
    console.error("[ti-ingestion] error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Threat intelligence ingestion failed." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await withAdminAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    // Return ingestion status/logs
    const { firestore } = initializeFirebase();
    const { collection, query, orderBy, limit, getDocs } = await import('firebase/firestore');
    
    const q = query(
      collection(firestore, 'tiIngestionLogs'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );
    
    const snap = await getDocs(q);
    const logs = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    return NextResponse.json({ logs });

  } catch (error: unknown) {
    console.error("[ti-ingestion] GET error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Failed to fetch ingestion logs." }, { status: 500 });
  }
}