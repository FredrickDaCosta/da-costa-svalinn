'use client';
/**
 * Daily Login Bonus Card
 *
 * Shows the user's daily login bonus status, streak, and claim button.
 * Part of the reward-based monetization system.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Gift, Flame, Check, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';

export function DailyBonusCard() {
  const { user, claimDailyBonus, canClaimDailyBonus } = useAuth();
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  const streak = user.dailyBonusStreak || 0;
  const bonusAmount = 2 + Math.min(streak, 5); // Base + streak bonus

  const handleClaim = async () => {
    if (!canClaimDailyBonus || claiming) return;
    setClaiming(true);
    const success = await claimDailyBonus();
    if (success) setClaimed(true);
    setClaiming(false);
  };

  return (
    <Card className={canClaimDailyBonus && !claimed ? 'border-primary/40 bg-primary/5' : ''}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Gift className="size-4 text-primary" />
          Daily Login Bonus
          {streak > 0 && (
            <Badge variant="secondary" className="ml-auto">
              <Flame className="size-3 mr-1 text-orange-500" />
              {streak} day streak
            </Badge>
          )}
        </CardTitle>
        <CardDescription>Claim free credits every day</CardDescription>
      </CardHeader>
      <CardContent>
        {claimed ? (
          <div className="flex items-center gap-2 text-green-500 text-sm">
            <Check className="size-4" />
            <span>+{bonusAmount} credits claimed!</span>
          </div>
        ) : canClaimDailyBonus ? (
          <Button onClick={handleClaim} disabled={claiming} className="w-full" size="sm">
            {claiming ? (
              <Loader2 className="animate-spin size-4 mr-2" />
            ) : (
              <Gift className="size-4 mr-2" />
            )}
            Claim +{bonusAmount} Credits
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">Come back tomorrow for your next bonus!</p>
        )}
      </CardContent>
    </Card>
  );
}
