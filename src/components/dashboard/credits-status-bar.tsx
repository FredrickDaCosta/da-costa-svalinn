'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useLocalization } from '@/hooks/use-localization';
import { Zap } from 'lucide-react';

const FREE_DAILY_SCANS = 5;

export function CreditsStatusBar() {
  const [isClient, setIsClient] = useState(false);
  useEffect(() => { setIsClient(true); }, []);
  const { user } = useAuth();
  const { t } = useLocalization();

  if (!isClient || user.isPremium) return null;

  const pct = Math.min((user.credits / FREE_DAILY_SCANS) * 100, 100);
  const isEmpty = user.credits <= 0;

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs border
      ${isEmpty
        ? 'border-destructive/30 bg-destructive/5 text-destructive'
        : 'border-primary/20 bg-primary/5 text-muted-foreground'
      }`}
    >
      <Zap className={`size-3 shrink-0 ${isEmpty ? 'text-destructive' : 'text-primary'}`} />
      <div className="flex-1">
        <div className="flex justify-between mb-0.5">
          <span className="font-medium">
            {isEmpty
              ? t('ad_zero_credits_hint')
              : t('ad_credits_remaining').replace('{count}', String(user.credits))
            }
          </span>
          {!isEmpty && <span className="text-muted-foreground/60">{user.credits}/{FREE_DAILY_SCANS}</span>}
        </div>
        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500
              ${isEmpty ? 'bg-destructive' : pct > 40 ? 'bg-primary' : 'bg-yellow-500'}`}
            style={{ width: `${Math.max(pct, isEmpty ? 0 : 4)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
