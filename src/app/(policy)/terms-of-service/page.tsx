'use client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useLocalization } from '@/hooks/use-localization';

export default function TermsOfServicePage() {
  const { t } = useLocalization();
  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold">{t('terms_page_title' as any)}</h1>
          <p className="text-muted-foreground">{t('policy_version_date')}</p>
        </div>
        <Badge variant="outline">{t('policy_compliance_status')}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline">{t('terms_section1_title' as any)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-muted-foreground">
          <p>{t('terms_section1_body' as any)}</p>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-2xl font-headline text-primary">{t('terms_section2_title' as any)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-4 text-sm text-muted-foreground">
            <div>
              <h3 className="font-bold text-foreground">{t('upgrade_billing_label_1')}</h3>
              <p>{t('terms_billing_plans_body' as any)}</p>
            </div>
            <div>
              <h3 className="font-bold text-foreground">{t('upgrade_billing_label_2')}</h3>
              <p>{t('upgrade_billing_2')}</p>
            </div>
            <div>
              <h3 className="font-bold text-foreground">{t('upgrade_billing_label_3')}</h3>
              <p>{t('upgrade_billing_3')}</p>
            </div>
            <div>
              <h3 className="font-bold text-foreground">{t('upgrade_billing_label_4')}</h3>
              <p>{t('terms_no_refunds_body' as any)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline">{t('terms_section3_title' as any)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-muted-foreground">
          <p>{t('terms_section3_body' as any)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline">{t('terms_section4_title' as any)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-muted-foreground">
          <p>{t('terms_section4_body' as any)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline">{t('terms_section5_title' as any)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-muted-foreground">
          <p>{t('terms_section5_body' as any)}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline">{t('terms_section6_title' as any)}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-muted-foreground">
          <Separator />
          <div className="text-center py-4">
            <p className="text-xs">{t('policy_footer_audit_id')}</p>
            <p className="text-xs">{t('policy_footer_signed')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
