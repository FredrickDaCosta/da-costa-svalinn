import { NextRequest, NextResponse } from "next/server";
import { withAuth, jsonError, validateBody } from "@/lib/api-helpers";
import { LogScanResultSchema } from "@/lib/api-schemas";
import { processScan } from "@/lib/analyst/orchestrator";

export const dynamic = "force-dynamic";

/**
 * Runs the full analyst pipeline (IOC extraction, enrichment, triage,
 * correlation, incident creation, forensic report, persistence) for a
 * scan result the client already has (from a prior call to one of the
 * /api/scan/* modules). Replaces a direct client -> Server Action call
 * to processScan(), which was unobservable in the Network tab and
 * silently failed to even dispatch in practice -- see
 * docs/tech-debt-server-side-client-sdk-usage.md.
 */
export async function POST(req: NextRequest) {
  try {
    const authResult = await withAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const { uid } = authResult;

    const { data, error } = await validateBody(req, LogScanResultSchema);
    if (error) return error;
    const { moduleType, rawData, subject } = data;

    const result = await processScan({ userId: uid, moduleType, rawData, subject });
    return NextResponse.json({ success: true, result });
  } catch (error: unknown) {
    console.error("[log-result] error:", error instanceof Error ? error.message : String(error));
    return jsonError(500, "Failed to process scan result.");
  }
}
