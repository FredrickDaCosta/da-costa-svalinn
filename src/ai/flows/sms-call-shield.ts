// SMS & Call Shield — Nemotron-powered phone number + SMS scam analysis
import { z } from 'zod';
import { callNemotron } from '@/lib/openrouter';

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

const systemPrompt = `You are Da-Costa Svalinn's SMS & Call Shield — an elite AI security analyst specialising in phone-based scam detection. Your primary focus is protecting users in Africa and Nigeria from 419 fraud, OTP theft, SIM swap scams, fake bank calls, delivery scams, and social engineering via SMS and phone.

Your analysis must:
1. Evaluate the phone number format, country code, and known scam patterns (e.g. +1 spoofed numbers targeting Africans, premium rate numbers, numbers mimicking banks)
2. Analyse the message text for: urgency language, impersonation (bank, government, EFCC, police, MTN, Airtel, DHL, FedEx, NDLEA), OTP requests, money requests, prize claims, threats
3. Classify the scam type: 419/advance_fee, otp_theft, sim_swap, bank_impersonation, government_impersonation, delivery_scam, lottery_scam, investment_fraud, romance_scam, none
4. Give a risk score from 0-10 where 0=completely safe and 10=confirmed scam
5. Give a clear recommended action the user should take

Be precise, be direct, and prioritise user safety. If no phone number or message is provided, return a safe verdict with a note to provide more information.

Return ONLY valid JSON with no markdown, matching exactly: { risk_score: number 0-10, verdict: "safe" or "suspicious" or "high_risk" or "critical", scam_type: string, summary: string, recommended_action: string, phone_analysis: { country_code: string, format_suspicious: boolean, known_pattern: string }, message_analysis: { urgency_detected: boolean, impersonation_detected: boolean, personal_info_request: boolean, trigger_phrase: string } }`;

export async function smsCallShield(input: SmsCallShieldInput): Promise<SmsCallShieldOutput> {
  const parsedInput = SmsCallShieldInputSchema.parse(input);
  const userPrompt = `Analyse the following input and return a structured scam risk assessment:

Phone Number: ${parsedInput.phoneNumber || 'Not provided'}
Message Text: ${parsedInput.messageText || 'Not provided'}
Contact Method: ${parsedInput.contactMethod || 'Not specified'}`;
  const text = await callNemotron(systemPrompt, userPrompt, 0.3, 1024);
  const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
  const output = SmsCallShieldOutputSchema.parse(JSON.parse(clean));
  return output;
}
