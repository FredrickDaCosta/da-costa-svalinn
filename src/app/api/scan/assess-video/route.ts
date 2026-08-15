import { NextRequest, NextResponse } from "next/server";
import { callNemotron } from "@/lib/openrouter";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "AI service not configured." }, { status: 500 });
    }
    const systemPrompt = "You are an elite video file auditor. Analyze this file header and metadata for security risks including codec mismatches, embedded scripts, and obfuscation. Return ONLY valid JSON with no markdown matching exactly: { match: boolean, suspicious_elements: string[], risk: number, malware_indicator: boolean }";
    const userPrompt = JSON.stringify(body);
    const text = await callNemotron(systemPrompt, userPrompt, 0.3, 1024);
    const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(clean);
    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[assess-video] error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Scan failed." }, { status: 500 });
  }
}
