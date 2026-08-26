import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp, jsonError } from "@/lib/api-helpers";
import { AssessVideoSchema } from "@/lib/api-schemas";
import { handleAssessVideo } from "@/lib/scans/assess-video";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (rateLimit(ip, 60_000, 10)) return jsonError(429, "Rate limit exceeded. Try again later.");
    const body = await req.json();
    const validation = AssessVideoSchema.safeParse(body);
    if (!validation.success) return jsonError(400, validation.error.errors[0]?.message || 'Invalid request');
    const result = await handleAssessVideo(body);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[assess-video] error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Scan failed." }, { status: 500 });
  }
}
