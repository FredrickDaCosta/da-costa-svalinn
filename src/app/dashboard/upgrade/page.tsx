'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Check, X, ArrowLeft, Info } from 'lucide-react';
import Link from 'next/link';
import { PaymentModal, type PurchaseableItem } from '@/components/dashboard/payment-modal';
import { useLocalization } from '@/hooks/use-localization';

export default function UpgradePage() {
  const { t } = useLocalization();
  const [selectedPlan, setSelectedPlan] = useState<PurchaseableItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const features = [
    { feature: t('upgrade_feature_link'), free: t('upgrade_free_limited'), premium: t('upgrade_premium_unlimited') },
    { feature: t('upgrade_feature_lure'), free: t('upgrade_free_limited'), premium: t('upgrade_premium_unlimited') },
    { feature: t('upgrade_feature_email'), free: t('upgrade_free_limited'), premium: t('upgrade_premium_unlimited') },
    { feature: t('upgrade_feature_video'), free: <X className="mx-auto size-5 text-destructive" />, premium: <Check className="mx-auto size-5 text-primary" /> },
    { feature: t('upgrade_feature_deepfake'), free: <X className="mx-auto size-5 text-destructive" />, premium: t('upgrade_premium_early') },
    { feature: t('upgrade_feature_priority'), free: <X className="mx-auto size-5 text-destructive" />, premium: t('upgrade_premium_priority') },
  ];

  const premiumPlans: PurchaseableItem[] = [
    { name: t('upgrade_plan_monthly_name'), price: t('upgrade_plan_monthly_price'), isSubscription: true },
    { name: t('upgrade_plan_annual_name'), price: t('upgrade_plan_annual_price'), isSubscription: true },
  ];

  const handleUpgradeClick = (plan: PurchaseableItem) => {
    setSelectedPlan(plan);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPlan(null);
  };

  return (
    <>
      <div className="max-w-4xl mx-auto space-y-8 p-4 md:p-0">
        <div className="sticky top-6 z-20 flex justify-start">
          <Button asChild variant="secondary" className="shadow-lg">
            <Link href="/dashboard/account">
              <ArrowLeft />
              {t('upgrade_back_button')}
            </Link>
          </Button>
        </div>

        <div className="text-center space-y-2">
          <h1 className="font-headline text-3xl md:text-4xl flex items-center justify-center gap-2">
            <span role="img" aria-label="rocket">🚀</span> {t('upgrade_page_title')}
          </h1>
          <p className="text-muted-foreground">{t('upgrade_page_subtitle')}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('upgrade_feature_comparison')}</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('upgrade_feature_col')}</TableHead>
                  <TableHead className="text-center w-1/4">{t('upgrade_free_col')}</TableHead>
                  <TableHead className="text-center w-1/4 text-primary font-bold">{t('upgrade_premium_col')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {features.map((item, idx) => (
                  <TableRow key={idx}>
                    <TableCell className="font-medium">{item.feature}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{item.free}</TableCell>
                    <TableCell className="text-center font-semibold text-primary">{item.premium}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <div className="space-y-4 text-center">
          <h2 className="font-headline text-2xl">{t('upgrade_pricing_title')}</h2>
          <Tabs defaultValue="annual" className="w-full max-w-md mx-auto">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="monthly">{t('upgrade_tab_monthly')}</TabsTrigger>
              <TabsTrigger value="annual">{t('upgrade_tab_annual')}</TabsTrigger>
            </TabsList>
            <TabsContent value="monthly">
              <Card>
                <CardHeader>
                  <CardTitle>{t('upgrade_plan_monthly_name')}</CardTitle>
                  <CardDescription className="text-2xl font-bold">
                    {t('upgrade_plan_monthly_price')} <span className="text-sm font-normal text-muted-foreground">{t('upgrade_plan_monthly_period')}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" onClick={() => handleUpgradeClick(premiumPlans[0])}>
                    {t('upgrade_choose_monthly')}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
            <TabsContent value="annual">
              <Card className="border-2 border-primary shadow-lg">
                <CardHeader>
                  <CardTitle>{t('upgrade_plan_annual_name')}</CardTitle>
                  <CardDescription className="text-2xl font-bold">
                    {t('upgrade_plan_annual_price')} <span className="text-sm font-normal text-muted-foreground">{t('upgrade_plan_annual_period')}</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button className="w-full" onClick={() => handleUpgradeClick(premiumPlans[1])}>
                    {t('upgrade_choose_annual')}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <Card className="bg-muted/50 border-primary/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="size-5 text-primary" />
              {t('upgrade_billing_title')}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-[12px] leading-relaxed text-muted-foreground space-y-2">
            <p><strong>{t('upgrade_billing_label_1')}</strong> {t('upgrade_billing_1')}</p>
            <p><strong>{t('upgrade_billing_label_2')}</strong> {t('upgrade_billing_2')}</p>
            <p><strong>{t('upgrade_billing_label_3')}</strong> {t('upgrade_billing_3')}</p>
            <p><strong>{t('upgrade_billing_label_4')}</strong> {t('upgrade_billing_4')}</p>
            <Link href="/terms-of-service" className="text-primary hover:underline block pt-2">
              {t('upgrade_billing_terms_link')}
            </Link>
          </CardContent>
        </Card>

        <div className="flex flex-col items-center gap-4">
          <Button variant="link" asChild>
            <Link href="/dashboard">{t('upgrade_no_thanks')}</Link>
          </Button>
          <Button asChild variant="secondary" className="shadow-lg">
            <Link href="/dashboard/account">
              <ArrowLeft />
              {t('upgrade_back_button')}
            </Link>
          </Button>
        </div>

        <div className="text-center text-xs text-muted-foreground space-y-1 pt-4 border-t">
          <p className="font-bold">{t('upgrade_footer_title')}</p>
          <p>{t('upgrade_footer_1')}</p>
          <p>{t('upgrade_footer_2')}</p>
          <p>{t('upgrade_footer_3')}</p>
        </div>
      </div>

      <PaymentModal
        item={selectedPlan}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </>
  );
}
