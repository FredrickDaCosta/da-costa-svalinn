import { NextRequest, NextResponse } from "next/server";
import { callNemotron } from "@/lib/openrouter";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "AI service not configured." }, { status: 500 });
    }
    const systemPrompt = "You are Da-Costa Svalinn Deepfake Audio Analyzer. Analyze for AI-generated or cloned voice. Return ONLY valid JSON with no markdown, matching exactly: { verdict: 'authentic' or 'suspicious' or 'likely_deepfake' or 'confirmed_deepfake', confidence: number 0-1, risk_score: number 0-10, indicators: string[], summary: string, recommended_action: string, voice_analysis: { naturalness_score: number, cadence_anomalies: boolean, background_noise_consistent: boolean, emotional_authenticity: string } }";
    const userPrompt = JSON.stringify(body);
    const text = await callNemotron(systemPrompt, userPrompt, 0.3, 1024);
    const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(clean);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[analyze-audio] error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Scan failed." }, { status: 500 });
  }
}
