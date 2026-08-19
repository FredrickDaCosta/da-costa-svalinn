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
    const url: string = body.url || body.link || "";
    // VirusTotal is optional threat intel — fires in parallel with Nemotron and
    // never blocks or fails the scan if the key is missing or the lookup errors.
    const vtPromise = url ? scanUrlWithVirusTotal(url).catch(() => null) : Promise.resolve(null);
    const systemPrompt = "You are an elite cybersecurity sentry. Analyze the provided URL for phishing, typosquatting, and brand impersonation. Return ONLY valid JSON with no markdown, matching exactly: { status: 'safe' or 'unsafe', risk_score: number 0-10, reason: string, recommended_action: 'block' or 'warn' or 'allow' }";
    const userPrompt = JSON.stringify(body);
    const text = await callNemotron(systemPrompt, userPrompt, 0.3, 1024);
    const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(clean);

    const vtResult = await vtPromise;
    if (vtResult) {
      if (vtResult.malicious && result.status === "safe") {
        result.status = "unsafe";
        result.risk_score = Math.max(result.risk_score ?? 0, 8);
        result.recommended_action = "block";
      }
      result.vt_detections = vtResult.positives;
      result.vt_total = vtResult.total;
      result.vt_engines = vtResult.detectionNames;
      if (vtResult.positives > 0) {
        const engines = vtResult.detectionNames.length ? ` (${vtResult.detectionNames.join(", ")})` : "";
        result.reason = `${result.reason} VirusTotal: ${vtResult.positives}/${vtResult.total} engines flagged this URL${engines}.`.trim();
      }
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[analyze-url] error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Scan failed." }, { status: 500 });
  }
}
