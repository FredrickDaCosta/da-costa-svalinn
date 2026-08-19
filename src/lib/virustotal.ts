export type VirusTotalResult = {
  positives: number;
  total: number;
  malicious: boolean;
  suspicious: boolean;
  harmless: number;
  detectionNames: string[];
};

export async function scanUrlWithVirusTotal(url: string): Promise<VirusTotalResult | null> {
  const apiKey = process.env.VIRUSTOTAL_API_KEY;
  if (!apiKey) {
    console.warn('[virustotal] VIRUSTOTAL_API_KEY not set — skipping');
    return null;
  }

  try {
    const submitRes = await fetch('https://www.virustotal.com/api/v3/urls', {
      method: 'POST',
      headers: {
        'x-apikey': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'url=' + encodeURIComponent(url),
    });

    if (!submitRes.ok) {
      console.error('[virustotal] Submit failed:', submitRes.status);
      return null;
    }

    const submitData = await submitRes.json();
    const analysisId = submitData?.data?.id;
    if (!analysisId) return null;

    await new Promise((resolve) => setTimeout(resolve, 3000));

    const resultRes = await fetch('https://www.virustotal.com/api/v3/analyses/' + analysisId, {
      headers: { 'x-apikey': apiKey },
    });

    if (!resultRes.ok) return null;

    const resultData = await resultRes.json();
    const stats = resultData?.data?.attributes?.stats;
    const results = resultData?.data?.attributes?.results;

    if (!stats) return null;

    const malicious = stats.malicious || 0;
    const suspicious = stats.suspicious || 0;
    const harmless = stats.harmless || 0;
    const total = malicious + suspicious + harmless + (stats.undetected || 0);

    const detectionNames = results
      ? Object.values(results as Record<string, any>)
          .filter((r: any) => r.category === 'malicious' || r.category === 'suspicious')
          .map((r: any) => r.engine_name)
          .slice(0, 5)
      : [];

    return {
      positives: malicious + suspicious,
      total,
      malicious: malicious > 0,
      suspicious: suspicious > 0,
      harmless,
      detectionNames,
    };
  } catch (error) {
    console.error('[virustotal] Error:', error instanceof Error ? error.message : String(error));
    return null;
  }
}
