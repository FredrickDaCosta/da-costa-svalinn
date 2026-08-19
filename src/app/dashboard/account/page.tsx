'use client';

import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ShieldCheck, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { LanguageSelector } from '@/components/dashboard/language-selector';
import { useLocalization } from '@/hooks/use-localization';

export default function AccountPage() {
  const { user } = useAuth();
  const { t } = useLocalization();

  return (
    <>
      <div className="space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="font-headline text-3xl md:text-4xl">{t('account_page_title')}</h1>
            <p className="text-muted-foreground">
              {t('account_page_desc')}
            </p>
          </div>
          {user.sentryMode === 'limited' && (
            <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-3 animate-in fade-in slide-in-from-right-4">
              <AlertTriangle className="size-5 text-destructive" />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-destructive uppercase">{t('account_limited_protection')}</span>
                <span className="text-[10px] text-muted-foreground">{t('account_limited_protection_desc')}</span>
              </div>
              <Button size="sm" variant="destructive" asChild className="ml-2">
                <Link href="/dashboard/disclosure">{t('account_upgrade_mode')}</Link>
              </Button>
            </div>
          )}
        </div>

        <LanguageSelector />

        <Card className="border-primary/30 bg-background">
          <CardContent className="flex flex-col md:flex-row items-center gap-4 p-6">
            <div className="flex items-center justify-center size-12 rounded-full bg-primary/10 border border-primary/30 shrink-0">
              <ShieldCheck className="size-6 text-primary" />
            </div>
            <div className="text-center md:text-left">
              <h3 className="font-headline text-lg text-primary">{t('account_free_badge_title')}</h3>
              <p className="text-sm text-muted-foreground">{t('account_free_badge_desc')}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
