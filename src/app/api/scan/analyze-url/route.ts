import { NextRequest, NextResponse } from "next/server";
import { rateLimitFirestore, getClientIp, jsonError, withAuth } from "@/lib/api-helpers";
import { AnalyzeUrlSchema } from "@/lib/api-schemas";
import { handleAnalyzeUrl } from "@/lib/scans/analyze-url";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const authResult = await withAuth(req);
    if (authResult instanceof NextResponse) return authResult;

    const ip = getClientIp(req);
    if (await rateLimitFirestore(ip, 60_000, 10)) return jsonError(429, "Rate limit exceeded. Try again later.");
    
    const rawBody = await req.json();
    const body = { url: rawBody.url || rawBody.link || '' };
    const validation = AnalyzeUrlSchema.safeParse(body);
    if (!validation.success) return jsonError(400, validation.error.errors[0]?.message || 'Invalid request');
    
    const result = await handleAnalyzeUrl(body);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[analyze-url] error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Scan failed." }, { status: 500 });
  }
}