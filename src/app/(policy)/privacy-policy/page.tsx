'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useLocalization } from '@/hooks/use-localization';

export default function PrivacyPolicyPage() {
  const { t } = useLocalization();

  return (
    <div className="space-y-8 pb-20">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl font-bold">{t('policy_privacy_title')}</h1>
          <p className="text-muted-foreground">{t('policy_version_date')}</p>
        </div>
        <Badge variant="outline">{t('policy_compliance_status')}</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline">{t('policy_privacy_intro_title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-muted-foreground">
          <p>
            {t('policy_privacy_intro_p1')}
          </p>
        </CardContent>
      </Card>

      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-2xl font-headline text-primary">{t('policy_privacy_email_title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="font-semibold text-foreground italic">
            {t('policy_privacy_email_p1')}
          </p>
          <div className="space-y-4 text-sm text-muted-foreground">
            <div>
              <h3 className="font-bold text-foreground">{t('policy_privacy_email_processing_title')}</h3>
              <p>{t('policy_privacy_email_processing_p1')}</p>
            </div>
            <div>
              <h3 className="font-bold text-foreground">{t('policy_privacy_email_retention_title')}</h3>
              <p>{t('policy_privacy_email_retention_p1')}</p>
            </div>
            <div>
              <h3 className="font-bold text-foreground">{t('policy_privacy_email_storage_title')}</h3>
              <p>{t('policy_privacy_email_storage_p1')}</p>
            </div>
            <div>
              <h3 className="font-bold text-foreground">{t('policy_privacy_email_control_title')}</h3>
              <p>{t('policy_privacy_email_control_p1')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline">{t('policy_privacy_guarantees_title')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border p-4">
            <h3 className="font-bold">{t('policy_privacy_guarantee1_title')}</h3>
            <p className="text-xs text-muted-foreground">{t('policy_privacy_guarantee1_desc')}</p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-bold">{t('policy_privacy_guarantee2_title')}</h3>
            <p className="text-xs text-muted-foreground">{t('policy_privacy_guarantee2_desc')}</p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-bold">{t('policy_privacy_guarantee3_title')}</h3>
            <p className="text-xs text-muted-foreground">{t('policy_privacy_guarantee3_desc')}</p>
          </div>
          <div className="rounded-lg border p-4">
            <h3 className="font-bold">{t('policy_privacy_guarantee4_title')}</h3>
            <p className="text-xs text-muted-foreground">{t('policy_privacy_guarantee4_desc')}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-headline">{t('policy_privacy_rights_title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 text-muted-foreground">
          <p>
            {t('policy_privacy_rights_p1')}
          </p>
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
