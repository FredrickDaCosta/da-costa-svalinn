import { NextRequest, NextResponse } from "next/server";
import { callNemotron } from "@/lib/openrouter";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "AI service not configured." }, { status: 500 });
    }
    const systemPrompt = "You are Da-Costa Svalinn SMS and Call Shield. Analyze for phone scams, 419 fraud, OTP theft, SIM swap. Return ONLY valid JSON with no markdown, matching exactly: { risk_score: number 0-10, verdict: 'safe' or 'suspicious' or 'high_risk' or 'critical', scam_type: string, summary: string, recommended_action: string, phone_analysis: { country_code: string, format_suspicious: boolean, known_pattern: string }, message_analysis: { urgency_detected: boolean, impersonation_detected: boolean, personal_info_request: boolean, trigger_phrase: string } }";
    const userPrompt = JSON.stringify(body);
    const text = await callNemotron(systemPrompt, userPrompt, 0.3, 1024);
    const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(clean);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[analyze-sms] error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Scan failed." }, { status: 500 });
  }
}
