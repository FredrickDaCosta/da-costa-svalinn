'use server';
/**
 * @fileOverview The Status 'Lure' Detector.
 * NOTE: image-based analysis (imageDataUri) is not supported — the underlying
 * model (Nemotron via OpenRouter) is text-only. When only imageDataUri is
 * provided with no text, this returns a low-confidence "not enough text
 * to analyse" result rather than inspecting the image.
 */

import { z } from 'zod';
import { callNemotron } from '@/lib/openrouter';

const StatusLureDetectorInputSchema = z
  .object({
    text: z.string().optional().describe('Text content to analyze for social engineering.'),
    imageDataUri: z
      .string()
      .optional()
      .describe(
        "An image of content to analyze, as a data URI."
      ),
  })
  .refine(input => input.text !== undefined || input.imageDataUri !== undefined, {
    message: 'Either text or imageDataUri must be provided.',
  });

export type StatusLureDetectorInput = z.infer<typeof StatusLureDetectorInputSchema>;

const StatusLureDetectorOutputSchema = z.object({
  is_lure: z
    .boolean()
    .describe('Boolean indicating if the input is likely a social engineering attempt.'),
  scam_type: z
    .enum(['phishing', 'giveaway', 'investment', 'romance', 'impersonation', 'other'])
    .describe('The type of social engineering detected.'),
  confidence: z
    .number()
    .min(0)
    .max(1)
    .describe('A confidence score (0-1).'),
  trigger_phrase: z
    .string()
    .describe('The specific phrase or element that triggered the detection.'),
});

export type StatusLureDetectorOutput = z.infer<typeof StatusLureDetectorOutputSchema>;

const systemPrompt =
  'You are an elite cybersecurity sentry specializing in social engineering. Analyze this content for social engineering patterns. Compare against known scam tactics. Return ONLY valid JSON with no markdown, matching exactly: { is_lure: boolean, scam_type: "phishing" or "giveaway" or "investment" or "romance" or "impersonation" or "other", confidence: number 0-1, trigger_phrase: string }';

export async function statusLureDetection(
  input: StatusLureDetectorInput
): Promise<StatusLureDetectorOutput> {
  const parsedInput = StatusLureDetectorInputSchema.parse(input);

  if (!parsedInput.text) {
    return {
      is_lure: false,
      scam_type: 'other',
      confidence: 0.1,
      trigger_phrase: 'Image-only input — text analysis not available',
    };
  }

  const userPrompt = `Analyze the following content for social engineering lures.\n\nContent:\n${parsedInput.text}\n\nOutput: JSON only`;
  const text = await callNemotron(systemPrompt, userPrompt, 0.3, 1024);
  const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const output = StatusLureDetectorOutputSchema.parse(JSON.parse(clean));
  return output;
}
