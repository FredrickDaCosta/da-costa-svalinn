'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { useLocalization } from '@/hooks/use-localization';
import { Timer } from 'lucide-react';

const PURGE_TIMEOUT_SECONDS = 60;

type ResultCardProps = {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  clearResult: () => void;
};

export function ResultCard({ title, icon, children, clearResult }: ResultCardProps) {
  const { t } = useLocalization();
  const [remaining, setRemaining] = useState(PURGE_TIMEOUT_SECONDS);

  useEffect(() => {
    const timer = setTimeout(() => {
      clearResult();
    }, PURGE_TIMEOUT_SECONDS * 1000);

    const interval = setInterval(() => {
      setRemaining(r => Math.max(r - 1, 0));
    }, 1000);

    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [clearResult]);

  const progress = (remaining / PURGE_TIMEOUT_SECONDS) * 100;

  return (
    <Card className="relative overflow-hidden border-primary/20 bg-primary/5">
      <CardHeader className="flex flex-row items-center gap-4 space-y-0">
        {icon}
        <CardTitle className="font-headline">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
      <CardFooter className="flex-col items-center gap-4 pt-6">
        <Button onClick={clearResult} className="w-full">
          {t('manual_scan_new_scan_button')}
        </Button>
        <div className="flex w-full flex-col items-center gap-2 pt-2 text-xs text-muted-foreground">
            <div className="flex w-full items-center gap-2">
                <Timer className="size-4 animate-pulse text-primary" />
                <span className="font-semibold">{t('manual_scan_purging_in', { seconds: remaining })}</span>
            </div>
            <Progress value={progress} className="h-1 w-full" />
        </div>
      </CardFooter>
    </Card>
  );
}
