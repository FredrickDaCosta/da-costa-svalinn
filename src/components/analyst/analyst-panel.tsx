'use client';
/**
 * Cybersecurity Analyst Panel
 *
 * Central dashboard for the Autonomous Cybersecurity Analyst.
 * Shows active incidents, correlated alerts, IOC feed,
 * triage results, and forensic reports.
 */

import { useEffect, useState, useCallback } from 'react';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore } from '@/firebase';
import { useMemoFirebase } from '@/firebase';
import {
  AlertTriangle, Shield, Eye, Clock, FileText,
  Loader2, RefreshCw, Globe, Link2, Mail, Phone,
  Video, Mic, MessageSquare,
} from 'lucide-react';

// ─── Types (mirrors src/lib/analyst/types.ts) ────────────────────

type ThreatLevel = 'low' | 'medium' | 'high' | 'critical';
type ModuleType = 'link' | 'lure' | 'email' | 'sms' | 'video' | 'deepfake';
type IOCType = 'url' | 'domain' | 'ip' | 'email_address' | 'phone_number' | 'file_hash' | 'sender_id';

interface IOC {
  type: IOCType;
  value: string;
  confidence: number;
  source: ModuleType;
  firstSeen: string;
}

interface ModuleAlert {
  id: string;
  moduleType: ModuleType;
  riskScore: number;
  threatDetected: boolean;
  alertLevel: ThreatLevel;
  summary: string;
  iocs: IOC[];
  scanTimestamp: string;
  isFalsePositive?: boolean;
}

interface Incident {
  id: string;
  title: string;
  description: string;
  threatLevel: ThreatLevel;
  riskScore: number;
  status: string;
  alerts: ModuleAlert[];
  modules: ModuleType[];
  iocs: IOC[];
  forensicReport?: {
    summary: string;
    technicalDetails: string;
    recommendedActions: string[];
    confidenceScore: number;
  };
  timeline?: { timestamp: string; description: string; module?: ModuleType }[];
  createdAt: string;
}

// ─── Constants ───────────────────────────────────────────────────

const LEVEL_COLORS: Record<ThreatLevel, string> = {
  critical: '#e24b4a',
  high: '#f0b429',
  medium: '#00e5c8',
  low: '#818cf8',
};

const MODULE_ICONS: Record<ModuleType, React.ReactNode> = {
  link: <Link2 className="size-4" />,
  lure: <AlertTriangle className="size-4" />,
  email: <Mail className="size-4" />,
  sms: <MessageSquare className="size-4" />,
  video: <Video className="size-4" />,
  deepfake: <Mic className="size-4" />,
};

const MODULE_LABELS: Record<ModuleType, string> = {
  link: 'Link Scrutinizer',
  lure: 'Lure Detector',
  email: 'Email Analyzer',
  sms: 'SMS Shield',
  video: 'Video Auditor',
  deepfake: 'Deepfake Audio',
};

const IOC_ICONS: Record<IOCType, React.ReactNode> = {
  url: <Link2 className="size-3" />,
  domain: <Globe className="size-3" />,
  ip: <Globe className="size-3" />,
  email_address: <Mail className="size-3" />,
  phone_number: <Phone className="size-3" />,
  file_hash: <FileText className="size-3" />,
  sender_id: <MessageSquare className="size-3" />,
};

// ─── Component ───────────────────────────────────────────────────

