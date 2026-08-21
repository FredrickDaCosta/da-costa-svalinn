'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

// TODO: Replace with real AdSense publisher ID once approved — adsense.google.com
const AD_CLIENT = 'ca-pub-3940256099942544';

export function BannerAd() {
  const pathname = usePathname();
  const [adFilled, setAdFilled] = useState(false);

  useEffect(() => {
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error('AdSense error:', err);
    }
  }, [pathname]);

  // AdSense needs the <ins> tag mounted at its real size to have any chance
  // of being filled, so we can't unmount it before knowing the result —
  // instead the wrapper's visible footprint collapses until fill is
  // confirmed, rather than removing the ins from the DOM entirely.
  useEffect(() => {
    const timer = setTimeout(() => {
      const insEl = document.querySelector('.adsbygoogle');
      if (insEl) {
        setAdFilled(insEl.getAttribute('data-ad-status') === 'filled');
      }
    }, 2000); // Check 2 seconds after push
    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <div
      className="fixed bottom-0 left-0 w-full bg-black/80 border-t border-primary/20 z-10 flex items-center justify-center overflow-hidden transition-all"
      style={{ height: adFilled ? 60 : 0, opacity: adFilled ? 1 : 0 }}
      aria-label="Advertisement"
      aria-hidden={!adFilled}
    >
      <div className="w-full h-[60px] shrink-0">
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
