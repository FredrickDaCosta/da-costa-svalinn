'use server';
/**
 * @fileOverview A Genkit flow for analyzing suspicious URLs using AI.
 * Updated to match the Unified Background Sentry requirements.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SmartLinkScrutinizerAnalysisInputSchema = z.object({
  url: z.string().url().describe('The URL to be analyzed for potential risks.'),
});
export type SmartLinkScrutinizerAnalysisInput = z.infer<
  typeof SmartLinkScrutinizerAnalysisInputSchema
>;

const SmartLinkScrutinizerAnalysisOutputSchema = z.object({
  status: z
    .enum(['safe', 'unsafe'])
    .describe('The overall safety status of the URL.'),
  risk_score: z
    .number()
    .min(0)
    .max(10)
    .describe('A numerical risk score from 0 (safe) to 10 (highly malicious).'),
  reason: z
    .string()
    .describe('A brief explanation of why the URL received its status and risk score.'),
  recommended_action: z
    .enum(['block', 'warn', 'allow'])
    .describe('An actionable recommendation for the user.'),
});
export type SmartLinkScrutinizerAnalysisOutput = z.infer<
  typeof SmartLinkScrutinizerAnalysisOutputSchema
>;

export async function smartLinkScrutinizerAnalysis(
  input: SmartLinkScrutinizerAnalysisInput
): Promise<SmartLinkScrutinizerAnalysisOutput> {
  return smartLinkScrutinizerAnalysisFlow(input);
}

const prompt = ai.definePrompt({
  name: 'smartLinkScrutinizerPrompt',
  input: {schema: SmartLinkScrutinizerAnalysisInputSchema},
  output: {schema: SmartLinkScrutinizerAnalysisOutputSchema},
  system: 'You are an elite cybersecurity sentry. Analyze the provided URL and metadata for phishing, typosquatting, and brand impersonation. Provide a JSON-only response according to the specified schema.',
  prompt: `Analyze this URL for cybersecurity risks:

URL: {{{url}}}

Return strictly in JSON format.`,
});

const smartLinkScrutinizerAnalysisFlow = ai.defineFlow(
  {
    name: 'smartLinkScrutinizerAnalysisFlow',
    inputSchema: SmartLinkScrutinizerAnalysisInputSchema,
    outputSchema: SmartLinkScrutinizerAnalysisOutputSchema,
  },
  async (input) => {
    const {output} = await prompt(input);
    return output!;
  }
);
