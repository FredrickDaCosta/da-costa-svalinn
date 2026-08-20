'use client';

import { ShieldAlert } from 'lucide-react';
import { useLocalization } from '@/hooks/use-localization';

const DANGER_MARKERS = [
  'unsafe',
  'suspicious',
  'malicious',
  'phishing',
  'danger',
  'critical',
  'high_risk',
];

type AffiliateOfferProps = {
  verdict: string;
  scanType: string;
};

export function AffiliateOffer({ verdict }: AffiliateOfferProps) {
  const { t } = useLocalization();
  const v = (verdict || '').toLowerCase();
  const isDangerous = DANGER_MARKERS.some((marker) => v.includes(marker));

  if (!isDangerous) return null;

  return (
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 mt-4 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldAlert className="size-4 text-primary" />
        <span className="text-sm font-bold">{t('affiliate_offer_title')}</span>
      </div>
      <p className="text-xs text-muted-foreground">{t('affiliate_offer_text')}</p>
      <div className="flex flex-col gap-2">
        <a
          href="https://nordvpn.com"
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-xs font-medium text-primary hover:underline"
        >
          🔒 NordVPN — Secure your connection
        </a>
        <a
          href="https://malwarebytes.com"
          target="_blank"
          rel="noopener noreferrer nofollow"
          className="text-xs font-medium text-primary hover:underline"
        >
          🛡 Malwarebytes — Full device scan
        </a>
      </div>
      <p className="text-[10px] text-muted-foreground/60">{t('affiliate_disclaimer')}</p>
    </div>
  );
}
