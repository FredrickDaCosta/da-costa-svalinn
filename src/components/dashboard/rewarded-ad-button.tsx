'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Gift, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore } from '@/firebase';
import { logAdminEvent } from '@/lib/firestore-writes';
import { useToast } from '@/hooks/use-toast';
import { useLocalization } from '@/hooks/use-localization';

const CREDITS_PER_REWARD = 3;

type RewardState = 'idle' | 'watching' | 'claiming' | 'claimed';

/**
 * RewardedAdButton — lets users earn scan credits by watching a rewarded ad.
 *
 * Currently uses a simulated ad flow (5s timer). When AdSense rewarded ads
 * are approved, replace the simulation with the real `google.ads.rewarded` API.
 *
 * Logs `rewarded_ad_completed` to adminEvents for revenue tracking.
 */
export function RewardedAdButton() {
  const { user, addCredits } = useAuth();
  const firestore = useFirestore();
  const { toast } = useToast();
  const { t } = useLocalization();
  const [state, setState] = useState<RewardState>('idle');

  const handleWatchAd = async () => {
    if (state !== 'idle' || !user?.uid) return;

    setState('watching');

    // ─── Simulated rewarded ad (5-second timer) ──────────────
    // Replace this block with real Google Ads rewarded ad SDK when approved.
    await new Promise((resolve) => setTimeout(resolve, 5000));

    setState('claiming');
    try {
      // Award credits
      await addCredits(CREDITS_PER_REWARD);

      // Log admin event for revenue tracking
      if (firestore) {
        await logAdminEvent(firestore, {
          type: 'rewarded_ad_completed',
          userId: user.uid,
          amount: CREDITS_PER_REWARD,
          timestamp: new Date().toISOString(),
          metadata: {
            adProvider: 'adsense_test',
            creditsAwarded: CREDITS_PER_REWARD,
          },
        });
      }

      setState('claimed');
      toast({
        title: `+${CREDITS_PER_REWARD} Credits Earned!`,
        description: 'Your scan credits have been updated.',
      });

      // Reset back to idle after 3 seconds
      setTimeout(() => setState('idle'), 3000);
    } catch (e: any) {
      setState('idle');
      toast({
        variant: 'destructive',
        title: 'Failed to claim reward',
        description: e.message,
      });
    }
  };

  return (
    <div className="flex items-center gap-3">
      <Button
        variant="outline"
        onClick={handleWatchAd}
        disabled={state !== 'idle'}
        className="border-primary/30 hover:bg-primary/10"
      >
        {state === 'idle' && (
          <>
            <Gift className="mr-2 size-4" />
            Watch Ad for +{CREDITS_PER_REWARD} Credits
          </>
        )}
        {state === 'watching' && (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Watching Ad...
          </>
        )}
        {state === 'claiming' && (
          <>
            <Loader2 className="mr-2 size-4 animate-spin" />
            Claiming...
          </>
        )}
        {state === 'claimed' && (
          <>
            <CheckCircle2 className="mr-2 size-4 text-green-500" />
            +{CREDITS_PER_REWARD} Claimed!
          </>
        )}
      </Button>
      <Badge variant="secondary" className="text-xs">
        {user?.credits ?? 0} credits
      </Badge>
    </div>
  );
}
