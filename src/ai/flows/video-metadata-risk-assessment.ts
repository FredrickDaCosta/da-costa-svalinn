'use server';
/**
 * @fileOverview A Genkit flow for analyzing MP4 video file headers.
 * Updated to match the Unified Background Sentry requirements.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const VideoMetadataRiskAssessmentInputSchema = z.object({
  mp4HeaderDataUri: z
    .string()
    .describe(
      "The MP4 video file header as a data URI."
    ),
});
export type VideoMetadataRiskAssessmentInput = z.infer<typeof VideoMetadataRiskAssessmentInputSchema>;

const VideoMetadataRiskAssessmentOutputSchema = z.object({
  match: z
    .boolean()
    .describe('Whether the container metadata matches the file extension.'),
  suspicious_elements: z
    .array(z.string())
    .describe('Identified anomalies (e.g., "double_extension", "embedded_script").'),
  risk: z
    .number()
    .min(0)
    .max(10)
    .describe('Overall risk score (0-10).'),
  malware_indicator: z
    .boolean()
    .describe('True if high probability of embedded malware exploit.'),
});
export type VideoMetadataRiskAssessmentOutput = z.infer<typeof VideoMetadataRiskAssessmentOutputSchema>;

export async function videoMetadataRiskAssessment(
  input: VideoMetadataRiskAssessmentInput
): Promise<VideoMetadataRiskAssessmentOutput> {
  return videoMetadataRiskAssessmentFlow(input);
}

const prompt = ai.definePrompt({
  name: 'videoMetadataRiskAssessmentPrompt',
  input: {schema: VideoMetadataRiskAssessmentInputSchema},
  output: {schema: VideoMetadataRiskAssessmentOutputSchema},
  system: 'You are an elite video file auditor. Analyze this file header and metadata. Check for extension vs codec mismatches, embedded scripts, double extensions, and obfuscation markers. Provide a JSON-only response.',
  prompt: `Analyze this MP4 video file header data for security risks.
MP4 Header: {{media url=mp4HeaderDataUri}}`,
});

const videoMetadataRiskAssessmentFlow = ai.defineFlow(
  {
    name: 'videoMetadataRiskAssessmentFlow',
    inputSchema: VideoMetadataRiskAssessmentInputSchema,
    outputSchema: VideoMetadataRiskAssessmentOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
