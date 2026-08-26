import { callNemotron } from '@/lib/openrouter';
import { scanUrlWithVirusTotal } from '@/lib/virustotal';

export interface AnalyzeUrlInput { url: string; }
export interface AnalyzeUrlOutput {
  status: 'safe' | 'unsafe';
  risk_score: number;
  reason: string;
  recommended_action: 'block' | 'warn' | 'allow';
  vt_detections?: number;
  vt_total?: number;
  vt_engines?: string[];
}

export async function handleAnalyzeUrl(input: AnalyzeUrlInput): Promise<AnalyzeUrlOutput> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('AI service not configured.');
  }

  const { url } = input;
  const vtPromise = url ? scanUrlWithVirusTotal(url).catch(() => null) : Promise.resolve(null);

  const systemPrompt = "You are an elite cybersecurity sentry. Analyze the provided URL for phishing, typosquatting, and brand impersonation. Return ONLY valid JSON with no markdown, matching exactly: { status: 'safe' or 'unsafe', risk_score: number 0-10, reason: string, recommended_action: 'block' or 'warn' or 'allow' }";
  const userPrompt = JSON.stringify(input);
  const text = await callNemotron(systemPrompt, userPrompt, 0.3, 1024);
  const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const result = JSON.parse(clean) as AnalyzeUrlOutput;

  const vtResult = await vtPromise;
  if (vtResult) {
    if (vtResult.malicious && result.status === 'safe') {
      result.status = 'unsafe';
      result.risk_score = Math.max(result.risk_score ?? 0, 8);
      result.recommended_action = 'block';
    }
    result.vt_detections = vtResult.positives;
    result.vt_total = vtResult.total;
    result.vt_engines = vtResult.detectionNames;
    if (vtResult.positives > 0) {
      const engines = vtResult.detectionNames.length ? ` (${vtResult.detectionNames.join(', ')})` : '';
      result.reason = `${result.reason} VirusTotal: ${vtResult.positives}/${vtResult.total} engines flagged this URL${engines}.`.trim();
    }
  }

  return result;
}
