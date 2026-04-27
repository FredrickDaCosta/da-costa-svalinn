'use client';
import { useState, useEffect } from 'react';
import { useLocalization } from '@/hooks/use-localization';
import { useAuth } from '@/hooks/use-auth';

const BANNER_AD_UNIT_ID = 'ca-app-pub-3940256099942544/6300978111';

export function BannerAd() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);
  const { t } = useLocalization();
  const { user } = useAuth();

  if (!isClient || user.isPremium) return null;

  return (
    <div className="w-full flex flex-col items-center">
      <p className="text-[9px] text-muted-foreground/50 uppercase tracking-widest mb-0.5">
        {t('ad_banner_label')}
      </p>
      <div
        className="w-full max-w-[320px] h-[50px] rounded-sm overflow-hidden border border-border/30 bg-muted/40 flex items-center justify-center"
        data-ad-unit={BANNER_AD_UNIT_ID}
        aria-label={t('ad_banner_label')}
      >
        <div className="flex items-center gap-2 px-3 w-full h-full bg-gradient-to-r from-muted/60 to-muted/40">
          <div className="size-6 rounded bg-primary/20 flex items-center justify-center shrink-0">
            <span className="text-[8px] font-bold text-primary">AD</span>
          </div>
          <div className="flex-1 space-y-1">
            <div className="h-1.5 w-3/4 rounded bg-muted-foreground/20" />
            <div className="h-1.5 w-1/2 rounded bg-muted-foreground/15" />
          </div>
          <div className="text-[8px] text-muted-foreground/40 shrink-0">
            {BANNER_AD_UNIT_ID.slice(-8)}
          </div>
        </div>
      </div>
    </div>
  );
}
