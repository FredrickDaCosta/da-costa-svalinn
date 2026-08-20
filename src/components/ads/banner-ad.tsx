'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

// TODO: Replace with real AdSense publisher ID once approved — adsense.google.com
const AD_CLIENT = 'ca-pub-3940256099942544';

export function BannerAd() {
  const pathname = usePathname();

  useEffect(() => {
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error('AdSense error:', err);
    }
  }, [pathname]);

  return (
    <div
      className="fixed bottom-0 left-0 w-full h-[60px] bg-black/80 border-t border-primary/20 z-10 flex items-center justify-center"
      aria-label="Advertisement"
    >
      <div className="w-full h-full">
        <ins
          key={pathname}
          className="adsbygoogle"
          style={{ display: 'block', width: '100%', height: '60px' }}
          data-ad-client={AD_CLIENT}
          data-ad-slot="6300978111"
          data-ad-format="auto"
          data-full-width-responsive="true"
        ></ins>
      </div>
    </div>
  );
}
