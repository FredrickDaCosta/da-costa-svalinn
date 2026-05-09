import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { messages, userContext } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ reply: 'Invalid request.' }, { status: 400 });
    }
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('[dacosta-chat] GEMINI_API_KEY not set');
      return NextResponse.json({ reply: 'AI service not configured.' }, { status: 500 });
    }
    const ctx = userContext || {};
    const name = ctx.displayName || 'Valued User';
    const streak = ctx.streakDays || 14;
    const score = ctx.postureScore || 94;
    const systemPrompt = "You are the Da-Costa AI Assistant, an expert cybersecurity advisor for Da-Costa Svalinn protecting users in Nigeria and Africa from phishing, scams, deepfake audio, SMS fraud, and social engineering. User: " + name + " | Streak: " + streak + " days | Score: " + score + "/100 | Sentry: Active. Specialise in: 419 fraud, OTP theft, SIM swap, BEC attacks, EFCC/bank/government impersonation, WhatsApp voice deepfakes. Rules: Keep responses to 2-3 short paragraphs. Always end with a concrete action. Never request passwords, OTPs, or financial info. Reply in the same language the user writes in. Be warm, professional and empowering.";
    const conversationText = messages
      .map((m: any) => (m.role === 'user' ? 'User: ' : 'Assistant: ') + m.content)
      .join('\n\n');
    const geminiRes = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + apiKey,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents: [{ role: 'user', parts: [{ text: conversationText }] }],
          generationConfig: { maxOutputTokens: 1024, temperature: 0.7 },
        }),
      }
    );
    const geminiData = await geminiRes.json();
    if (!geminiRes.ok) {
      console.error('[dacosta-chat] Gemini API error:', JSON.stringify(geminiData));
      return NextResponse.json({ reply: 'AI service error. Please try again.' }, { status: 500 });
    }
    const reply = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to respond right now.';
    return NextResponse.json({ reply });
  } catch (error) {
    console.error('[dacosta-chat] error:', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { reply: 'Da-Costa AI is temporarily unavailable. Please try again.' },
      { status: 500 }
    );
  }
}