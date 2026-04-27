'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Activity, History } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocalization } from '@/hooks/use-localization';

export default function EmailAnalyzerPage() {
  const router = useRouter();
  const { t } = useLocalization();
  
  const getStatusKey = (status: string) => {
    return `email_analyzer_log_status_${status.toLowerCase()}` as any;
  }
  
  const mockLogs = [
    { id: 1, sender: 'finance@ceo-office.com', subject: 'Urgent Wire Update', result: 'high_risk', time: '2 mins ago', detail: t('email_analyzer_log_detail_mismatch') },
    { id: 2, sender: 'it-support@da-costa.app', subject: 'Password Reset', result: 'safe', time: '1 hour ago', detail: t('email_analyzer_log_detail_verified') },
    { id: 3, sender: 'unknown@nigeria-bank.com', subject: 'Account Verification', result: 'suspicious', time: '4 hours ago', detail: t('email_analyzer_log_detail_social') },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl md:text-4xl">{t('email_analyzer_page_title')}</h1>
          <p className="text-muted-foreground">{t('email_analyzer_page_desc')}</p>
        </div>
        <Badge variant="outline" className="flex gap-2 py-1 px-3 border-primary/30 bg-primary/5">
          <Activity className="size-4 animate-pulse text-primary" /> 
          {t('email_analyzer_sentry_status')}
        </Badge>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <History className="text-primary" /> {t('email_analyzer_logs_title')}
            </CardTitle>
            <CardDescription>
              {t('email_analyzer_logs_desc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mockLogs.map(log => (
              <div key={log.id} className="flex flex-col md:flex-row md:items-start justify-start p-4 border rounded-lg hover:bg-muted/50 transition-colors gap-4 text-left">
                <div className="flex flex-col flex-1 items-start">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{log.sender}</span>
                    <span className="text-[10px] text-muted-foreground">{log.time}</span>
                  </div>
                  <span className="text-xs text-muted-foreground italic mb-1">"{log.subject}"</span>
                  <span className="text-[10px] text-primary font-medium uppercase">{log.detail}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={log.result === 'high_risk' ? 'destructive' : log.result === 'suspicious' ? 'secondary' : 'default'} className="text-[10px]">
                    {t(getStatusKey(log.result)).replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full" onClick={() => { sessionStorage.setItem('historyFilter', 'email'); router.push('/dashboard/history'); }}>
              {t('email_analyzer_full_history_button')}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">{t('email_analyzer_autonomous_title')}</CardTitle>
            <CardDescription>
              {t('email_analyzer_autonomous_desc')}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
