import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string(),
});

const UserContextSchema = z.object({
  displayName: z.string().optional(),
  streakDays: z.number().optional(),
  postureScore: z.number().optional(),
  sentryActive: z.boolean().optional(),
});

const DacostaChatInputSchema = z.object({
  messages: z.array(MessageSchema),
  userContext: UserContextSchema.optional(),
});

export type DacostaChatInput = z.infer<typeof DacostaChatInputSchema>;
export type AIChatOutput = { reply: string };

const AIChatOutputSchema = z.object({
  reply: z.string().describe('The assistant reply to the user'),
});

const dacostaChatFlowDef = ai.defineFlow(
  {
    name: 'dacostaChatFlow',
    inputSchema: DacostaChatInputSchema,
    outputSchema: AIChatOutputSchema,
  },
  async (input) => {
    const ctx = input.userContext || {};

    const systemPrompt = `You are the Da-Costa AI Assistant, an expert cybersecurity advisor for Da-Costa Svalinn protecting users in Nigeria and Africa from phishing, scams, deepfake audio, SMS fraud, and social engineering.
User: ${ctx.displayName || 'Valued User'} | Streak: ${ctx.streakDays ?? 14} days | Score: ${ctx.postureScore ?? 94}/100 | Sentry: Active
Specialise in: 419 fraud, OTP theft, SIM swap, BEC attacks, EFCC/bank/government impersonation, WhatsApp voice deepfakes.
Rules: Keep responses to 2-3 short paragraphs. Always end with a concrete action. Never request passwords, OTPs, or financial info. Reply in the same language the user writes in. Be warm, professional and empowering.`;

    // Correctly format messages as text
    const conversationText = input.messages
      .map(m => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n\n');

    const response = await ai.generate({
      system: systemPrompt,
      prompt: conversationText,
    });

    return { reply: response.text || 'I am unable to respond right now. Please try again.' };
  }
);

export async function dacostaChatFlow(input: DacostaChatInput): Promise<AIChatOutput> {
  return dacostaChatFlowDef(input);
}
