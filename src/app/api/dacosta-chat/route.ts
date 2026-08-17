import { NextRequest, NextResponse } from 'next/server';
import { callNemotron } from '@/lib/openrouter';
import { translateText } from '@/lib/azure-translate';
import { getCachedTranslation, setCachedTranslation } from '@/lib/translation-cache';
export const dynamic = 'force-dynamic';

interface ChatMessage {
  role: string;
  content: string;
}

export async function POST(req: NextRequest) {
  try {
    const { messages, userContext, locale } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ reply: 'Invalid request.' }, { status: 400 });
    }
    if (!process.env.OPENROUTER_API_KEY) {
      console.error('[dacosta-chat] OPENROUTER_API_KEY not set');
      return NextResponse.json({ reply: 'AI service not configured.' }, { status: 500 });
    }
    const effectiveLocale = locale || 'en';
    const ctx = userContext || {};
    const name = ctx.displayName || 'Valued User';
    const streak = ctx.streakDays || 14;
    const score = ctx.postureScore || 94;
    const userId = ctx.uid || 'anonymous';
    const lastUserMessage = messages[messages.length - 1]?.content || '';
    const msgHash = Buffer.from(lastUserMessage.trim().toLowerCase())
      .toString('base64')
      .slice(0, 40)
      .replace(/[/+=]/g, '_');
    const cacheKey = effectiveLocale + '_' + userId + '_' + msgHash;

    try {
      const cached = await getCachedTranslation(effectiveLocale, cacheKey);
      if (cached?.reply) {
        return NextResponse.json({ reply: cached.reply });
      }
    } catch {
      // cache miss — continue to Nemotron
    }

    const systemPrompt = "You are Da-Costa, the Cybersecurity Analyst for Da-Costa Svalinn protecting users in Nigeria and Africa from phishing, scams, deepfake audio, SMS fraud, and social engineering. User: " + name + " | Streak: " + streak + " days | Score: " + score + "/100 | Sentry: Active. Specialise in: 419 fraud, OTP theft, SIM swap, BEC attacks, EFCC/bank/government impersonation, WhatsApp voice deepfakes. Rules: Keep responses to 2-3 short paragraphs. Always end with a concrete action. Never request passwords, OTPs, or financial info. Always respond in English. Your response will be translated automatically. Be warm, professional and empowering.";
    const conversationText = messages
      .map((m: ChatMessage) => (m.role === 'user' ? 'User: ' : 'Assistant: ') + m.content)
      .join('\n\n');

    let reply: string;
    try {
      reply = await callNemotron(systemPrompt, conversationText, 0.7, 1024);
    } catch (error) {
      console.error('[dacosta-chat] Nemotron error:', error instanceof Error ? error.message : String(error));
      return NextResponse.json({ reply: 'AI service error. Please try again.' }, { status: 500 });
    }

    if (!reply) {
      reply = 'Unable to respond right now.';
    }

    if (effectiveLocale !== 'en' && effectiveLocale !== 'en-US') {
      reply = await translateText(reply, effectiveLocale);
    }

    if (reply &&
        reply.length > 10 &&
        !reply.includes('AI service') &&
        !reply.includes('unavailable') &&
        !reply.includes('Unable to respond')) {
      try {
        await setCachedTranslation(effectiveLocale, cacheKey, { reply });
      } catch {
        // non-fatal — continue
      }
    }

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('[dacosta-chat] error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { reply: 'Da-Costa AI is temporarily unavailable. Please try again.' },
      { status: 500 }
    );
  }
}
