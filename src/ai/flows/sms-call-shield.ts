// SMS & Call Shield — Gemini-powered phone number + SMS scam analysis
import { ai } from '@/ai/genkit';
import { z } from 'zod';

export const SmsCallShieldInputSchema = z.object({
  phoneNumber: z.string().optional().describe('Phone number to analyse'),
  messageText: z.string().optional().describe('SMS or call message text'),
  contactMethod: z.enum(['sms', 'whatsapp', 'call', 'other']).optional(),
});
export type SmsCallShieldInput = z.infer<typeof SmsCallShieldInputSchema>;

export const SmsCallShieldOutputSchema = z.object({
  risk_score: z.number().min(0).max(10),
  verdict: z.enum(['safe', 'suspicious', 'high_risk', 'critical']),
  scam_type: z.string(),
  phone_analysis: z.object({
    country_code: z.string(),
    format_suspicious: z.boolean(),
    known_pattern: z.string(),
  }).optional(),
  message_analysis: z.object({
    urgency_detected: z.boolean(),
    impersonation_detected: z.boolean(),
    personal_info_request: z.boolean(),
    trigger_phrase: z.string(),
  }).optional(),
  summary: z.string(),
  recommended_action: z.string(),
});
export type SmsCallShieldOutput = z.infer<typeof SmsCallShieldOutputSchema>;

export const smsCallShield = ai.defineFlow(
  {
    name: 'smsCallShield',
    inputSchema: SmsCallShieldInputSchema,
    outputSchema: SmsCallShieldOutputSchema,
  },
  async (input) => {
    const { output } = await ai.generate({
      model: 'googleai/gemini-2.0-flash',
      output: { schema: SmsCallShieldOutputSchema },
      prompt: `You are Da-Costa Svalinn's SMS & Call Shield — an elite AI security analyst specialising in phone-based scam detection. Your primary focus is protecting users in Africa and Nigeria from 419 fraud, OTP theft, SIM swap scams, fake bank calls, delivery scams, and social engineering via SMS and phone.

Analyse the following input and return a structured scam risk assessment:

Phone Number: ${input.phoneNumber || 'Not provided'}
Message Text: ${input.messageText || 'Not provided'}
Contact Method: ${input.contactMethod || 'Not specified'}

Your analysis must:
1. Evaluate the phone number format, country code, and known scam patterns (e.g. +1 spoofed numbers targeting Africans, premium rate numbers, numbers mimicking banks)
2. Analyse the message text for: urgency language, impersonation (bank, government, EFCC, police, MTN, Airtel, DHL, FedEx, NDLEA), OTP requests, money requests, prize claims, threats
3. Classify the scam type: 419/advance_fee, otp_theft, sim_swap, bank_impersonation, government_impersonation, delivery_scam, lottery_scam, investment_fraud, romance_scam, none
4. Give a risk score from 0-10 where 0=completely safe and 10=confirmed scam
5. Give a clear recommended action the user should take

Be precise, be direct, and prioritise user safety. If no phone number or message is provided, return a safe verdict with a note to provide more information.`,
    });
    if (!output) throw new Error('SMS & Call Shield analysis failed.');
    return output;
  }
);
