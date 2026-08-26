import { callNemotron } from '@/lib/openrouter';

export interface AnalyzeAudioInput { audioDataUri: string; context?: string; }
export interface AnalyzeAudioOutput {
  verdict: 'authentic' | 'suspicious' | 'likely_deepfake' | 'confirmed_deepfake';
  confidence: number;
  risk_score: number;
  indicators: string[];
  voice_analysis: {
    naturalness_score: number;
    cadence_anomalies: boolean;
    background_noise_consistent: boolean;
    emotional_authenticity: string;
  };
  summary: string;
  recommended_action: string;
}

export async function handleAnalyzeAudio(input: AnalyzeAudioInput): Promise<AnalyzeAudioOutput> {
  if (!process.env.OPENROUTER_API_KEY) {
    throw new Error('AI service not configured.');
  }

  const systemPrompt = "You are Da-Costa Svalinn Deepfake Audio Analyzer. Analyze for AI-generated or cloned voice. Return ONLY valid JSON with no markdown, matching exactly: { verdict: 'authentic' or 'suspicious' or 'likely_deepfake' or 'confirmed_deepfake', confidence: number 0-1, risk_score: number 0-10, indicators: string[], summary: string, recommended_action: string, voice_analysis: { naturalness_score: number, cadence_anomalies: boolean, background_noise_consistent: boolean, emotional_authenticity: string } }";
  const userPrompt = JSON.stringify(input);
  const text = await callNemotron(systemPrompt, userPrompt, 0.3, 1024);
  const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
  return JSON.parse(clean) as AnalyzeAudioOutput;
}
