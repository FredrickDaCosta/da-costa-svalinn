'use server';
/**
 * @fileOverview Analyzes suspicious URLs using AI.
 */

import { z } from 'zod';
import { callNemotron } from '@/lib/openrouter';

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

const systemPrompt =
  'You are an elite cybersecurity sentry. Analyze the provided URL and metadata for phishing, typosquatting, and brand impersonation. Provide a JSON-only response according to the specified schema: { status: "safe" or "unsafe", risk_score: number 0-10, reason: string, recommended_action: "block" or "warn" or "allow" }';

export async function smartLinkScrutinizerAnalysis(
  input: SmartLinkScrutinizerAnalysisInput
): Promise<SmartLinkScrutinizerAnalysisOutput> {
  const parsedInput = SmartLinkScrutinizerAnalysisInputSchema.parse(input);
  const userPrompt = `Analyze this URL for cybersecurity risks:\n\nURL: ${parsedInput.url}\n\nReturn strictly in JSON format.`;
  const text = await callNemotron(systemPrompt, userPrompt, 0.3, 1024);
  const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const output = SmartLinkScrutinizerAnalysisOutputSchema.parse(JSON.parse(clean));
  return output;
}
