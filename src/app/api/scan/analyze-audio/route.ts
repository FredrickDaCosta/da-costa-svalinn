import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI service not configured." }, { status: 500 });
    }
    const systemPrompt = "You are Da-Costa Svalinn Deepfake Audio Analyzer. Analyze for AI-generated or cloned voice. Return ONLY valid JSON with no markdown, matching exactly: { verdict: 'authentic' or 'suspicious' or 'likely_deepfake' or 'confirmed_deepfake', confidence: number 0-1, risk_score: number 0-10, indicators: string[], summary: string, recommended_action: string, voice_analysis: { naturalness_score: number, cadence_anomalies: boolean, background_noise_consistent: boolean, emotional_authenticity: string } }";
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
      console.error("[analyze-audio] Gemini error:", JSON.stringify(geminiData));
      return NextResponse.json({ error: "AI service error." }, { status: 500 });
    }
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const clean = text.replace(/`json/g, "").replace(/`/g, "").trim();
    const result = JSON.parse(clean);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[analyze-audio] error:", error?.message);
    return NextResponse.json({ error: "Scan failed." }, { status: 500 });
  }
}
