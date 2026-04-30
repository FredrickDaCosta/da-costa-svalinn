'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, CreditCard, Rocket, Star, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import { PaymentModal, type PurchaseableItem } from '@/components/dashboard/payment-modal';
import { LanguageSelector } from '@/components/dashboard/language-selector';
import { useLocalization } from '@/hooks/use-localization';

export default function AccountPage() {
  const { user } = useAuth();
  const [selectedPack, setSelectedPack] = useState<PurchaseableItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const { t } = useLocalization();

  const creditPacks: PurchaseableItem[] = [
    { name: t('credit_pack_starter'), scans: 10, price: t('credit_pack_starter_price' as any) },
    { name: t('credit_pack_standard'), scans: 50, price: t('credit_pack_standard_price' as any) },
    { name: t('credit_pack_pro'), scans: 100, price: t('credit_pack_pro_price' as any) },
  ];

  const handlePurchaseClick = (pack: PurchaseableItem) => {
    setSelectedPack(pack);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedPack(null);
  };

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

        {/* Top Billing Grid */}
        <div className="grid gap-6 lg:grid-cols-5">
          <div className="lg:col-span-3 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="font-headline">{t('account_subscription_status')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <h3 className="font-bold">{t('account_current_plan')}</h3>
                    <p className="text-muted-foreground">
                        {user.isPremium ? t('account_plan_status_premium') : t('account_plan_status_free')}
                    </p>
                  </div>
                  <Badge variant={user.isPremium ? "default" : "secondary"}
                    className={user.isPremium ? 'bg-primary text-primary-foreground' : ''}>
                    {user.isPremium ? t('account_plan_premium') : t('account_plan_free')}
                  </Badge>
                </div>

                <Card className="bg-muted/50 border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 font-headline text-accent">
                      <Rocket />
                      {t('account_explore_premium')}
                    </CardTitle>
                    <CardDescription>
                      {user.isPremium
                        ? t('account_explore_premium_desc_premium')
                        : t('account_explore_premium_desc_free')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="mb-4 space-y-2 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="size-4 text-primary" /> {t('account_feature_unlimited')}
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="size-4 text-primary" /> {t('account_feature_premium_auditors')}
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="size-4 text-primary" /> {t('account_feature_early_access')}
                      </li>
                    </ul>
                    <Button
                      asChild
                      className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      <Link href="/dashboard/upgrade">
                        <Star className="mr-2 size-4" />
                        {user.isPremium ? t('account_view_upgrades') : t('account_upgrade_now')}
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader>
                <CardTitle className="font-headline">{t('account_scan_credits')}</CardTitle>
                <CardDescription>{t('account_scan_credits_desc')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-center gap-4 rounded-lg bg-muted p-6">
                  <CreditCard className="size-8 text-primary" />
                  <div className="text-center">
                    <p className="text-3xl font-bold">{user.credits}</p>
                    <p className="text-sm text-muted-foreground">{t('account_scans_remaining')}</p>
                  </div>
                </div>
                <h3 className="font-semibold pt-4">{t('account_purchase_more')}</h3>
                <div className="space-y-2">
                  {creditPacks.map((pack) => (
                    <div key={pack.name} className="flex items-center justify-between rounded-md border p-3">
                      <div>
                        <p className="font-semibold">{pack.name} {t('credit_pack_scans_label', { count: (pack.scans || 0).toString() })}</p>
                        <p className="text-sm text-muted-foreground">{pack.price}</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => handlePurchaseClick(pack)}>{t('account_purchase_button')}</Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
      <PaymentModal
        item={selectedPack}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
      />
    </>
  );
}
