'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Building2, Layers, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useLocalization } from '@/hooks/use-localization';

const B2B_EMAIL = 'fad@da-costa.online';

const B2B_PLANS = [
  {
    icon: Layers,
    name: 'API Starter',
    price: '₦300,000/month',
    description: 'Link + Email scan API, 10,000 calls/month',
  },
  {
    icon: Building2,
    name: 'API Business',
    price: '₦1,000,000/month',
    description: 'All 5 scan APIs, 100,000 calls/month, SLA',
  },
  {
    icon: ShieldCheck,
    name: 'White-Label Enterprise',
    price: 'Custom pricing',
    description: 'Full Svalinn rebranded for your organisation',
  },
];

export default function UpgradePage() {
  const { t } = useLocalization();

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4 md:p-0">
      <div className="sticky top-6 z-20 flex justify-start">
        <Button asChild variant="secondary" className="shadow-lg">
          <Link href="/dashboard">
            <ArrowLeft />
            Back to Dashboard
          </Link>
        </Button>
      </div>

      <div className="text-center space-y-2">
        <h1 className="font-headline text-3xl md:text-4xl">{t('b2b_enterprise_title')}</h1>
        <p className="text-muted-foreground">Protecting organisations across Africa</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {B2B_PLANS.map((plan) => (
          <Card key={plan.name} className="border-primary/20">
            <CardHeader>
              <plan.icon className="size-6 text-primary mb-2" />
              <CardTitle className="text-lg">{plan.name}</CardTitle>
              <CardDescription className="text-xl font-bold text-foreground">{plan.price}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{plan.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6 text-center space-y-2">
          <p className="text-sm text-muted-foreground">{t('b2b_contact_text')}</p>
          <a
            href={`mailto:${B2B_EMAIL}`}
            className="text-primary font-semibold hover:underline"
          >
            {B2B_EMAIL}
          </a>
        </CardContent>
      </Card>

      <p className="text-center text-xs text-muted-foreground">
        Individual users — Da-Costa Svalinn is completely free. No account needed for scanning.
      </p>

      <div className="flex flex-col items-center gap-4 pt-2">
        <Button asChild variant="secondary" className="shadow-lg">
          <Link href="/dashboard">
            <ArrowLeft />
            Back to Dashboard
          </Link>
        </Button>
      </div>
    </div>
  );
}
