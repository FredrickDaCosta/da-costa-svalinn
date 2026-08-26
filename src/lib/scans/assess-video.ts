import { callNemotron } from '@/lib/openrouter';

export interface AssessVideoInput { mp4HeaderDataUri: string; }
export interface AssessVideoOutput {
  match: boolean;
  suspicious_elements: string[];
  risk: number;
  malware_indicator: boolean;
}

export async function handleAssessVideo(input: AssessVideoInput): Promise<AssessVideoOutput> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('AI service not configured.');
  }

  const systemPrompt = "You are an elite video file auditor. Analyze this file header and metadata for security risks including codec mismatches, embedded scripts, and obfuscation. Return ONLY valid JSON with no markdown matching exactly: { match: boolean, suspicious_elements: string[], risk: number, malware_indicator: boolean }";
  const userPrompt = JSON.stringify(input);
  const text = await callNemotron(systemPrompt, userPrompt, 0.3, 1024);
  const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(clean) as AssessVideoOutput;
}
