import { ai } from '@/ai/genkit';
import { z } from 'zod';

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

export const deepfakeAudioAnalysis = ai.defineFlow(
  {
    name: 'deepfakeAudioAnalysis',
    inputSchema: DeepfakeAudioInputSchema,
    outputSchema: DeepfakeAudioOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
      output: { schema: DeepfakeAudioOutputSchema },
      messages: [
        {
          role: 'user',
          content: [
            {
              media: {
                url: input.audioDataUri,
              },
            },
            {
              text: `You are Da-Costa Svalinn's Deepfake Audio Analyzer — an elite AI forensic analyst specialising in detecting AI-generated or cloned voice audio. Your primary mission is protecting high-value targets (executives, bank administrators, government officials) and everyday users in Africa and Nigeria from sophisticated voice-cloning fraud, WhatsApp voice note scams, and phone-based identity theft.

Context provided: ${input.context || 'General audio analysis'}

Analyse this audio recording for deepfake indicators:

1. VOICE NATURALNESS: Listen for AI-generated speech artifacts — unnatural cadence, robotic pauses, perfect pronunciation without human breath variation, missing lip-smack sounds
2. BACKGROUND CONSISTENCY: Check if background noise is consistent throughout or has suspicious cuts/changes suggesting spliced audio
3. EMOTIONAL AUTHENTICITY: Assess whether emotional tone matches the words being spoken — AI voices often have mismatched emotional signals
4. TECHNICAL ARTIFACTS: Listen for compression artifacts, frequency anomalies, or audio patterns typical of text-to-speech systems
5. SCAM PATTERNS: Identify if the content contains urgency, impersonation of authority figures, requests for OTP/money/personal information

Provide a thorough forensic assessment. If you cannot analyse the audio clearly, return a suspicious verdict and explain why.`,
            },
          ],
        },
      ],
    });
    if (!output) throw new Error('Deepfake audio analysis failed.');
    return output;
  }
);
