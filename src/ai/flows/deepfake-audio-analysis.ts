// NOTE: the underlying model (Nemotron via OpenRouter) is text-only and cannot
// listen to audio. Only the optional `context` text is analyzed; the actual
// audioDataUri bytes are not sent to the model.
import { z } from 'zod';
import { callNemotron } from '@/lib/openrouter';

export const DeepfakeAudioInputSchema = z.object({
  audioDataUri: z.string().describe('Base64 data URI of the audio file to analyse'),
  context: z.string().optional().describe('Context about the audio e.g. WhatsApp voice note, phone call recording'),
});
export type DeepfakeAudioInput = z.infer<typeof DeepfakeAudioInputSchema>;

export const DeepfakeAudioOutputSchema = z.object({
  verdict: z.enum(['authentic', 'suspicious', 'likely_deepfake', 'confirmed_deepfake']),
  confidence: z.number().min(0).max(1).describe('Confidence score 0-1'),
  risk_score: z.number().min(0).max(10),
  indicators: z.array(z.string()).describe('List of deepfake indicators detected'),
  voice_analysis: z.object({
    naturalness_score: z.number().min(0).max(10).describe('How natural the voice sounds 0-10'),
    cadence_anomalies: z.boolean(),
    background_noise_consistent: z.boolean(),
    emotional_authenticity: z.string(),
  }),
  summary: z.string(),
  recommended_action: z.string(),
});
export type DeepfakeAudioOutput = z.infer<typeof DeepfakeAudioOutputSchema>;

const systemPrompt = `You are Da-Costa Svalinn's Deepfake Audio Analyzer — an elite AI forensic analyst specialising in detecting AI-generated or cloned voice audio. Your primary mission is protecting high-value targets (executives, bank administrators, government officials) and everyday users in Africa and Nigeria from sophisticated voice-cloning fraud, WhatsApp voice note scams, and phone-based identity theft.

You will only be given contextual information about the audio, not the audio itself. Base your assessment on the context provided and general scam patterns. If you cannot analyse the audio clearly, return a suspicious verdict and explain why.

Return ONLY valid JSON with no markdown, matching exactly: { verdict: "authentic" or "suspicious" or "likely_deepfake" or "confirmed_deepfake", confidence: number 0-1, risk_score: number 0-10, indicators: string[], summary: string, recommended_action: string, voice_analysis: { naturalness_score: number, cadence_anomalies: boolean, background_noise_consistent: boolean, emotional_authenticity: string } }`;

export async function deepfakeAudioAnalysis(input: DeepfakeAudioInput): Promise<DeepfakeAudioOutput> {
  const parsedInput = DeepfakeAudioInputSchema.parse(input);
  const userPrompt = `Context provided: ${parsedInput.context || 'General audio analysis'}\n\nNo direct audio waveform is available. Provide a forensic assessment based on the context, noting that direct audio inspection was not possible.`;
  const text = await callNemotron(systemPrompt, userPrompt, 0.3, 1024);
  const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const output = DeepfakeAudioOutputSchema.parse(JSON.parse(clean));
  return output;
}
