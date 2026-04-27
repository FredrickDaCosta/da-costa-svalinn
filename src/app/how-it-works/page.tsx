'use client';

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ShieldCheck, Zap, Lock, Activity } from 'lucide-react';
import { useLocalization } from '@/hooks/use-localization';

export default function HowItWorksPage() {
  const router = useRouter();
  const { t } = useLocalization();

  const guideItems = [
    {
      icon: Zap,
      titleKey: 'guide_card1_title',
      bodyKey: 'guide_card1_body',
    },
    {
      icon: Lock,
      titleKey: 'guide_card2_title',
      bodyKey: 'guide_card2_body',
    },
    {
      icon: Activity,
      titleKey: 'guide_card3_title',
      bodyKey: 'guide_card3_body',
    },
  ];

  return (
    <div className="relative flex min-h-screen flex-col items-center overflow-hidden bg-gradient-to-br from-[#0B0F1A] to-[#111827] p-4 py-12 text-foreground">
       <div className="absolute inset-0 z-0 opacity-5 [mask-image:radial-gradient(100%_100%_at_50%_0%,white,transparent)]">
        <div className="absolute inset-0 animate-[pulse_8s_ease-in-out_infinite] bg-primary/40 blur-3xl"></div>
      </div>

      <div className="z-10 flex w-full max-w-2xl animate-in fade-in-50 duration-700 flex-col items-center text-center">
        <ShieldCheck className="size-16 text-primary mb-4" />
        <h1 className="font-headline text-3xl md:text-4xl font-bold tracking-tight">
          {t('guide_title')}
        </h1>
        <p className="mt-2 text-base text-muted-foreground">
          {t('perimeter_active_subtitle')}
        </p>
        
        <div className="mt-12 w-full space-y-6">
          {guideItems.map((item, index) => (
            <Card key={index} className="border-primary/10 bg-card/50 text-left backdrop-blur-md animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${index * 150}ms` }}>
              <CardHeader className="flex flex-row items-center gap-4">
                <item.icon className="size-8 text-accent" />
                <CardTitle className="font-headline text-xl text-foreground">{t(item.titleKey as any)}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{t(item.bodyKey as any)}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Button
          onClick={() => router.push('/dashboard')}
          className="mt-12 w-full max-w-sm font-bold bg-primary text-primary-foreground hover:bg-primary/90 py-6 text-base shadow-lg shadow-primary/20 uppercase tracking-wider"
          size="lg"
        >
          {t('guide_return_to_dashboard_button')}
        </Button>
      </div>
    </div>
  );
}
