'use server';
/**
 * @fileOverview A Genkit flow for real-time email tone and linguistic style analysis.
 * Supports comparison against cached sender history to detect impersonation.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const EmailToneAnalysisInputSchema = z.object({
  emailContent: z.string().min(20).describe('The full text content of the email to be analyzed.'),
  senderHistory: z
    .array(z.string())
    .optional()
    .describe('A context cache of previous verified email snippets from this sender.'),
});
export type EmailToneAnalysisInput = z.infer<typeof EmailToneAnalysisInputSchema>;

const EmailToneAnalysisOutputSchema = z.object({
  status: z
    .enum(['safe', 'suspicious', 'high_risk'])
    .describe('The overall security assessment of the email tone.'),
  sender_match: z.boolean().describe('Whether the current email aligns with the cached sender linguistic style.'),
  tone_deviation_score: z.number().min(0).max(1).describe('The degree of deviation from standard professional/sender norms (0-1).'),
  impersonation_risk: z.enum(['low', 'medium', 'high']).describe('The likelihood of Business Email Compromise (BEC).'),
  suspicious_request: z.boolean().describe('Does the email contain urgent financial or data requests?'),
  risk_factors: z.array(z.string()).describe('Identified risks (e.g., "urgent_payment", "style_mismatch").'),
  summary: z.string().describe('A concise security explanation.'),
  recommended_action: z.enum(['verify_sender', 'block', 'report', 'proceed']),
  confidence: z.number().min(0).max(1),
});
export type EmailToneAnalysisOutput = z.infer<typeof EmailToneAnalysisOutputSchema>;

export async function emailToneAnalysis(
  input: EmailToneAnalysisInput
): Promise<EmailToneAnalysisOutput> {
  return emailToneAnalysisFlow(input);
}

const prompt = ai.definePrompt({
  name: 'emailToneAnalysisPrompt',
  input: { schema: EmailToneAnalysisInputSchema },
  output: { schema: EmailToneAnalysisOutputSchema },
  system:
    'Act as an elite cybersecurity sentry specializing in Linguistic Style Analysis and BEC detection. Compare the current email body against the provided context cache of historical sender communication. Identify shifts in vocabulary, syntax, or tone that suggest impersonation. Output strictly in JSON.',
  prompt: `Analyze the following email content.
  
{{#if senderHistory}}
Sender History Context:
{{#each senderHistory}}
- {{{this}}}
{{/each}}
{{/if}}

Current Email Body:
{{{emailContent}}}`,
});

const emailToneAnalysisFlow = ai.defineFlow(
  {
    name: 'emailToneAnalysisFlow',
    inputSchema: EmailToneAnalysisInputSchema,
    outputSchema: EmailToneAnalysisOutputSchema,
  },
  async input => {
    const { output } = await prompt(input);
    return output!;
  }
);
