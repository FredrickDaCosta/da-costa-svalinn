'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Play, Loader2, ShieldCheck, Tv2 } from 'lucide-react';
import { useLocalization } from '@/hooks/use-localization';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

const REWARDED_AD_UNIT_ID = 'ca-app-pub-3940256099942544/5224354917';
const REWARD_CREDITS = 3;
const SIMULATED_AD_DURATION_MS = 5000;

type AdState = 'idle' | 'loading' | 'playing' | 'success' | 'error';

export function RewardedAd() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);
  const { t } = useLocalization();
  const { user, addCredits } = useAuth();
  const { toast } = useToast();
  const [adState, setAdState] = useState<AdState>('idle');
  const [countdown, setCountdown] = useState(0);


  const handleWatchAd = async () => {
    setAdState('loading');
    await new Promise(r => setTimeout(r, 1200));
    setAdState('playing');
    let timeLeft = Math.floor(SIMULATED_AD_DURATION_MS / 1000);
    setCountdown(timeLeft);
    const countdownInterval = setInterval(() => {
      timeLeft -= 1;
      setCountdown(timeLeft);
      if (timeLeft <= 0) {
        clearInterval(countdownInterval);
        onAdComplete();
      }
    }, 1000);
  };

  const onAdComplete = async () => {
    await addCredits(REWARD_CREDITS);
    setAdState('success');
    toast({ title: t('ad_rewarded_success_title'), description: t('ad_rewarded_success_desc') });
    setTimeout(() => setAdState('idle'), 3500);
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-accent/5 shadow-md">
      <CardContent className="p-4">
        {adState === 'idle' && (
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-3 flex-1">
              <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Tv2 className="size-5 text-primary" />
              </div>
              <div>
                <p className="font-bold text-sm text-foreground">{t('ad_rewarded_title')}</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{t('ad_rewarded_desc')}</p>
              </div>
            </div>
            <Button onClick={handleWatchAd} className="w-full sm:w-auto shrink-0 gap-2 font-bold" size="sm">
              <Play className="size-4" />
              {t('ad_rewarded_button')}
            </Button>
          </div>
        )}
        {adState === 'loading' && (
          <div className="flex items-center justify-center gap-3 py-2">
            <Loader2 className="size-5 animate-spin text-primary" />
            <p className="text-sm font-medium">{t('ad_rewarded_watching')}</p>
          </div>
        )}
        {adState === 'playing' && (
          <div className="flex flex-col items-center gap-3 py-2">
            <div className="w-full max-w-sm h-[100px] rounded-lg bg-black flex items-center justify-center relative overflow-hidden border border-primary/20">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 animate-pulse" />
              <div className="relative z-10 text-center">
                <p className="text-[9px] text-white/50 uppercase tracking-widest mb-1">{t('ad_banner_label')}</p>
                <div className="size-8 rounded-full bg-white/20 flex items-center justify-center mx-auto">
                  <Play className="size-4 text-white fill-white" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-32 rounded-full bg-muted overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all duration-1000" style={{ width: `${((5 - countdown) / 5) * 100}%` }} />
              </div>
              <span className="text-xs font-bold text-primary tabular-nums">{countdown}s</span>
            </div>
          </div>
        )}
        {adState === 'success' && (
          <div className="flex items-center gap-3 py-1">
            <div className="size-10 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
              <ShieldCheck className="size-5 text-green-500" />
            </div>
            <div>
              <p className="font-bold text-sm text-green-500">{t('ad_rewarded_success_title')}</p>
              <p className="text-xs text-muted-foreground">{t('ad_rewarded_success_desc')}</p>
            </div>
          </div>
        )}
        {adState === 'error' && (
          <div className="text-center py-1">
            <p className="text-sm text-destructive">{t('ad_rewarded_failed')}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
