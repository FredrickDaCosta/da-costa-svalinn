import { z } from 'zod';

export const AnalyzeUrlSchema = z.object({
  url: z.string().min(1, 'URL is required'),
});

export const DetectLureSchema = z.object({
  text: z.string().optional(),
  imageDataUri: z.string().max(5_000_000, 'Image too large (max 5MB)').optional(),
}).refine((data) => data.text || data.imageDataUri, {
  message: 'Either text or imageDataUri is required',
});

export const AnalyzeEmailSchema = z.object({
  emailContent: z.string().min(1, 'Email content is required').max(50_000),
  senderHistory: z.array(z.string()).optional(),
});

export const AnalyzeSmsSchema = z.object({
  phoneNumber: z.string().optional(),
  messageText: z.string().min(1).optional(),
  contactMethod: z.enum(['sms', 'whatsapp', 'call', 'other']).optional(),
}).refine((data) => data.phoneNumber || data.messageText, {
  message: 'Either phoneNumber or messageText is required',
});

export const AssessVideoSchema = z.object({
  mp4HeaderDataUri: z.string().min(1, 'Video data is required').max(10_000_000),
});

export const AnalyzeAudioSchema = z.object({
  audioDataUri: z.string().min(1, 'Audio data is required').max(10_000_000),
  context: z.string().optional(),
});

export const DacostaChatSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).min(1),
  userContext: z.record(z.unknown()).optional(),
  locale: z.string().optional(),
});
