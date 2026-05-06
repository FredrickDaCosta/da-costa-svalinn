import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { messages, userContext } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ reply: 'Invalid request.' }, { status: 400 });
    }
    const apiKey = process.env.CLAUDE_API_KEY;
    if (!apiKey) {
      console.error('[dacosta-chat] CLAUDE_API_KEY not set');
      return NextResponse.json({ reply: 'AI service not configured.' }, { status: 500 });
    }
    const ctx = userContext || {};
    const name = ctx.displayName || 'Valued User';
    const streak = ctx.streakDays || 14;
    const score = ctx.postureScore || 94;
    const systemPrompt = 'You are the Da-Costa AI Assistant, an expert cybersecurity advisor for Da-Costa Svalinn protecting users in Nigeria and Africa from phishing, scams, deepfake audio, SMS fraud, and social engineering. User: ' + name + ' | Streak: ' + streak + ' days | Score: ' + score + '/100 | Sentry: Active. Specialise in: 419 fraud, OTP theft, SIM swap, BEC attacks, EFCC/bank/government impersonation, WhatsApp voice deepfakes. Rules: Keep responses to 2-3 short paragraphs. Always end with a concrete action. Never request passwords, OTPs, or financial info. Reply in the same language the user writes in. Be warm, professional and empowering.';
    const claudeMessages = messages.map((m: any) => ({
      role: m.role === 'user' ? 'user' : 'assistant',
      content: m.content,
    }));
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: systemPrompt,
        messages: claudeMessages,
      }),
    });
    const claudeData = await claudeRes.json();
    if (!claudeRes.ok) {
      console.error('[dacosta-chat] Claude API error:', JSON.stringify(claudeData));
      return NextResponse.json({ reply: 'AI service error. Please try again.' }, { status: 500 });
    }
    const reply = claudeData?.content?.[0]?.text || 'Unable to respond right now.';
    return NextResponse.json({ reply });
  } catch (error) {
    console.error('[dacosta-chat] error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { reply: 'Da-Costa AI is temporarily unavailable. Please try again.' },
      { status: 500 }
    );
  }
}