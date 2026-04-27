'use client';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Activity, History, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useLocalization } from '@/hooks/use-localization';

export default function LinkScrutinizerPage() {
  const router = useRouter();
  const { t } = useLocalization();

  const getStatusKey = (status: string) => {
    return `link_scrutinizer_log_status_${status}` as any;
  };
  
  const mockLogs = [
    { id: 1, url: 'https://verify-nigeria-bank.com/login', status: 'malicious', time: '12 mins ago', detail: t('link_scrutinizer_log_detail_typo') },
    { id: 2, url: 'https://google.com', status: 'safe', time: '45 mins ago', detail: t('link_scrutinizer_log_detail_verified') },
    { id: 3, url: 'https://bit.ly/3x8sk2P', status: 'suspicious', time: '2 hours ago', detail: t('link_scrutinizer_log_detail_obfuscated') },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl md:text-4xl">{t('link_scrutinizer_page_title')}</h1>
          <p className="text-muted-foreground">{t('link_scrutinizer_page_desc')}</p>
        </div>
        <Badge variant="outline" className="flex gap-2 py-1 px-3 border-primary/30 bg-primary/5">
          <Activity className="size-4 animate-pulse text-primary" /> 
          {t('link_scrutinizer_sentry_status')}
        </Badge>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <History className="text-primary" /> {t('link_scrutinizer_logs_title')}
            </CardTitle>
            <CardDescription>
              {t('link_scrutinizer_logs_desc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mockLogs.map(log => (
              <div key={log.id} className="flex flex-col md:flex-row md:items-start justify-start p-4 border rounded-lg hover:bg-muted/50 transition-colors gap-4 text-left">
                <div className="flex flex-col flex-1 items-start max-w-full overflow-hidden">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm truncate max-w-md">{log.url}</span>
                    <span className="text-[10px] text-muted-foreground">{log.time}</span>
                  </div>
                  <span className="text-[10px] text-primary font-medium uppercase">{log.detail}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={log.status === 'malicious' ? 'destructive' : log.status === 'suspicious' ? 'secondary' : 'default'} className="text-[10px]">
                    {t(getStatusKey(log.status))}
                  </Badge>
                </div>
              </div>
            ))}
            <Button variant="outline" className="w-full" onClick={() => { sessionStorage.setItem('historyFilter', 'link'); router.push('/dashboard/history'); }}>
              {t('link_scrutinizer_full_history_button')}
            </Button>
          </CardContent>
        </Card>

        <Card className="bg-primary/5 border-primary/20 border-dashed">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <ShieldCheck className="text-primary size-5" /> 
              {t('link_scrutinizer_autonomous_title')}
            </CardTitle>
            <CardDescription>
              {t('link_scrutinizer_autonomous_desc')}
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  );
}
