import { NextRequest, NextResponse } from "next/server";
import { rateLimitFirestore, getClientIp, jsonError, withAuth } from "@/lib/api-helpers";
import { enforceBlocklist } from "@/lib/analyst/blocklist-check";
import { AnalyzeEmailSchema } from "@/lib/api-schemas";
import { handleAnalyzeEmail } from "@/lib/scans/analyze-email";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const authResult = await withAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const ip = getClientIp(req);
    if (await rateLimitFirestore(ip, 60_000, 10)) return jsonError(429, "Rate limit exceeded. Try again later.");

    const rawBody = await req.json();
    const body = { emailContent: rawBody.emailContent || rawBody.content || '', senderHistory: rawBody.senderHistory };
    const validation = AnalyzeEmailSchema.safeParse(body);
    if (!validation.success) return jsonError(400, validation.error.errors[0]?.message || 'Invalid request');

    // NOTE: see blocklist-check.ts's deriveLookup() email caveat — the
    // write side never captures a real sender, so this will safely
    // miss (never false-block) until that's fixed separately.
    const blocked = await enforceBlocklist(req, authResult.uid, 'email', body);
    if (blocked) return blocked;

    const result = await handleAnalyzeEmail(body);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[analyze-email] error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Scan failed." }, { status: 500 });
  }
}