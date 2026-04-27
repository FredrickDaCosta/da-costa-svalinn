'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Activity, History, ShieldX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocalization } from '@/hooks/use-localization';

export default function VideoAuditorPage() {
  const router = useRouter();
  const { t } = useLocalization();

  const getStatusKey = (status: string) => {
    return `video_auditor_log_status_${status.toLowerCase()}` as any;
  }
  
  const mockLogs = [
    { id: 1, file: 'VID_20240801_123.mp4', status: 'critical', time: '15 mins ago', detail: t('video_auditor_log_detail_double_ext') },
    { id: 2, file: 'Funny_Cat.mp4', status: 'safe', time: '2 hours ago', detail: t('video_auditor_log_detail_verified') },
    { id: 3, file: 'Update_Package.mp4', status: 'high_risk', time: '5 hours ago', detail: t('video_auditor_log_detail_malformed') },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl md:text-4xl">{t('video_auditor_page_title')}</h1>
          <p className="text-muted-foreground">{t('video_auditor_page_desc')}</p>
        </div>
        <Badge variant="outline" className="flex gap-2 py-1 px-3 border-primary/30 bg-primary/5">
          <Activity className="size-4 animate-pulse text-primary" /> 
          {t('video_auditor_sentry_status')}
        </Badge>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <History className="text-primary" /> {t('video_auditor_logs_title')}
            </CardTitle>
            <CardDescription>
              {t('video_auditor_logs_desc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mockLogs.map(log => (
              <div key={log.id} className="flex flex-col md:flex-row md:items-start justify-start p-4 border rounded-lg hover:bg-muted/50 transition-colors gap-4 text-left">
                <div className="flex flex-col flex-1 items-start overflow-hidden">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm truncate max-w-md">{log.file}</span>
                    <span className="text-[10px] text-muted-foreground">{log.time}</span>
                  </div>
                  <span className="text-[10px] text-primary font-medium uppercase">{log.detail}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={log.status === 'critical' ? 'destructive' : log.status === 'high_risk' ? 'secondary' : 'default'} className="text-[10px]">
                    {t(getStatusKey(log.status)).replace('_', ' ')}
                  </Badge>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full" onClick={() => { sessionStorage.setItem('historyFilter', 'video'); router.push('/dashboard/history'); }}>
              {t('video_auditor_full_history_button')}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20 border-dashed">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldX className="text-destructive size-5" /> 
              {t('video_auditor_proactive_title')}
            </CardTitle>
            <CardDescription>
              {t('video_auditor_proactive_desc')}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
