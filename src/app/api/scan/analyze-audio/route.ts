import { NextRequest, NextResponse } from "next/server";
import { rateLimitFirestore, getClientIp, jsonError, withAuth } from "@/lib/api-helpers";
import { enforceBlocklist } from "@/lib/analyst/blocklist-check";
import { AnalyzeAudioSchema } from "@/lib/api-schemas";
import { handleAnalyzeAudio } from "@/lib/scans/analyze-audio";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const authResult = await withAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const ip = getClientIp(req);
    if (await rateLimitFirestore(ip, 60_000, 10)) return jsonError(429, "Rate limit exceeded. Try again later.");

    const body = await req.json();
    const validation = AnalyzeAudioSchema.safeParse(body);
    if (!validation.success) return jsonError(400, validation.error.errors[0]?.message || 'Invalid request');

    // NOTE: see blocklist-check.ts's deriveLookup() deepfake caveat —
    // this request carries no genuine per-audio `subject`, so this
    // will safely miss (never false-block) until the client sends one.
    const blocked = await enforceBlocklist(req, authResult.uid, 'deepfake', body);
    if (blocked) return blocked;

    const result = await handleAnalyzeAudio(body);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[analyze-audio] error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Scan failed." }, { status: 500 });
  }
}