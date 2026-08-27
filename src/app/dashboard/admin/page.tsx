'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore } from '@/firebase';
import {
  DollarSign, Download, Users, AlertCircle, Activity,
  Globe, TrendingUp, ShieldCheck, Loader2, RefreshCw,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useLocalization } from '@/hooks/use-localization';

// ─── Types ──────────────────────────────────────────────────────
type AdminStats = {
  users: {
    total: number;
    free: number;
    premium: number;
    newToday: number;
    newThisWeek: number;
    newThisMonth: number;
  };
  scans: {
    total: number;
    today: number;
    threatsDetected: number;
    threatsToday: number;
    moduleCounts: Record<string, number>;
    alertLevelCounts: Record<string, number>;
    dailyScans: { date: string; count: number }[];
  };
  revenue: {
    adImpressions: number;
    rewardedAds: number;
    scanEvents: number;
  };
  enterprise: {
    geographicDistribution: Record<string, number>;
    topThreats: { module: string; count: number; level: string }[];
    churnRate: number;
    activeUsers30d: number;
  };
};

const MODULE_COLORS: Record<string, string> = {
  link: '#00e5c8', lure: '#f0b429', email: '#818cf8',
  video: '#a855f7', sms: '#00b4d8', deepfake: '#e879f9',
};

const MODULE_LABELS: Record<string, string> = {
  link: 'Link Scrutinizer', lure: 'Lure Detector', email: 'Email Analyzer',
  video: 'Video Auditor', sms: 'SMS & Call Shield', deepfake: 'Deepfake Audio',
};

// ─── Admin Guard ────────────────────────────────────────────────
const ADMIN_UID = process.env.NEXT_PUBLIC_ADMIN_UID;

