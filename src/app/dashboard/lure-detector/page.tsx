'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Activity, History, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocalization } from '@/hooks/use-localization';

export default function LureDetectorPage() {
  const router = useRouter();
  const { t } = useLocalization();
  
  const mockLogs = [
    { id: 1, type: t('lure_detector_mock_type_whatsapp'), content: 'Win ₦500,000 cash prize now!', result: 'lure_detected', time: '8 mins ago', detail: t('lure_detector_mock_log_detail_giveaway') },
    { id: 2, type: t('lure_detector_mock_type_sms'), content: 'Your BVN has been suspended...', result: 'lure_detected', time: '1 hour ago', detail: t('lure_detector_mock_log_detail_phishing') },
    { id: 3, type: t('lure_detector_mock_type_telegram'), content: 'Join the new crypto signals group', result: 'safe', time: '3 hours ago', detail: t('lure_detector_mock_log_detail_invite') },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl md:text-4xl">{t('lure_detector_page_title')}</h1>
          <p className="text-muted-foreground">{t('lure_detector_page_desc')}</p>
        </div>
        <Badge variant="outline" className="flex gap-2 py-1 px-3 border-primary/30 bg-primary/5">
          <Activity className="size-4 animate-pulse text-primary" /> 
          {t('lure_detector_sentry_status')}
        </Badge>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <History className="text-primary" /> {t('lure_detector_logs_title')}
            </CardTitle>
            <CardDescription>
              {t('lure_detector_logs_desc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mockLogs.map(log => (
              <div key={log.id} className="flex flex-col md:flex-row md:items-start justify-start p-4 border rounded-lg hover:bg-muted/50 transition-colors gap-4 text-left">
                <div className="flex flex-col flex-1 items-start">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{log.type}</span>
                    <span className="text-[10px] text-muted-foreground">{log.time}</span>
                    <Badge variant="outline" className="text-[9px] py-0 h-4 ml-1">{log.detail}</Badge>
                  </div>
                  <span className="text-xs text-muted-foreground italic truncate max-w-md">"{log.content}"</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={log.result === 'lure_detected' ? 'destructive' : 'default'} className="text-[10px]">
                    {log.result === 'lure_detected' ? t('lure_detector_log_result_lure') : t('lure_detector_log_result_safe')}
                  </Badge>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full" onClick={() => { sessionStorage.setItem('historyFilter', 'lure'); router.push('/dashboard/history'); }}>
              {t('lure_detector_full_history_button')}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-lg">{t('lure_detector_zero_interaction_title')}</CardTitle>
            <CardDescription>
              {t('lure_detector_zero_interaction_desc')}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
