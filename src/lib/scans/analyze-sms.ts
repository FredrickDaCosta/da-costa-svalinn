import { callNemotron } from '@/lib/openrouter';
import { scanUrlWithVirusTotal } from '@/lib/virustotal';

export interface AnalyzeSmsInput {
  phoneNumber?: string;
  messageText?: string;
  contactMethod?: 'sms' | 'whatsapp' | 'call' | 'other';
}
export interface AnalyzeSmsOutput {
  risk_score: number;
  verdict: 'safe' | 'suspicious' | 'high_risk' | 'critical';
  scam_type: string;
  phone_analysis?: { country_code: string; format_suspicious: boolean; known_pattern: string };
  message_analysis?: { urgency_detected: boolean; impersonation_detected: boolean; personal_info_request: boolean; trigger_phrase: string };
  summary: string;
  recommended_action: string;
  vt_detections?: number;
  vt_total?: number;
  vt_engines?: string[];
}

export async function handleAnalyzeSms(input: AnalyzeSmsInput): Promise<AnalyzeSmsOutput> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('AI service not configured.');
  }

  const urlRegex = /https?:\/\/[^\s]+/g;
  const urls: string[] = (input.messageText || '').match(urlRegex) || [];
  const firstUrl = urls[0] || '';
  const vtPromise = firstUrl ? scanUrlWithVirusTotal(firstUrl).catch(() => null) : Promise.resolve(null);

  const systemPrompt = "You are Da-Costa Svalinn SMS and Call Shield. Analyze for phone scams, 419 fraud, OTP theft, SIM swap. Return ONLY valid JSON with no markdown, matching exactly: { risk_score: number 0-10, verdict: 'safe' or 'suspicious' or 'high_risk' or 'critical', scam_type: string, summary: string, recommended_action: string, phone_analysis: { country_code: string, format_suspicious: boolean, known_pattern: string }, message_analysis: { urgency_detected: boolean, impersonation_detected: boolean, personal_info_request: boolean, trigger_phrase: string } }";
  const userPrompt = JSON.stringify(input);
  const text = await callNemotron(systemPrompt, userPrompt, 0.3, 1024);
  const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const result = JSON.parse(clean) as AnalyzeSmsOutput;

  const vtResult = await vtPromise;
  if (vtResult) {
    result.vt_detections = vtResult.positives;
    result.vt_total = vtResult.total;
    result.vt_engines = vtResult.detectionNames;
    if (vtResult.malicious) {
      result.verdict = 'critical';
      result.risk_score = Math.max(result.risk_score ?? 0, 9);
      const engines = vtResult.detectionNames.length ? ` (${vtResult.detectionNames.join(', ')})` : '';
      result.summary = `${result.summary} Linked URL flagged malicious by VirusTotal: ${vtResult.positives}/${vtResult.total} engines${engines}.`.trim();
    }
  }

  return result;
}
