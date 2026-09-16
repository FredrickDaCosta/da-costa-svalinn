'use server';

import { handleAnalyzeUrl, type AnalyzeUrlInput, type AnalyzeUrlOutput } from '@/lib/scans/analyze-url';
import { handleDetectLure, type DetectLureInput, type DetectLureOutput } from '@/lib/scans/detect-lure';
import { handleAnalyzeEmail, type AnalyzeEmailInput, type AnalyzeEmailOutput } from '@/lib/scans/analyze-email';
import { handleAnalyzeSms, type AnalyzeSmsInput, type AnalyzeSmsOutput } from '@/lib/scans/analyze-sms';
import { handleAssessVideo, type AssessVideoInput, type AssessVideoOutput } from '@/lib/scans/assess-video';
import { handleAnalyzeAudio, type AnalyzeAudioInput, type AnalyzeAudioOutput } from '@/lib/scans/analyze-audio';

// Re-export types for backward compatibility
export type SmartLinkScrutinizerAnalysisInput = AnalyzeUrlInput;
export type SmartLinkScrutinizerAnalysisOutput = AnalyzeUrlOutput;
export type StatusLureDetectorInput = DetectLureInput;
export type StatusLureDetectorOutput = DetectLureOutput;
export type VideoMetadataRiskAssessmentInput = AssessVideoInput;
export type VideoMetadataRiskAssessmentOutput = AssessVideoOutput;
export type EmailToneAnalysisInput = AnalyzeEmailInput;
export type EmailToneAnalysisOutput = AnalyzeEmailOutput;
export type SmsCallShieldInput = AnalyzeSmsInput;
export type SmsCallShieldOutput = AnalyzeSmsOutput;
export type DeepfakeAudioInput = AnalyzeAudioInput;
export type DeepfakeAudioOutput = AnalyzeAudioOutput;

export interface DacostaChatInput { prompt: string; history?: { role: string; content: string }[]; }
export interface AIChatOutput { reply: string; }

export async function analyzeUrl(values: AnalyzeUrlInput): Promise<AnalyzeUrlOutput> {
  try {
    return await handleAnalyzeUrl(values);
  } catch (error: unknown) {
    console.error('Error in analyzeUrl:', error);
    throw new Error('Failed to analyze URL.');
  }
}

export async function detectLure(values: DetectLureInput): Promise<DetectLureOutput> {
  try {
    return await handleDetectLure(values);
  } catch (error: unknown) {
    console.error('Error in detectLure:', error);
    throw new Error('Failed to detect lure.');
  }
}

export async function assessVideo(values: AssessVideoInput): Promise<AssessVideoOutput> {
  try {
    return await handleAssessVideo(values);
  } catch (error: unknown) {
    console.error('Error in assessVideo:', error);
    throw new Error('Failed to assess video.');
  }
}

export async function analyzeEmail(values: AnalyzeEmailInput): Promise<AnalyzeEmailOutput> {
  try {
    return await handleAnalyzeEmail(values);
  } catch (error: unknown) {
    console.error('Error in analyzeEmail:', error);
    throw new Error('Failed to analyze email.');
  }
}

export async function analyzeSmsCalls(values: AnalyzeSmsInput): Promise<AnalyzeSmsOutput> {
  try {
    return await handleAnalyzeSms(values);
  } catch (error: unknown) {
    console.error('Error in analyzeSmsCalls:', error);
    throw new Error('Failed to analyze SMS/Call.');
  }
}

export async function analyzeDeepfakeAudio(values: AnalyzeAudioInput): Promise<AnalyzeAudioOutput> {
  try {
    return await handleAnalyzeAudio(values);
  } catch (error: unknown) {
    console.error('Error in analyzeDeepfakeAudio:', error);
    throw new Error('Failed to analyze audio.');
  }
}

export async function dacostaChatAction(values: DacostaChatInput): Promise<AIChatOutput> {
  try {
    // Chat still uses HTTP — the chat route has translation/caching logic
    // that's not worth duplicating
    const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://dacosta-svalinn.com';
    const res = await fetch(BASE_URL + '/api/dacosta-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [{ role: 'user', content: values.prompt }], userContext: {} }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Chat failed.');
    }
    const data = await res.json();
    return { reply: data.reply || 'I am here to help.' };
  } catch (error: unknown) {
    console.error('[dacostaChatAction] error:', error instanceof Error ? error.message : String(error));
    throw new Error('Da-Costa AI error: ' + (error instanceof Error ? error.message : 'unknown'));
  }
}
