import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "AI service not configured." }, { status: 500 });
    }
    const systemPrompt = "You are an elite video file auditor. Analyze this file header and metadata for security risks including codec mismatches, embedded scripts, and obfuscation. Return ONLY valid JSON with no markdown matching exactly: { match: boolean, suspicious_elements: string[], risk: number, malware_indicator: boolean }";
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
      console.error("[assess-video] Gemini error:", JSON.stringify(geminiData));
      return NextResponse.json({ error: "AI service error." }, { status: 500 });
    }
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const clean = text.replace(/`json/g, "").replace(/`/g, "").trim();
    const result = JSON.parse(clean);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[assess-video] error:", error?.message);
    return NextResponse.json({ error: "Scan failed." }, { status: 500 });
  }
}
