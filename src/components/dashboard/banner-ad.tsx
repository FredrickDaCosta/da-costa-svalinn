'use client';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useLocalization } from '@/hooks/use-localization';
import { useFirestore } from '@/firebase';
import { logAdminEvent } from '@/lib/firestore-writes';
import { useAuth } from '@/hooks/use-auth';

// AdSense publisher ID — set via env var, falls back to Google test ID
const AD_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID || 'ca-pub-3940256099942544';
const AD_SLOT = process.env.NEXT_PUBLIC_ADSENSE_SLOT || '6300978111';

export function BannerAd() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);
  const { t } = useLocalization();
  const pathname = usePathname();
  const [adFilled, setAdFilled] = useState(false);
  const firestore = useFirestore();
  const { user } = useAuth();

  useEffect(() => {
    if (!isClient) return;
    try {
              // @ts-expect-error AdSense global not in TypeScript types
              (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error('AdSense error:', err);
    }
  }, [isClient, pathname]);

  // Check if ad filled and log impression
  useEffect(() => {
    if (!isClient) return;
    const timer = setTimeout(() => {
      const insEl = document.querySelector('.adsbygoogle');
      if (insEl) {
        const filled = insEl.getAttribute('data-ad-status') === 'filled';
        setAdFilled(filled);
        // Log ad impression for admin metrics
        if (filled && firestore && user?.uid) {
          logAdminEvent(firestore, {
            type: 'ad_impression',
            userId: user.uid,
            amount: 0,
            timestamp: new Date().toISOString(),
            metadata: { pathname, adSlot: AD_SLOT },
          });
        }
      }
    }, 2000);
    return () => clearTimeout(timer);
  }, [isClient, pathname, firestore, user?.uid]);

  if (!isClient) return null;

  return (
    <div
      className="w-full flex flex-col items-center overflow-hidden transition-all"
      style={{ maxHeight: adFilled ? 70 : 0, opacity: adFilled ? 1 : 0 }}
      aria-hidden={!adFilled}
    >
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
