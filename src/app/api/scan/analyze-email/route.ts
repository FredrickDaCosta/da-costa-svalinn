import { NextRequest, NextResponse } from "next/server";
import { callNemotron } from "@/lib/openrouter";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "AI service not configured." }, { status: 500 });
    }
    const systemPrompt = "You are an elite cybersecurity sentry specializing in BEC detection and email analysis. Analyze the email for impersonation and threats. Return ONLY valid JSON with no markdown, matching exactly: { status: 'safe' or 'suspicious' or 'high_risk', sender_match: boolean, tone_deviation_score: number 0-1, impersonation_risk: 'low' or 'medium' or 'high', suspicious_request: boolean, risk_factors: string[], summary: string, recommended_action: 'verify_sender' or 'block' or 'report' or 'proceed', confidence: number 0-1 }";
    const userPrompt = JSON.stringify(body);
    const text = await callNemotron(systemPrompt, userPrompt, 0.3, 1024);
    const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(clean);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[analyze-email] error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Scan failed." }, { status: 500 });
  }
}
