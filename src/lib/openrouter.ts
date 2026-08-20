/**
 * DA-COSTA SVALINN — AI MODEL ARCHITECTURE
 *
 * SINGLE AI MODEL STACK (100% Free):
 *
 * NVIDIA Nemotron 3 Ultra (550B parameters)
 * Model: nvidia/nemotron-3-ultra-550b-a55b:free
 * Provider: OpenRouter (free tier)
 *
 * Used for ALL AI functions:
 * - Link/URL scanning (+ VirusTotal threat intel)
 * - Email analysis (+ DNS SPF/DMARC checking)
 * - SMS/Lure detection (+ VirusTotal URL extraction)
 * - Video metadata auditing
 * - Deepfake audio analysis
 * - Da-Costa Cybersecurity Analyst chat responses
 *
 * TRANSLATION STACK (100% Free):
 * Azure Translator F0 — South Africa North region
 * - Translates Nemotron English responses to user locale
 * - 30 languages supported natively
 * - 4 gap languages (pidgin, ti, wo, bm): Nemotron direct
 * - 2M characters/month free tier
 *
 * UI TRANSLATION (100% Free, Zero Runtime API calls):
 * - 34 static locale JSON files in src/locales/
 * - Served from disk — no API calls at runtime
 *
 * QUOTA: OpenRouter free tier
 * - 50 requests/day without credits
 * - Add $10 once for 1,000 requests/day permanently
 * - Da-Costa Svalinn and Da-Costa FC use SEPARATE keys
 */
export async function callNemotron(
  systemPrompt: string,
  userPrompt: string,
  temperature?: number,
  maxTokens?: number,
  signal?: AbortSignal
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
    signal: signal,
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('[openrouter] API error: status=' + res.status + ' body=' + JSON.stringify(data));
    throw new Error('OpenRouter API error: ' + res.status + ' ' + (data?.error?.message || JSON.stringify(data)));
  }

  const text: string = data?.choices?.[0]?.message?.content || '';
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  return cleaned;
}
