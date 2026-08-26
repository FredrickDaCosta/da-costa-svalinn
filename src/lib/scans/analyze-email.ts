import { callNemotron } from '@/lib/openrouter';
import { checkEmailAuthentication } from '@/lib/dns-check';

export interface AnalyzeEmailInput { emailContent: string; senderHistory?: string[]; }
export interface AnalyzeEmailOutput {
  status: 'safe' | 'suspicious' | 'high_risk';
  sender_match: boolean;
  tone_deviation_score: number;
  impersonation_risk: 'low' | 'medium' | 'high';
  suspicious_request: boolean;
  risk_factors: string[];
  summary: string;
  recommended_action: 'verify_sender' | 'block' | 'report' | 'proceed';
  confidence: number;
  spf_valid?: boolean | null;
  dmarc_valid?: boolean | null;
}

export async function handleAnalyzeEmail(input: AnalyzeEmailInput): Promise<AnalyzeEmailOutput> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('AI service not configured.');
  }

  const { emailContent } = input;
  const senderMatch = emailContent.match(/[a-zA-Z0-9._%+-]+@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  const domain = senderMatch ? senderMatch[1].toLowerCase().trim() : '';
  const dnsPromise = domain ? checkEmailAuthentication(domain).catch(() => null) : Promise.resolve(null);

  const systemPrompt = "You are an elite cybersecurity sentry specializing in BEC detection and email analysis. Analyze the email for impersonation and threats. Return ONLY valid JSON with no markdown, matching exactly: { status: 'safe' or 'suspicious' or 'high_risk', sender_match: boolean, tone_deviation_score: number 0-1, impersonation_risk: 'low' or 'medium' or 'high', suspicious_request: boolean, risk_factors: string[], summary: string, recommended_action: 'verify_sender' or 'block' or 'report' or 'proceed', confidence: number 0-1 }";
  const userPrompt = JSON.stringify(input);
  const text = await callNemotron(systemPrompt, userPrompt, 0.3, 1024);
  const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const result = JSON.parse(clean) as AnalyzeEmailOutput;

  const dnsResult = await dnsPromise;
  if (dnsResult) {
    result.spf_valid = dnsResult.spf;
    result.dmarc_valid = dnsResult.dmarc;
    if (!Array.isArray(result.risk_factors)) result.risk_factors = [];
    if (dnsResult.spf === false && dnsResult.dmarc === false) {
      result.risk_factors.push('Sender domain has no SPF or DMARC protection — high spoofing risk');
      if (result.impersonation_risk === 'low') result.impersonation_risk = 'medium';
    } else if (dnsResult.suspicious) {
      result.risk_factors.push(...dnsResult.details.filter((d: string) => d.startsWith('No ')));
    }
  }

  return result;
}
