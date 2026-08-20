'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useLocalization } from '@/hooks/use-localization';

// TODO: Replace with real AdSense publisher ID once approved — adsense.google.com
const AD_CLIENT = 'ca-pub-3940256099942544';
const AD_SLOT = '6300978111';

export function BannerAd() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);
  const { t } = useLocalization();
  const pathname = usePathname();

  useEffect(() => {
    if (!isClient) return;
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error('AdSense error:', err);
    }
  }, [isClient, pathname]);

  if (!isClient) return null;

  return (
    <div className="w-full flex flex-col items-center">
      <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest mb-0.5">
        {t('ad_banner_label')}
      </p>
      <ins
        key={pathname}
        className="adsbygoogle"
        style={{ display: 'block', width: '100%', maxWidth: 320, height: 50 }}
        data-ad-client={AD_CLIENT}
        data-ad-slot={AD_SLOT}
        data-ad-format="auto"
        data-full-width-responsive="true"
      ></ins>
    </div>
  );
}
