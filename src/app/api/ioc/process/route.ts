import { NextRequest, NextResponse } from "next/server";
import { withAdminAuth, jsonError } from "@/lib/api-helpers";
import { runIOCPipeline, searchIOCs, enrichIOC, IOCType } from "@/lib/ioc/pipeline";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const authResult = await withAdminAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const body = await req.json();
    const action = body.action || 'run';

    switch (action) {
      case 'run': {
        const result = await runIOCPipeline({
          since: body.since,
          limit: body.limit,
          source: body.source,
        });
        return NextResponse.json({ success: true, ...result });
      }
      
      case 'enrich': {
        const { iocId } = body;
        if (!iocId) return jsonError(400, 'iocId is required');
        const enriched = await enrichIOC(iocId);
        return NextResponse.json({ success: true, ioc: enriched });
      }
      
      default:
        return jsonError(400, 'Invalid action');
    }

  } catch (error: unknown) {
    console.error("[ioc-pipeline] POST error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "IOC pipeline operation failed." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const authResult = await withAdminAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const { searchParams } = new URL(req.url);
    const type = searchParams.get('type') as IOCType | null;
    const value = searchParams.get('value');
    const tag = searchParams.get('tag');
    const source = searchParams.get('source');
    const minConfidence = searchParams.get('minConfidence');
    const limit = searchParams.get('limit');

    const results = await searchIOCs({
      type: type || undefined,
      value: value || undefined,
      tag: tag || undefined,
      source: source || undefined,
      minConfidence: minConfidence ? parseFloat(minConfidence) : undefined,
      limit: limit ? parseInt(limit, 10) : 100,
    });

    return NextResponse.json({ iocs: results });

  } catch (error: unknown) {
    console.error("[ioc-pipeline] GET error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Failed to search IOCs." }, { status: 500 });
  }
}