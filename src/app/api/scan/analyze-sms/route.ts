import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI service not configured." }, { status: 500 });
    }
    const systemPrompt = "You are Da-Costa Svalinn SMS and Call Shield. Analyze for phone scams, 419 fraud, OTP theft, SIM swap. Return ONLY valid JSON with no markdown, matching exactly: { risk_score: number 0-10, verdict: 'safe' or 'suspicious' or 'high_risk' or 'critical', scam_type: string, summary: string, recommended_action: string, phone_analysis: { country_code: string, format_suspicious: boolean, known_pattern: string }, message_analysis: { urgency_detected: boolean, impersonation_detected: boolean, personal_info_request: boolean, trigger_phrase: string } }";
    const userPrompt = JSON.stringify(body);
    const geminiRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=" + apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: "user", parts: [{ text: userPrompt }] }],
          generationConfig: { maxOutputTokens: 1024, temperature: 0.3 },
        }),
      }
    );
    const geminiData = await geminiRes.json();
    if (!geminiRes.ok) {
      console.error("[analyze-sms] Gemini error:", JSON.stringify(geminiData));
      return NextResponse.json({ error: "AI service error." }, { status: 500 });
    }
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const clean = text.replace(/`json/g, "").replace(/`/g, "").trim();
    const result = JSON.parse(clean);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[analyze-sms] error:", error?.message);
    return NextResponse.json({ error: "Scan failed." }, { status: 500 });
  }
}
