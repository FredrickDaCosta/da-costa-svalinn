'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import type { ChartConfig } from '@/components/ui/chart';
import { ChartContainer, ChartTooltipContent } from '@/components/ui/chart';
import { useAuth } from '@/hooks/use-auth';
import {
  ArrowUp,
  DollarSign,
  Download,
  Users,
  AlertCircle,
  MoreHorizontal,
  ShieldBan,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useLocalization } from '@/hooks/use-localization';
import { supportedLanguages } from '@/context/language-provider';

const dailyRevenueData = [
  { date: 'Mon', revenue: 2300 },
  { date: 'Tue', revenue: 2900 },
  { date: 'Wed', revenue: 2500 },
  { date: 'Thu', revenue: 3500 },
  { date: 'Fri', revenue: 4100 },
  { date: 'Sat', revenue: 5200 },
  { date: 'Sun', revenue: 4800 },
];

type FraudulentUser = {
  id: string;
  email: string;
  deviceId: string;
  ipHash: string;
  violations: string[];
  risk: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Active' | 'Warned' | 'Restricted' | 'Banned';
};

const ADMIN_EMAILS = [
  'fredrick.a.dacosta@gmail.com',
  'fad@da-costa.online',
];

const initialFraudulentUsers: FraudulentUser[] = [
  { id: 'usr_1', email: 'user_abc@example.com', deviceId: 'd_fingerprint_123', ipHash: 'ip_hash_abc', violations: ['Rewarded ad farming', 'Unusual credit accumulation'], risk: 'High', status: 'Active' },
  { id: 'usr_2', email: 'user_xyz@example.com', deviceId: 'd_fingerprint_456', ipHash: 'ip_hash_def', violations: ['Multiple accounts per device'], risk: 'Medium', status: 'Warned' },
  { id: 'usr_3', email: 'user_123@example.com', deviceId: 'd_fingerprint_789', ipHash: 'ip_hash_ghi', violations: ['VPN/Proxy usage'], risk: 'Low', status: 'Active' },
  { id: 'usr_4', email: 'banned_user@example.com', deviceId: 'd_fingerprint_000', ipHash: 'ip_hash_jkl', violations: ['Mass registration', 'Rewarded ad farming'], risk: 'Critical', status: 'Banned' },
];