export function AnalystPanel() {
  const { user } = useAuth();
  const firestore = useFirestore();

  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [alerts, setAlerts] = useState<ModuleAlert[]>([]);
  const [loading, setLoading] = useState(true);

  // Real-time listener for incidents
  const incidentsQuery = useMemoFirebase(
    () => user ? query(
      collection(firestore, 'users', user.uid, 'analystIncidents'),
      orderBy('createdAt', 'desc'),
      limit(50),
    ) : null,
    [user?.uid],
  );

  const alertsQuery = useMemoFirebase(
    () => user ? query(
      collection(firestore, 'users', user.uid, 'analystAlerts'),
      orderBy('scanTimestamp', 'desc'),
      limit(100),
    ) : null,
    [user?.uid],
  );

  useEffect(() => {
    if (!incidentsQuery) return;
    const unsub = onSnapshot(incidentsQuery, (snap) => {
      setIncidents(snap.docs.map(d => ({ id: d.id, ...d.data() } as Incident)));
      setLoading(false);
    }, () => setLoading(false));
    return () => unsub();
  }, [incidentsQuery]);

  useEffect(() => {
    if (!alertsQuery) return;
    const unsub = onSnapshot(alertsQuery, (snap) => {
      setAlerts(snap.docs.map(d => ({ id: d.id, ...d.data() } as ModuleAlert)));
    });
    return () => unsub();
  }, [alertsQuery]);

  // ─── Stats ───────────────────────────────────────────────────
  const stats = {
    totalIncidents: incidents.length,
    critical: incidents.filter(i => i.threatLevel === 'critical').length,
    high: incidents.filter(i => i.threatLevel === 'high').length,
    medium: incidents.filter(i => i.threatLevel === 'medium').length,
    low: incidents.filter(i => i.threatLevel === 'low').length,
    totalAlerts: alerts.length,
    threatsBlocked: alerts.filter(a => a.threatDetected && !a.isFalsePositive).length,
    falsePositives: alerts.filter(a => a.isFalsePositive).length,
    topModules: Object.entries(
      alerts.reduce((acc, a) => { acc[a.moduleType] = (acc[a.moduleType] || 0) + 1; return acc; }, {} as Record<string, number>)
    ).sort(([, a], [, b]) => b - a).slice(0, 5),
    allIocs: alerts.flatMap(a => a.iocs || []),
  };

  // ─── Loading ─────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-full items-center justify-center gap-3">
        <Loader2 className="animate-spin text-primary size-6" />
        <span className="text-muted-foreground">Initializing Cybersecurity Analyst...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ─── Header ────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl md:text-4xl flex items-center gap-3">
            <Shield className="text-primary size-8" />
            Cybersecurity Analyst
          </h1>
          <p className="text-muted-foreground mt-1">
            Autonomous AI agent — detects, verifies, correlates, explains, and acts
          </p>
        </div>
      </div>

      {/* ─── Stats Row ─────────────────────────────────────── */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="size-4 text-muted-foreground" />
              Active Incidents
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalIncidents}</div>
            <p className="text-xs text-muted-foreground mt-1">
              <span className="text-red-500">{stats.critical} critical</span> · {stats.high} high
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Eye className="size-4 text-muted-foreground" />
              Total Alerts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.totalAlerts}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {stats.threatsBlocked} threats · {stats.falsePositives} false positives
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Threats Blocked</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-500">{stats.threatsBlocked}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">IOCs Extracted</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.allIocs.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">False Positive Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {stats.totalAlerts > 0 ? Math.round((stats.falsePositives / stats.totalAlerts) * 100) : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Main Content ──────────────────────────────────── */}
      <Tabs defaultValue="incidents">
        <TabsList>
          <TabsTrigger value="incidents">Incidents ({stats.totalIncidents})</TabsTrigger>
          <TabsTrigger value="alerts">Alert Feed ({stats.totalAlerts})</TabsTrigger>
          <TabsTrigger value="iocs">IOC Feed ({stats.allIocs.length})</TabsTrigger>
          <TabsTrigger value="modules">Module Breakdown</TabsTrigger>
        </TabsList>

        {/* ─── Incidents Tab ────────────────────────────────── */}
        <TabsContent value="incidents" className="space-y-4">
          {incidents.length === 0 ? (
            <Card>
              <CardContent className="pt-6 text-center text-muted-foreground">
                <Shield className="size-12 mx-auto mb-3 opacity-30" />
                <p>No incidents detected yet. The analyst will automatically create incidents when cross-module threats are correlated.</p>
              </CardContent>
            </Card>
          ) : (
            incidents.map(incident => (
              <IncidentCard key={incident.id} incident={incident} />
            ))
          )}
        </TabsContent>

        {/* ─── Alerts Tab ───────────────────────────────────── */}
        <TabsContent value="alerts">
          <Card>
            <CardContent className="p-0">
              {alerts.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No alerts yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Time</TableHead>
                      <TableHead>Module</TableHead>
                      <TableHead>Level</TableHead>
                      <TableHead>Risk</TableHead>
                      <TableHead>Summary</TableHead>
                      <TableHead>Triaged</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alerts.map(alert => (
                      <TableRow key={alert.id}>
                        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                          {formatTime(alert.scanTimestamp)}
                        </TableCell>
                        <TableCell>
                          <span className="flex items-center gap-1.5">
                            {MODULE_ICONS[alert.moduleType]}
                            <span className="text-sm">{MODULE_LABELS[alert.moduleType]}</span>
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge style={{ background: LEVEL_COLORS[alert.alertLevel] + '22', color: LEVEL_COLORS[alert.alertLevel], border: `1px solid ${LEVEL_COLORS[alert.alertLevel]}44` }}>
                            {alert.alertLevel}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{alert.riskScore}/10</TableCell>
                        <TableCell className="max-w-xs truncate text-sm">{alert.summary}</TableCell>
                        <TableCell>
                          {alert.isFalsePositive ? (
                            <Badge variant="secondary" className="text-xs">False Positive</Badge>
                          ) : alert.threatDetected ? (
                            <Badge variant="destructive" className="text-xs">Threat</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs">Clean</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── IOC Feed Tab ─────────────────────────────────── */}
        <TabsContent value="iocs">
          <Card>
            <CardHeader>
              <CardTitle>Indicators of Compromise</CardTitle>
              <CardDescription>Extracted IOCs across all scans — shareable with threat intel feeds</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {stats.allIocs.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No IOCs extracted yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Value</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>First Seen</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.allIocs.slice(0, 50).map((ioc, idx) => (
                      <TableRow key={`${ioc.type}-${ioc.value}-${idx}`}>
                        <TableCell>
                          <span className="flex items-center gap-1.5">
                            {IOC_ICONS[ioc.type]}
                            <span className="text-xs font-mono uppercase">{ioc.type}</span>
                          </span>
                        </TableCell>
                        <TableCell className="font-mono text-sm max-w-xs truncate">{ioc.value}</TableCell>
                        <TableCell>
                          <span className={`text-sm font-medium ${ioc.confidence > 0.8 ? 'text-green-500' : ioc.confidence > 0.5 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                            {Math.round(ioc.confidence * 100)}%
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">{MODULE_LABELS[ioc.source]}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{formatTime(ioc.firstSeen)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── Module Breakdown Tab ─────────────────────────── */}
        <TabsContent value="modules">
          <Card>
            <CardHeader>
              <CardTitle>Module Activity</CardTitle>
              <CardDescription>Alert distribution by scan module</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {stats.topModules.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No module activity yet.</p>
              ) : (
                stats.topModules.map(([mod, count]) => {
                  const pct = stats.totalAlerts > 0 ? Math.round((count / stats.totalAlerts) * 100) : 0;
                  return (
                    <div key={mod}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="flex items-center gap-2">
                          {MODULE_ICONS[mod as ModuleType]}
                          {MODULE_LABELS[mod as ModuleType] || mod}
                        </span>
                        <span className="text-muted-foreground">{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Sub-components ──────────────────────────────────────────────

function IncidentCard({ incident }: { incident: Incident }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Card className={incident.threatLevel === 'critical' ? 'border-red-500/50' : ''}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Badge style={{ background: LEVEL_COLORS[incident.threatLevel] + '22', color: LEVEL_COLORS[incident.threatLevel], border: `1px solid ${LEVEL_COLORS[incident.threatLevel]}44` }}>
                {incident.threatLevel.toUpperCase()}
              </Badge>
              {incident.title}
            </CardTitle>
            <CardDescription className="mt-1">{incident.description}</CardDescription>
          </div>
          <div className="text-right">
            <div className="font-mono text-lg font-bold">{incident.riskScore}/10</div>
            <div className="text-xs text-muted-foreground">{formatTime(incident.createdAt)}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2 mb-3">
          {incident.modules.map(m => (
            <Badge key={m} variant="outline" className="text-xs">
              {MODULE_ICONS[m]} {MODULE_LABELS[m]}
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? 'Hide Details' : 'View Details'}
          </Button>
        </div>
        {expanded && (
          <div className="mt-4 space-y-4 border-t pt-4">
            {/* Timeline */}
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-1"><Clock className="size-3" /> Timeline</h4>
              <div className="space-y-1">
                {incident.timeline?.map((t, i) => (
                  <div key={i} className="text-xs text-muted-foreground flex gap-2">
                    <span className="font-mono whitespace-nowrap">{formatTime(t.timestamp)}</span>
                    <span>{t.description}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* IOCs */}
            {incident.iocs?.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">IOCs</h4>
                <div className="space-y-1">
                  {incident.iocs.slice(0, 10).map((ioc, i) => (
                    <div key={i} className="text-xs flex items-center gap-2">
                      {IOC_ICONS[ioc.type]}
                      <span className="font-mono">{ioc.value}</span>
                      <Badge variant="outline" className="text-[10px]">{Math.round(ioc.confidence * 100)}%</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Forensic Report */}
            {incident.forensicReport && (
              <div>
                <h4 className="text-sm font-medium mb-2 flex items-center gap-1"><FileText className="size-3" /> Forensic Report</h4>
                <div className="bg-muted/30 rounded-lg p-3 text-xs space-y-2">
                  <p>{incident.forensicReport.summary}</p>
                  {incident.forensicReport.recommendedActions?.length > 0 && (
                    <div>
                      <p className="font-medium text-sm">Recommended Actions:</p>
                      <ul className="list-disc list-inside space-y-0.5">
                        {incident.forensicReport.recommendedActions.map((a, i) => (
                          <li key={i}>{a}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return iso;
  }
}
