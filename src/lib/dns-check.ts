export type EmailAuthResult = {
  spf: boolean | null;
  dmarc: boolean | null;
  suspicious: boolean;
  details: string[];
};

export async function checkEmailAuthentication(domain: string): Promise<EmailAuthResult> {
  try {
    const details: string[] = [];
    const dohBase = 'https://dns.google/resolve';

    const spfRes = await fetch(dohBase + '?name=' + encodeURIComponent(domain) + '&type=TXT');
    const spfData = await spfRes.json();
    const txtRecords: string[] = (spfData?.Answer || [])
      .map((r: any) => r.data || '')
      .filter(Boolean);

    const hasSPF = txtRecords.some((r) => r.includes('v=spf1'));
    if (hasSPF) details.push('SPF record found');
    else details.push('No SPF record — spoofing risk');

    const dmarcRes = await fetch(dohBase + '?name=' + encodeURIComponent('_dmarc.' + domain) + '&type=TXT');
    const dmarcData = await dmarcRes.json();
    const dmarcRecords: string[] = (dmarcData?.Answer || [])
      .map((r: any) => r.data || '')
      .filter(Boolean);

    const hasDMARC = dmarcRecords.some((r) => r.includes('v=DMARC1'));
    if (hasDMARC) details.push('DMARC policy found');
    else details.push('No DMARC policy — impersonation risk');

    return {
      spf: hasSPF,
      dmarc: hasDMARC,
      suspicious: !hasSPF || !hasDMARC,
      details,
    };
  } catch (error) {
    console.error('[dns-check] Error:', error instanceof Error ? error.message : String(error));
    return { spf: null, dmarc: null, suspicious: false, details: [] };
  }
}
