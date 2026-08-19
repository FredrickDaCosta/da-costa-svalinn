import { NextRequest, NextResponse } from "next/server";
import { callNemotron } from "@/lib/openrouter";
import { checkEmailAuthentication } from "@/lib/dns-check";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!process.env.OPENROUTER_API_KEY) {
      return NextResponse.json({ error: "AI service not configured." }, { status: 500 });
    }
    // Sender domain isn't a dedicated field — pull the first address out of the
    // raw email content so DNS auth checking is optional and never fails the scan.
    const emailContent: string = body.emailContent || body.content || "";
    const senderMatch = emailContent.match(/[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    const domain = senderMatch ? senderMatch[1].toLowerCase().trim() : "";
    const dnsPromise = domain ? checkEmailAuthentication(domain).catch(() => null) : Promise.resolve(null);

    const systemPrompt = "You are an elite cybersecurity sentry specializing in BEC detection and email analysis. Analyze the email for impersonation and threats. Return ONLY valid JSON with no markdown, matching exactly: { status: 'safe' or 'suspicious' or 'high_risk', sender_match: boolean, tone_deviation_score: number 0-1, impersonation_risk: 'low' or 'medium' or 'high', suspicious_request: boolean, risk_factors: string[], summary: string, recommended_action: 'verify_sender' or 'block' or 'report' or 'proceed', confidence: number 0-1 }";
    const userPrompt = JSON.stringify(body);
    const text = await callNemotron(systemPrompt, userPrompt, 0.3, 1024);
    const clean = text.replace(/```json/g, "").replace(/```/g, "").trim();
    const result = JSON.parse(clean);

    const dnsResult = await dnsPromise;
    if (dnsResult) {
      result.spf_valid = dnsResult.spf;
      result.dmarc_valid = dnsResult.dmarc;
      if (!Array.isArray(result.risk_factors)) result.risk_factors = [];
      if (dnsResult.spf === false && dnsResult.dmarc === false) {
        result.risk_factors.push("Sender domain has no SPF or DMARC protection — high spoofing risk");
        if (result.impersonation_risk === "low") result.impersonation_risk = "medium";
      } else if (dnsResult.suspicious) {
        result.risk_factors.push(...dnsResult.details.filter((d: string) => d.startsWith("No ")));
      }
    }

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("[analyze-email] error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: "Scan failed." }, { status: 500 });
  }
}