// ─── Page ───────────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLocalization();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isAdmin = !!ADMIN_UID && user?.uid === ADMIN_UID;

  useEffect(() => {
    if (!isAdmin && !isAuthLoading) {
      router.replace('/dashboard');
    }
  }, [isAdmin, isAuthLoading, router]);

  const fetchStats = useCallback(async () => {
    if (!firestore || !user?.uid) return;
    setLoading(true);
    setError(null);

    try {
      const now = new Date();
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86_400_000);

      // ─── Query allScans (root collection, readable by any auth user) ───
      const scansSnap = await getDocs(collection(firestore, 'allScans'));

      let totalScans = 0;
      let scansToday = 0;
      let threatsDetected = 0;
      let threatsToday = 0;
      const moduleCounts: Record<string, number> = {};
      const alertLevelCounts: Record<string, number> = { low: 0, medium: 0, high: 0, critical: 0 };
      const dayBuckets: Record<string, number> = {};
      const activeUserIds = new Set<string>();
      const allUserIds = new Set<string>();
      const countryCounts: Record<string, number> = {};
      const threatModules: Record<string, { count: number; level: string }> = {};

      for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        dayBuckets[d.toISOString().split('T')[0]] = 0;
      }

      scansSnap.forEach((doc) => {
        const d = doc.data();
        totalScans++;

        if (d.userId) allUserIds.add(d.userId);

        const scanDate = d.scanTimestamp?.toDate?.() ?? (d.scanTimestamp ? new Date(d.scanTimestamp) : null);
        if (scanDate && !isNaN(scanDate.getTime())) {
          if (scanDate >= startOfToday) {
            scansToday++;
            if (d.threatDetected) threatsToday++;
          }
          if (scanDate >= thirtyDaysAgo && d.userId) {
            activeUserIds.add(d.userId);
          }
          const dayKey = scanDate.toISOString().split('T')[0];
          if (dayKey in dayBuckets) dayBuckets[dayKey]++;
        }

        if (d.threatDetected) threatsDetected++;
        if (d.moduleType) moduleCounts[d.moduleType] = (moduleCounts[d.moduleType] || 0) + 1;
        if (d.alertLevel && alertLevelCounts[d.alertLevel] !== undefined) alertLevelCounts[d.alertLevel]++;
        if (d.country) countryCounts[d.country] = (countryCounts[d.country] || 0) + 1;

        if (d.threatDetected && d.moduleType) {
          if (!threatModules[d.moduleType]) threatModules[d.moduleType] = { count: 0, level: d.alertLevel || 'low' };
          threatModules[d.moduleType].count++;
          const levels = ['low', 'medium', 'high', 'critical'];
          if (levels.indexOf(d.alertLevel) > levels.indexOf(threatModules[d.moduleType].level)) {
            threatModules[d.moduleType].level = d.alertLevel;
          }
        }
      });

      const dailyScans = Object.entries(dayBuckets).map(([date, count]) => ({ date, count }));
      const topThreats = Object.entries(threatModules)
        .map(([module, data]) => ({ module, ...data }))
        .sort((a, b) => b.count - a.count);

      // ─── Query adminEvents ───────────────────────────────────
      const eventsSnap = await getDocs(collection(firestore, 'adminEvents'));
      let totalAdImpressions = 0;
      let totalRewardedAds = 0;
      let totalScanEvents = 0;

      eventsSnap.forEach((doc) => {
        const d = doc.data();
        if (d.type === 'ad_impression') totalAdImpressions++;
        if (d.type === 'rewarded_ad_completed') totalRewardedAds++;
        if (d.type === 'scan_completed') totalScanEvents++;
      });

      // ─── Derive user metrics (approximation from allScans) ──
      const totalUsers = allUserIds.size;
      const churnRate = totalUsers > 0
        ? Math.round(((totalUsers - activeUserIds.size) / totalUsers) * 100 * 10) / 10
        : 0;

      setStats({
        users: {
          total: totalUsers,
          free: totalUsers, // All users are free tier (no payment model)
          premium: 0,
          newToday: 0, // Would need globalStats doc for precise counts
          newThisWeek: 0,
          newThisMonth: 0,
        },
        scans: {
          total: totalScans,
          today: scansToday,
          threatsDetected,
          threatsToday,
          moduleCounts,
          alertLevelCounts,
          dailyScans,
        },
        revenue: {
          adImpressions: totalAdImpressions,
          rewardedAds: totalRewardedAds,
          scanEvents: totalScanEvents,
        },
        enterprise: {
          geographicDistribution: countryCounts,
          topThreats,
          churnRate,
          activeUsers30d: activeUserIds.size,
        },
      });
    } catch (e: any) {
      console.error('[admin/stats] Error:', e);
      setError(e.message || 'Failed to fetch stats');
    } finally {
      setLoading(false);
    }
  }, [firestore, user?.uid]);

  useEffect(() => {
    if (isAdmin && user?.uid && firestore) fetchStats();
  }, [isAdmin, user?.uid, firestore, fetchStats]);

  const handleExportReport = () => {
    if (!stats) return;
    const blob = new Blob([JSON.stringify(stats, null, 2)], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `da-costa-admin-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
    toast({ title: 'Report Exported', description: 'Admin report downloaded.' });
  };

  if (!isAdmin || isAuthLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t('admin_access_denied_title')}</CardTitle>
            <CardDescription>{t('admin_access_denied_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => router.push('/dashboard')} className="w-full">
              {t('admin_return_to_dashboard_button')}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-3">
        <Loader2 className="animate-spin text-primary size-6" />
        <span className="text-muted-foreground">Loading admin metrics...</span>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error Loading Stats</CardTitle>
            <CardDescription>{error || 'Unknown error'}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={fetchStats} className="w-full">
              <RefreshCw className="mr-2 size-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Derived data ─────────────────────────────────────────────
  const userSegmentsData = [
    { name: t('admin_chart_segment_free'), value: stats.users.free, fill: 'var(--color-free)' },
    { name: t('admin_chart_segment_premium'), value: stats.users.premium, fill: 'var(--color-premium)' },
  ];

  const moduleBreakdownData = Object.entries(stats.scans.moduleCounts).map(([key, count]) => ({
    name: MODULE_LABELS[key] || key,
    value: count,
    fill: MODULE_COLORS[key] || '#888',
  }));

  const chartConfig: ChartConfig = {
    scans: { label: 'Scans', color: 'hsl(var(--primary))' },
    free: { label: t('admin_chart_segment_free'), color: 'hsl(var(--chart-2))' },
    premium: { label: t('admin_chart_segment_premium'), color: 'hsl(var(--chart-1))' },
  };

  const threatRate = stats.scans.total > 0
    ? Math.round((stats.scans.threatsDetected / stats.scans.total) * 100 * 10) / 10
    : 0;

  return (
    <div className="space-y-8">
      {/* ─── Header ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl md:text-4xl">{t('admin_page_title')}</h1>
          <p className="text-muted-foreground">{t('admin_page_desc')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchStats}>
            <RefreshCw className="mr-2 size-4" /> Refresh
          </Button>
          <Button onClick={handleExportReport}>
            <Download className="mr-2 size-4" /> {t('admin_export_button')}
          </Button>
        </div>
      </div>

      {/* ─── KPI Cards ──────────────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.users.total}</div>
            <p className="text-xs text-muted-foreground">
              +{stats.users.newToday} today · +{stats.users.newThisWeek} this week
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Scans</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.scans.total}</div>
            <p className="text-xs text-muted-foreground">
              {stats.scans.today} today · {stats.scans.threatsToday} threats today
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Threats Detected</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.scans.threatsDetected}</div>
            <p className="text-xs text-muted-foreground">{threatRate}% threat rate</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ad Impressions</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.revenue.adImpressions}</div>
            <p className="text-xs text-muted-foreground">
              {stats.revenue.rewardedAds} rewarded ads · {stats.revenue.scanEvents} scan events
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Charts Row ─────────────────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Scan Velocity</CardTitle>
            <CardDescription>Scans per day, last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <BarChart data={stats.scans.dailyScans} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8}
                  tickFormatter={(v) => v.slice(5)} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} />
                <Tooltip cursor={false} content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('admin_chart_user_segments_title')}</CardTitle>
            <CardDescription>{t('admin_chart_user_segments_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <ChartContainer config={chartConfig} className="h-[220px] w-full">
              <PieChart>
                <Tooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
                <Pie data={userSegmentsData} dataKey="value" nameKey="name" innerRadius={60} strokeWidth={5} stroke="hsl(var(--card))">
                  {userSegmentsData.map((entry) => (
                    <Cell key={entry.name} fill={entry.fill} />
                  ))}
                </Pie>
                <Legend iconSize={10} />
              </PieChart>
            </ChartContainer>
          </CardContent>
        </Card>
      </div>

      {/* ─── Alert Level Distribution ────────────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Alert Level Distribution</CardTitle>
            <CardDescription>All-time alert levels across all scans</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: 'Critical', color: '#e24b4a', count: stats.scans.alertLevelCounts.critical || 0 },
                { label: 'High', color: '#f0b429', count: stats.scans.alertLevelCounts.high || 0 },
                { label: 'Medium', color: '#00e5c8', count: stats.scans.alertLevelCounts.medium || 0 },
                { label: 'Low', color: '#818cf8', count: stats.scans.alertLevelCounts.low || 0 },
              ].map(({ label, color, count }) => {
                const pct = stats.scans.total > 0 ? Math.round((count / stats.scans.total) * 100) : 0;
                return (
                  <div key={label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="flex items-center gap-2">
                        <span className="size-2 rounded-full" style={{ background: color }} />
                        {label}
                      </span>
                      <span className="text-muted-foreground">{count} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Module Usage</CardTitle>
            <CardDescription>Scan distribution by module</CardDescription>
          </CardHeader>
          <CardContent>
            {moduleBreakdownData.length > 0 ? (
              <div className="space-y-3">
                {moduleBreakdownData.map(({ name, value, fill }) => {
                  const pct = stats.scans.total > 0 ? Math.round((value / stats.scans.total) * 100) : 0;
                  return (
                    <div key={name}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="flex items-center gap-2">
                          <span className="size-2 rounded-full" style={{ background: fill }} />
                          {name}
                        </span>
                        <span className="text-muted-foreground">{value} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: fill }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No scans yet.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ─── Enterprise: Top Threats ─────────────────────────── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="text-destructive" /> Top Threats
          </CardTitle>
          <CardDescription>Most frequently detected threat modules</CardDescription>
        </CardHeader>
        <CardContent>
          {stats.enterprise.topThreats.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Module</TableHead>
                  <TableHead>Threat Count</TableHead>
                  <TableHead>Highest Level</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stats.enterprise.topThreats.map((t) => (
                  <TableRow key={t.module}>
                    <TableCell className="font-medium">{MODULE_LABELS[t.module] || t.module}</TableCell>
                    <TableCell>{t.count}</TableCell>
                    <TableCell>
                      <Badge variant={
                        t.level === 'critical' || t.level === 'high' ? 'destructive' : 'secondary'
                      }>
                        {t.level.toUpperCase()}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No threats detected yet.</p>
          )}
        </CardContent>
      </Card>

      {/* ─── Enterprise: Geographic + Conversion ─────────────── */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><Globe className="text-primary" /> Geographic Distribution</CardTitle>
            <CardDescription>Scan origin by country</CardDescription>
          </CardHeader>
          <CardContent>
            {Object.keys(stats.enterprise.geographicDistribution).length > 0 ? (
              <div className="space-y-2">
                {Object.entries(stats.enterprise.geographicDistribution)
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 10)
                  .map(([country, count]) => (
                    <div key={country} className="flex justify-between text-sm">
                      <span>{country}</span>
                      <span className="text-muted-foreground">{count} scans</span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No geo data available (scans need country field).</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TrendingUp className="text-primary" /> Conversion & Engagement</CardTitle>
            <CardDescription>User growth and retention</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold">{stats.users.newThisMonth}</div>
                <div className="text-xs text-muted-foreground">New Users (30d)</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold">{stats.enterprise.activeUsers30d}</div>
                <div className="text-xs text-muted-foreground">Active Users (30d)</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold text-destructive">{stats.enterprise.churnRate}%</div>
                <div className="text-xs text-muted-foreground">Churn Rate</div>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/30">
                <div className="text-2xl font-bold">{stats.users.premium}</div>
                <div className="text-xs text-muted-foreground">Premium Users</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── System Status ───────────────────────────────────── */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>AI, translation and threat-intel stack</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Scan Engine', detail: 'Nvidia Nemotron 3 Ultra (free tier)' },
              { label: 'Assistant', detail: 'Nvidia Nemotron 3 Ultra — single-model stack' },
              { label: 'Translation', detail: 'Azure Translator F0 (southafricanorth)' },
              { label: 'VirusTotal', detail: 'Active (500 scans/day)' },
              { label: 'DNS Check', detail: 'Active (Google DoH — no key required)' },
            ].map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <div className="font-medium">{row.label}</div>
                  <div className="text-xs text-muted-foreground">{row.detail}</div>
                </div>
                <Badge variant="outline" className="border-green-500/40 text-green-500 bg-green-500/10 shrink-0">
                  Active
                </Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Pipeline</CardTitle>
            <CardDescription>Firestore collections status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'allScans', count: stats.scans.total, detail: 'Root-level scan records' },
              { label: 'adminEvents', count: stats.revenue.adImpressions + stats.revenue.rewardedAds + stats.revenue.scanEvents, detail: 'Revenue & metrics events' },
            ].map((row) => (
              <div key={row.label} className="flex items-start justify-between gap-3 text-sm">
                <div>
                  <div className="font-mono font-medium">{row.label}</div>
                  <div className="text-xs text-muted-foreground">{row.detail}</div>
                </div>
                <Badge variant="outline">{row.count.toLocaleString()}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ─── Footer ──────────────────────────────────────────── */}
      <Card className="bg-primary/5 border-primary/20">
        <CardContent className="pt-6 text-sm text-muted-foreground">
          B2B and enterprise enquiries:{' '}
          <a href="mailto:fad@da-costa.online" className="text-primary font-medium hover:underline">
            fad@da-costa.online
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
