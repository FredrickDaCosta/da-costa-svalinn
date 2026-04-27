'use client';
import { Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useLocalization } from '@/hooks/use-localization';

export function PremiumLock() {
  const { t } = useLocalization();
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-lg bg-card/70 p-4 text-center backdrop-blur-sm">
      <div className="flex items-center justify-center size-16 rounded-full bg-accent/20 border-2 border-dashed border-accent">
        <Lock className="size-8 text-accent" />
      </div>
      <h3 className="font-headline text-2xl text-accent">{t('premium_lock_title' as any)}</h3>
      <p className="max-w-xs text-muted-foreground">
        {t('premium_lock_desc' as any)}
      </p>
      <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
        <Link href="/dashboard/upgrade">{t('premium_lock_btn' as any)}</Link>
      </Button>
    </div>
  );
}
