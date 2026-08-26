'use client';
// v1.3.0 — dashboard connected to live Firestore scan data, SOC components extracted

import { useAuth } from '@/hooks/use-auth';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useLocalization } from '@/hooks/use-localization';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ManualScanCenter, type ManualScanResult } from '@/components/dashboard/manual-scan-center';
import { useState } from 'react';
import {
  SOC_STYLES,
  MODULE_META,
  ThreatLevelMeter,
  BackgroundSentryBar,
  ArcGaugeCards,
  RadarCard,
  MonitoringRow,
  ActiveAlertsAndVelocity,
  OperationalPie,
  SecurityPostureScore,
  PerimeterAlerts,
  type SocLevel,
} from '@/components/dashboard/soc';

export default function DashboardPage() {
  const { user: authUser, isLoading: isUserLoading } = useAuth();
  const { user: firebaseUser } = useUser();
  const firestore = useFirestore();
  const { t } = useLocalization();
  const [manualScanResult, setManualScanResult] = useState<ManualScanResult | null>(null);

  const recentAlertsQuery = useMemoFirebase(() => {
    if (!firestore || !firebaseUser) return null;
    return query(
      collection(firestore, 'users', firebaseUser.uid, 'securityScanResults'),
      orderBy('scanTimestamp', 'desc'),
      limit(50)
    );
  }, [firestore, firebaseUser]);

  const { data: alerts, isLoading: isAlertsLoading } = useCollection(recentAlertsQuery);
  const isLoading = isUserLoading || isAlertsLoading;

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  /* ─── Derive everything from real scan history (no mock data) ──── */
  const allAlerts: any[] = alerts || [];

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const todaysAlerts = allAlerts.filter((a) => {
    const d = new Date(a.scanTimestamp);
    return !isNaN(d.getTime()) && d >= startOfToday;
  });
  const scansToday = todaysAlerts.length;

  const LEVEL_RANK: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  const worstLevel = todaysAlerts.reduce((worst: string, a: any) => {
    return (LEVEL_RANK[a.alertLevel] || 0) > (LEVEL_RANK[worst] || 0) ? a.alertLevel : worst;
  }, 'low');
  const LEVEL_TO_SOC: Record<string, SocLevel> = { low: 'secure', medium: 'elevated', high: 'high', critical: 'critical' };
  const currentThreatLevel: SocLevel = LEVEL_TO_SOC[worstLevel] || 'secure';

  const levelCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  todaysAlerts.forEach((a: any) => {
    if (a.alertLevel in levelCounts) (levelCounts as any)[a.alertLevel]++;
  });

  const lastSevereAlert = allAlerts.find((a: any) => a.alertLevel === 'critical' || a.alertLevel === 'high');
  let streakDays = 0;
  if (lastSevereAlert) {
    streakDays = Math.max(0, Math.floor((now.getTime() - new Date(lastSevereAlert.scanTimestamp).getTime()) / 86400000));
  } else if (allAlerts.length > 0) {
    const oldest = allAlerts[allAlerts.length - 1];
    streakDays = Math.max(0, Math.floor((now.getTime() - new Date(oldest.scanTimestamp).getTime()) / 86400000));
  }

  const lastScanAt = allAlerts.length > 0 ? new Date(allAlerts[0].scanTimestamp) : null;

  const moduleCounts: Record<string, number> = { link: 0, lure: 0, video: 0, email: 0, sms: 0, deepfake: 0 };
  allAlerts.forEach((a: any) => { if (a.moduleType in moduleCounts) moduleCounts[a.moduleType]++; });
  const totalModuleScans = allAlerts.length;

  const dayBuckets = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(startOfToday);
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  const velocity = dayBuckets.map((d) => {
    const next = new Date(d);
    next.setDate(d.getDate() + 1);
    return allAlerts.filter((a: any) => {
      const ts = new Date(a.scanTimestamp);
      return ts >= d && ts < next;
    }).length;
  });
  const maxVelocity = Math.max(1, ...velocity);

  const recentThreatAlerts = allAlerts.filter((a: any) => a.alertLevel === 'critical' || a.alertLevel === 'high').slice(0, 5);

  let postureScore = 100;
  allAlerts.slice(0, 30).forEach((a: any) => {
    if (a.alertLevel === 'critical') postureScore -= 15;
    else if (a.alertLevel === 'high') postureScore -= 8;
    else if (a.alertLevel === 'medium') postureScore -= 3;
  });
  postureScore = Math.max(0, Math.min(100, postureScore));
  const modulesUsed = MODULE_META.filter((m) => moduleCounts[m.key] > 0).length;
  const scanCoveragePct = Math.round((modulesUsed / MODULE_META.length) * 100);
  const postureLabel = postureScore >= 90 ? 'Excellent' : postureScore >= 70 ? 'Good' : postureScore >= 50 ? 'Fair' : 'Needs Attention';

  const sentryActive = authUser.sentryMode === 'full';

  /* ─── Computed stats for sub-components ──────────────────────── */
  const arcStats = {
    dailyCleaned: todaysAlerts.filter((a: any) => a.alertLevel !== 'low').length,
    events: scansToday,
    critical: levelCounts.critical,
    toneMatches: todaysAlerts.filter((a: any) => a.moduleType === 'email').length,
  };

  /* ─── Full Sentry Dashboard ──────────────────────────────────── */
  const FullSentryDashboard = () => (
    <>
      <style>{SOC_STYLES}</style>
      <ThreatLevelMeter level={currentThreatLevel} streak={streakDays} counts={levelCounts} />
      <BackgroundSentryBar
        active={sentryActive}
        scansToday={scansToday}
        lastScanAt={lastScanAt}
        smsNote={t('dashboard_sentry_sms_note')}
      />
      <ArcGaugeCards stats={arcStats} />
      <RadarCard scansToday={scansToday} lastScanAt={lastScanAt} />
      <div className="text-[9px] font-bold text-primary tracking-[2px] uppercase my-3.5 mb-2">◈ Monitoring</div>
      <MonitoringRow total={scansToday} escalated={levelCounts.high} blocked={levelCounts.critical} />
      <ActiveAlertsAndVelocity
        activeCount={levelCounts.critical + levelCounts.high}
        totalToday={scansToday}
        velocity={velocity}
        maxVelocity={maxVelocity}
        dayBuckets={dayBuckets}
      />
      <OperationalPie counts={moduleCounts} total={totalModuleScans} />
      <SecurityPostureScore
        score={postureScore}
        label={postureLabel}
        sentryActive={sentryActive}
        scanCoveragePct={scanCoveragePct}
        streakDays={streakDays}
      />
      <div className="text-[9px] font-bold text-primary tracking-[2px] uppercase my-3.5 mb-2">◈ Recent Perimeter Alerts</div>
      <PerimeterAlerts alerts={recentThreatAlerts} />
      <div className="mt-2.5">
        <ManualScanCenter result={manualScanResult} setResult={setManualScanResult} />
      </div>
    </>
  );

  const LimitedModeDashboard = () => (
    <>
      <Card className="border-destructive/20 bg-destructive/5">
        <CardHeader className="flex-row items-center gap-4">
          <AlertTriangle className="size-8 text-destructive" />
          <div>
            <CardTitle className="text-destructive font-headline">{t('dashboard_limited_mode_card_title')}</CardTitle>
            <CardDescription className="text-destructive/80">{t('dashboard_limited_mode_card_desc')}</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <Button asChild variant="destructive" className="w-full md:w-auto">
            <Link href="/dashboard/disclosure">{t('dashboard_limited_mode_card_button')}</Link>
          </Button>
        </CardContent>
      </Card>
      <ManualScanCenter result={manualScanResult} setResult={setManualScanResult} />
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-headline text-3xl md:text-4xl">{t('dashboard_welcome')}</h1>
        <p className="text-muted-foreground">
          {authUser.sentryMode === 'full' ? t('dashboard_subheader_full') : t('dashboard_subheader_limited')}
        </p>
      </div>
      {authUser.sentryMode === 'full' ? <FullSentryDashboard /> : <LimitedModeDashboard />}
    </div>
  );
}
