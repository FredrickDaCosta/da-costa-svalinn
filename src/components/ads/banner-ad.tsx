'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

export function BannerAd() {
  const { user } = useAuth();
  const pathname = usePathname();

  useEffect(() => {
    if (user.isPremium) {
      return;
    }
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (err) {
      console.error('AdSense error:', err);
    }
  }, [user.isPremium, pathname]);

  if (user.isPremium) {
    return null;
  }

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
          data-ad-client="ca-app-pub-3940256099942544"
          data-ad-slot="6300978111"
          data-ad-format="auto"
          data-full-width-responsive="true"
        ></ins>
      </div>
    </div>
  );
}