export default function AdminDashboardPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [fraudulentUsers, setFraudulentUsers] = useState(initialFraudulentUsers);
  const { t } = useLocalization();

  const userSegmentsData = [
    { name: t('admin_chart_segment_free'), value: 400, fill: 'var(--color-free)' },
    { name: t('admin_chart_segment_premium'), value: 150, fill: 'var(--color-premium)' },
    { name: t('admin_chart_segment_hybrid'), value: 50, fill: 'var(--color-hybrid)' },
  ];
  
  const chartConfig: ChartConfig = {
    revenue: { label: 'Revenue (₦)', color: 'hsl(var(--primary))' },
    free: { label: t('admin_chart_segment_free'), color: 'hsl(var(--chart-2))' },
    premium: { label: t('admin_chart_segment_premium'), color: 'hsl(var(--chart-1))' },
    hybrid: { label: t('admin_chart_segment_hybrid'), color: 'hsl(var(--chart-3))' },
  };

  const isAdmin = !!user?.email && ADMIN_EMAILS.includes(user.email);

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/dashboard');
    }
  }, [isAdmin, router]);

  const handleUserAction = (userId: string, action: FraudulentUser['status']) => {
    setFraudulentUsers(users =>
      users.map(u => (u.id === userId ? { ...u, status: action } : u))
    );
    toast({
      title: t('admin_toast_action_success', { action: action }),
      description: t('admin_toast_action_desc', { 
        email: fraudulentUsers.find(u => u.id === userId)?.email || '', 
        action_past_tense: action.toLowerCase() 
      }),
    });
  };

  const handleExportReport = () => {
    const reportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalRevenue: "₦1,250,345",
        subscriptions: "+150",
        creditSales: "₦120,500",
        churnRate: "4.1%",
      },
      dailyRevenue: dailyRevenueData,
      userSegments: userSegmentsData,
      securityViolations: fraudulentUsers,
    };

    const jsonString = JSON.stringify(reportData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `da-costa-admin-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);

    toast({
      title: t('admin_export_toast_title'),
      description: t('admin_export_toast_desc'),
    });
  };

  if (!isAdmin) {
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

  const getRiskKey = (risk: string) => {
    return `admin_risk_${risk.toLowerCase()}` as any;
  }
  const getStatusKey = (status: string) => {
    return `admin_status_${status.toLowerCase()}` as any;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl md:text-4xl">{t('admin_page_title')}</h1>
          <p className="text-muted-foreground">
            {t('admin_page_desc')}
          </p>
        </div>
        <Button onClick={handleExportReport}>
          <Download className="mr-2" />
          {t('admin_export_button')}
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admin_stat_total_revenue')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦1,250,345</div>
            <p className="text-xs text-muted-foreground">+15.2% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admin_stat_subscriptions')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">+150</div>
            <p className="text-xs text-muted-foreground">+8.1% from last month</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admin_stat_credit_sales')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₦120,500</div>
            <p className="text-xs text-muted-foreground">+5% from last week</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('admin_stat_churn_rate')}</CardTitle>
            <ArrowUp className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">4.1%</div>
            <p className="text-xs text-muted-foreground">Up 0.5% from last month</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>{t('admin_chart_daily_revenue_title')}</CardTitle>
            <CardDescription>{t('admin_chart_daily_revenue_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[250px] w-full">
              <LineChart data={dailyRevenueData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={(value) => `₦${Number(value) / 1000}k`} />
                <Tooltip cursor={false} content={<ChartTooltipContent indicator="line" />} />
                <Line dataKey="revenue" type="monotone" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
              </LineChart>
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><AlertCircle className="text-destructive"/> {t('admin_fraud_console_title')}</CardTitle>
          <CardDescription>{t('admin_fraud_console_desc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('admin_table_header_user')}</TableHead>
                <TableHead>{t('admin_table_header_violations')}</TableHead>
                <TableHead>{t('admin_table_header_risk')}</TableHead>
                <TableHead>{t('admin_table_header_status')}</TableHead>
                <TableHead className="text-right">{t('admin_table_header_actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {fraudulentUsers.map((u) => (
                <TableRow key={u.id}>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                        <span>{u.email}</span>
                        <span className="text-xs text-muted-foreground">Device: {u.deviceId}</span>
                        <span className="text-xs text-muted-foreground">IP Hash: {u.ipHash}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                        {u.violations.map(v => <Badge key={v} variant="secondary" className="whitespace-nowrap">{v}</Badge>)}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={u.risk === 'Critical' || u.risk === 'High' ? 'destructive' : u.risk === 'Medium' ? 'secondary' : 'outline'}>
                        {t(getRiskKey(u.risk))}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        u.status === 'Banned' ? 'destructive' : u.status === 'Active' ? 'default' : 'secondary'
                      }
                      className="flex w-fit items-center gap-1"
                    >
                      {u.status === 'Active' && <ShieldCheck className="size-3" />}
                      {(u.status === 'Warned' || u.status === 'Restricted') && <ShieldAlert className="size-3" />}
                      {u.status === 'Banned' && <ShieldBan className="size-3" />}
                      <span>{t(getStatusKey(u.status))}</span>
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" disabled={u.status === 'Banned'}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleUserAction(u.id, 'Active')}>
                          <ShieldCheck className="mr-2" /> {t('admin_action_clear')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUserAction(u.id, 'Warned')}>
                           <ShieldAlert className="mr-2" /> {t('admin_action_warn')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleUserAction(u.id, 'Restricted')}>
                           <ShieldAlert className="mr-2" /> {t('admin_action_restrict')}
                        </DropdownMenuItem>
                         <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive" onClick={() => handleUserAction(u.id, 'Banned')}>
                           <ShieldBan className="mr-2" /> {t('admin_action_ban')}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>AI, translation and threat-intel stack</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: 'Scan Engine', detail: 'Nvidia Nemotron 3 Ultra (nvidia/nemotron-3-ultra-550b-a55b:free)' },
              { label: 'Assistant', detail: 'Nvidia Nemotron 3 Ultra — single-model stack (chat and scans share the same engine)' },
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
            <CardTitle>Locale Sync Status</CardTitle>
            <CardDescription>34 languages supported. Run locale sync script to update missing translations.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {supportedLanguages.map((l) => (
                <Badge key={l.code} variant="secondary" className="text-xs font-normal">
                  {l.icon} {l.name}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-3">Sync script: scripts/sync-locales.py</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button variant="outline" onClick={() => console.log('FCM alert triggered')}>
            📢 Send Daily Threat Alert
          </Button>
          <Button variant="outline" onClick={() => console.log('Export triggered')}>
            📊 Export Scan Data (CSV)
          </Button>
          <Button variant="outline" onClick={() => window.open('/monetization-policy', '_blank')}>
            📋 Monetization Policy
          </Button>
        </CardContent>
      </Card>

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
