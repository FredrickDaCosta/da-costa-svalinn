import { NextRequest, NextResponse } from "next/server";
import { rateLimit, getClientIp, jsonError } from "@/lib/api-helpers";
import { AnalyzeEmailSchema } from "@/lib/api-schemas";
import { handleAnalyzeEmail } from "@/lib/scans/analyze-email";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (rateLimit(ip, 60_000, 10)) return jsonError(429, "Rate limit exceeded. Try again later.");
    const rawBody = await req.json();
    const body = { emailContent: rawBody.emailContent || rawBody.content || '', senderHistory: rawBody.senderHistory };
    const validation = AnalyzeEmailSchema.safeParse(body);
    if (!validation.success) return jsonError(400, validation.error.errors[0]?.message || 'Invalid request');
    const result = await handleAnalyzeEmail(body);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[analyze-email] error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Scan failed." }, { status: 500 });
  }
}
