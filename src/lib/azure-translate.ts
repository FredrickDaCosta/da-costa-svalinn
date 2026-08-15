export const AZURE_GAP_LOCALES = ['pidgin', 'ti', 'wo', 'bm'];

export function isAzureGapLocale(locale: string): boolean {
  return AZURE_GAP_LOCALES.includes(locale);
}

export async function translateText(text: string, targetLocale: string): Promise<string> {
  const key = process.env.AZURE_TRANSLATOR_KEY;
  const region = process.env.AZURE_TRANSLATOR_REGION;

  if (!key || !region) {
    console.warn('[azure-translate] AZURE_TRANSLATOR_KEY or AZURE_TRANSLATOR_REGION not set');
    return text;
  }

  if (isAzureGapLocale(targetLocale)) {
    return text;
  }

  if (targetLocale === 'en' || targetLocale === 'en-US') {
    return text;
  }

  try {
    const url =
      'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=' +
      encodeURIComponent(targetLocale);
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': key,
        'Ocp-Apim-Subscription-Region': region,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify([{ Text: text }]),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error('[azure-translate] API error:', JSON.stringify(data));
      return text;
    }

    const translated = data?.[0]?.translations?.[0]?.text;
    return translated || text;
  } catch (error) {
    console.error('[azure-translate] error:', error instanceof Error ? error.message : String(error));
    return text;
  }
}
