import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp, jsonError } from "@/lib/api-helpers";
import { DetectLureSchema } from "@/lib/api-schemas";
import { handleDetectLure } from "@/lib/scans/detect-lure";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (rateLimit(ip, 60_000, 10)) return jsonError(429, "Rate limit exceeded. Try again later.");
    const body = await req.json();
    const validation = DetectLureSchema.safeParse(body);
    if (!validation.success) return jsonError(400, validation.error.errors[0]?.message || 'Invalid request');
    const result = await handleDetectLure(body);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[detect-lure] error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Scan failed." }, { status: 500 });
  }
}
