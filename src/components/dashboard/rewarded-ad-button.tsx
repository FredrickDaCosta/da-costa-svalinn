'use client';
/**
 * Rewarded Ad Button
 *
 * Allows users to earn credits by watching a rewarded ad.
 * Uses Google AdSense rewarded ad format.
 * Part of the reward-based monetization system.
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Eye, Loader2, Check, Coins } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

export function RewardedAdButton() {
  const { claimRewardedAd } = useAuth();
  const { toast } = useToast();
  const [watching, setWatching] = useState(false);
  const [cooldown, setCooldown] = useState(false);

  const handleWatch = async () => {
    if (watching || cooldown) return;
    setWatching(true);

    // Simulate ad watching (in production, this would be a real AdSense rewarded ad)
    await new Promise(resolve => setTimeout(resolve, 3000));

    const success = await claimRewardedAd();
    if (success) {
      toast({
        title: 'Credit Earned!',
        description: '+1 credit for watching the ad.',
      });
      setCooldown(true);
      setTimeout(() => setCooldown(false), 30_000); // 30s cooldown
    }

    setWatching(false);
  };

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleWatch}
        disabled={watching || cooldown}
        className="gap-2"
      >
        {watching ? (
          <Loader2 className="animate-spin size-4" />
        ) : cooldown ? (
          <Check className="size-4 text-green-500" />
        ) : (
          <Eye className="size-4" />
        )}
        {watching ? 'Watching...' : cooldown ? 'Earned!' : 'Watch Ad'}
      </Button>
      <Badge variant="secondary" className="gap-1">
        <Coins className="size-3" />
        +1
      </Badge>
    </div>
  );
}
