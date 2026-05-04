'use client';
import { DcBackground } from '@/components/dc-background';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, Zap, Lock, Info } from 'lucide-react';
import { useLocalization } from '@/hooks/use-localization';

export default function PerimeterInitializedPage() {
  const router = useRouter();
  const { t } = useLocalization();

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#060b12] p-4 text-foreground">
      <DcBackground />
      <div className="absolute inset-0 z-0 opacity-20">
        <div className="absolute inset-0 animate-[pulse_4s_ease-in-out_infinite] bg-primary/60 blur-3xl"></div>
        <div className="absolute inset-0 animate-[pulse_6s_ease-in-out_2s_infinite] bg-accent/50 blur-3xl"></div>
      </div>
      
      <div className="z-10 flex w-full max-w-2xl animate-in fade-in-50 slide-in-from-bottom-5 duration-700 flex-col items-center text-center">
        <div className="relative mb-6">
          <ShieldCheck className="size-24 text-primary drop-shadow-[0_0_15px_hsl(var(--primary))]" />
          <div className="absolute inset-0 -z-10 animate-pulse rounded-full bg-primary/30 blur-2xl"></div>
        </div>

        <h1 className="font-headline text-3xl md:text-4xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-primary via-green-300 to-primary">
          {t('perimeter_active_title')}
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          {t('perimeter_active_subtitle')}
        </p>

        <Card className="mt-10 w-full border-primary/20 bg-[#0a1520]/70 backdrop-blur-md text-left backdrop-blur-md">
          <CardHeader>
            <CardTitle className="font-headline text-xl text-primary">{t('perimeter_initialized_card_title')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-sm text-muted-foreground">{t('perimeter_initialized_card_body')}</p>
            
            <div className="space-y-4 border-t border-primary/10 pt-4">
              <h3 className="font-bold text-base">{t('perimeter_what_happens_next')}</h3>
              
              <ul className="space-y-3 text-xs">
                <li className="flex items-start gap-3">
                  <Zap className="mt-0.5 size-4 shrink-0 text-accent" />
                  <div>
                    <strong className="text-foreground">
      <DcBackground />{t('perimeter_invisible_protection_title')}</strong>
                    <p className="text-muted-foreground">{t('perimeter_invisible_protection_body')}</p>
                  </div>
                </li>
                 <li className="flex items-start gap-3">
                  <Lock className="mt-0.5 size-4 shrink-0 text-accent" />
                  <div>
                    <strong className="text-foreground">
      <DcBackground />{t('perimeter_purge_title')}</strong>
                    <p className="text-muted-foreground">{t('perimeter_purge_body')}</p>
                  </div>
                </li>
                 <li className="flex items-start gap-3">
                  <Info className="mt-0.5 size-4 shrink-0 text-accent" />
                  <div>
                    <strong className="text-foreground">
      <DcBackground />{t('perimeter_stay_secure_title')}</strong>
                    <p className="text-muted-foreground">{t('perimeter_stay_secure_body')}</p>
                  </div>
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <div className="mt-10 flex w-full flex-col items-center gap-4">
          <Button
            onClick={() => router.push('/dashboard')}
            className="w-full max-w-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 py-7 text-lg shadow-lg shadow-primary/20 uppercase tracking-wider"
            size="lg"
          >
            {t('perimeter_enter_dashboard_button')}
          </Button>
          <Button asChild variant="link" size="sm" className="text-muted-foreground">
            <Link href="/how-it-works">{t('perimeter_how_it_works_link')}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
