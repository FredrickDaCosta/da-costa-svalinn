'use server';
/**
 * @fileOverview A Genkit flow for the Status 'Lure' Detector.
 * Updated to match the Unified Background Sentry requirements.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

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

export async function statusLureDetection(
  input: StatusLureDetectorInput
): Promise<StatusLureDetectorOutput> {
  return statusLureDetectorFlow(input);
}

const prompt = ai.definePrompt({
  name: 'statusLureDetectorPrompt',
  input: { schema: StatusLureDetectorInputSchema },
  output: { schema: StatusLureDetectorOutputSchema },
  system: 'You are an elite cybersecurity sentry specializing in social engineering. Analyze this image text and layout for social engineering patterns. Compare against known scam tactics. Provide a JSON-only response.',
  prompt: `Analyze the following content for social engineering lures. 

Content:
{{#if text}}{{{text}}}{{/if}}
{{#if imageDataUri}}{{media url=imageDataUri}}{{/if}}

Output: JSON only`,
});

const statusLureDetectorFlow = ai.defineFlow(
  {
    name: 'statusLureDetectorFlow',
    inputSchema: StatusLureDetectorInputSchema,
    outputSchema: StatusLureDetectorOutputSchema,
  },
  async input => {
    const { output } = await prompt(input);
    return output!;
  }
);
