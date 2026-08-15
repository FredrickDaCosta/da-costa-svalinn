'use server';
/**
 * @fileOverview Real-time email tone and linguistic style analysis.
 * Supports comparison against cached sender history to detect impersonation.
 */

import { z } from 'zod';
import { callNemotron } from '@/lib/openrouter';

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

const systemPrompt =
  'Act as an elite cybersecurity sentry specializing in Linguistic Style Analysis and BEC detection. Compare the current email body against the provided context cache of historical sender communication. Identify shifts in vocabulary, syntax, or tone that suggest impersonation. Return ONLY valid JSON with no markdown, matching exactly: { status: "safe" or "suspicious" or "high_risk", sender_match: boolean, tone_deviation_score: number 0-1, impersonation_risk: "low" or "medium" or "high", suspicious_request: boolean, risk_factors: string[], summary: string, recommended_action: "verify_sender" or "block" or "report" or "proceed", confidence: number 0-1 }';

export async function emailToneAnalysis(
  input: EmailToneAnalysisInput
): Promise<EmailToneAnalysisOutput> {
  const parsedInput = EmailToneAnalysisInputSchema.parse(input);
  const historySection = parsedInput.senderHistory && parsedInput.senderHistory.length > 0
    ? `Sender History Context:\n${parsedInput.senderHistory.map(h => '- ' + h).join('\n')}\n\n`
    : '';
  const userPrompt = `Analyze the following email content.\n\n${historySection}Current Email Body:\n${parsedInput.emailContent}`;
  const text = await callNemotron(systemPrompt, userPrompt, 0.3, 1024);
  const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const output = EmailToneAnalysisOutputSchema.parse(JSON.parse(clean));
  return output;
}
