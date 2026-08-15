export async function callNemotron(
  systemPrompt: string,
  userPrompt: string,
  temperature?: number,
  maxTokens?: number
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not set');
  }

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + apiKey,
      'HTTP-Referer': 'https://da-costa-svalinn.com',
      'X-Title': 'Da-Costa Svalinn',
    },
    body: JSON.stringify({
      model: 'nvidia/nemotron-3-ultra-550b-a55b:free',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: temperature ?? 0.3,
      max_tokens: maxTokens ?? 1024,
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('[openrouter] API error:', JSON.stringify(data));
    throw new Error('OpenRouter API error');
  }

  const text: string = data?.choices?.[0]?.message?.content || '';
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  return cleaned;
}
