import { callNemotron } from '@/lib/openrouter';

export interface DetectLureInput { text?: string; imageDataUri?: string; }
export interface DetectLureOutput {
  is_lure: boolean;
  scam_type: 'phishing' | 'giveaway' | 'investment' | 'romance' | 'impersonation' | 'other';
  confidence: number;
  trigger_phrase: string;
}

export async function handleDetectLure(input: DetectLureInput): Promise<DetectLureOutput> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('AI service not configured.');
  }

  const systemPrompt = "You are an elite cybersecurity sentry specializing in social engineering. Analyze this content for social engineering patterns. Return ONLY valid JSON with no markdown, matching exactly: { is_lure: boolean, scam_type: 'phishing' or 'giveaway' or 'investment' or 'romance' or 'impersonation' or 'other', confidence: number 0-1, trigger_phrase: string }";
  const userPrompt = JSON.stringify(input);
  const text = await callNemotron(systemPrompt, userPrompt, 0.3, 1024);
  const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(clean) as DetectLureOutput;
}
