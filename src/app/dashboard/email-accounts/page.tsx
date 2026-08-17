'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ShieldCheck, Mail, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { useLocalization } from '@/hooks/use-localization';

const B2B_EMAIL = 'fad@da-costa.online';

export default function EmailAccountsPage() {
  const { t } = useLocalization();

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="flex flex-col items-center text-center gap-4 pb-2">
          <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 border border-primary/30">
            <ShieldCheck className="h-7 w-7 text-primary" />
            <Mail className="h-4 w-4 text-primary absolute -bottom-1 -right-1 bg-background rounded-full p-0.5 border border-primary/30" />
          </div>
          <div className="space-y-1">
            <h1 className="font-headline text-2xl md:text-3xl">{t('linked_accounts_title')}</h1>
            <p className="text-primary font-semibold tracking-wide uppercase text-sm">{t('linked_accounts_coming_soon')}</p>
          </div>
          <Badge variant="outline" className="border-primary/40 text-primary text-[10px] tracking-wide">
            {t('linked_accounts_badge')}
          </Badge>
        </CardHeader>
        <CardContent className="space-y-6 text-center">
          <p className="text-muted-foreground text-sm leading-relaxed">
            {t('linked_accounts_description')}
          </p>
          <p className="text-xs text-muted-foreground/80">
            {t('linked_accounts_providers')}
          </p>

          <div className="border-t border-border/50 pt-6 space-y-2 text-left">
            <h2 className="font-headline text-lg text-center">{t('linked_accounts_b2b_heading')}</h2>
            <p className="text-sm text-muted-foreground text-center">
              {t('linked_accounts_b2b_text')}
            </p>
            <div className="flex justify-center">
              <a
                href={`mailto:${B2B_EMAIL}`}
                className="text-primary font-medium hover:underline"
              >
                {B2B_EMAIL}
              </a>
            </div>
          </div>

          <div className="border-t border-border/50 pt-6 space-y-3">
            <p className="text-sm text-muted-foreground">
              {t('linked_accounts_individual')}
            </p>
            <Button asChild variant="secondary">
              <Link href="/dashboard?scan=email">
                <Mail className="mr-2 h-4 w-4" />
                {t('nav_email_analyzer')}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
