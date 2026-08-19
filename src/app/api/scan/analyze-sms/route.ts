import { NextRequest, NextResponse } from "next/server";
import { callNemotron } from "@/lib/openrouter";
import { scanUrlWithVirusTotal } from "@/lib/virustotal";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "AI service not configured." }, { status: 500 });
    }
    const urlRegex = /https?:\/\/[^\s]+/g;
    const urls: string[] = (body.messageText || body.message || body.sms || "").match(urlRegex) || [];
    const firstUrl = urls[0] || "";
    const vtPromise = firstUrl ? scanUrlWithVirusTotal(firstUrl).catch(() => null) : Promise.resolve(null);

    const systemPrompt = "You are Da-Costa Svalinn SMS and Call Shield. Analyze for phone scams, 419 fraud, OTP theft, SIM swap. Return ONLY valid JSON with no markdown, matching exactly: { risk_score: number 0-10, verdict: 'safe' or 'suspicious' or 'high_risk' or 'critical', scam_type: string, summary: string, recommended_action: string, phone_analysis: { country_code: string, format_suspicious: boolean, known_pattern: string }, message_analysis: { urgency_detected: boolean, impersonation_detected: boolean, personal_info_request: boolean, trigger_phrase: string } }";
    const userPrompt = JSON.stringify(body);
    const text = await callNemotron(systemPrompt, userPrompt, 0.3, 1024);
    const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(clean);

    const vtResult = await vtPromise;
    if (vtResult) {
      result.vt_detections = vtResult.positives;
      result.vt_total = vtResult.total;
      result.vt_engines = vtResult.detectionNames;
      if (vtResult.malicious) {
        result.verdict = "critical";
        result.risk_score = Math.max(result.risk_score ?? 0, 9);
        const engines = vtResult.detectionNames.length ? ` (${vtResult.detectionNames.join(", ")})` : "";
        result.summary = `${result.summary} Linked URL flagged malicious by VirusTotal: ${vtResult.positives}/${vtResult.total} engines${engines}.`.trim();
      }
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[analyze-sms] error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Scan failed." }, { status: 500 });
  }
}
