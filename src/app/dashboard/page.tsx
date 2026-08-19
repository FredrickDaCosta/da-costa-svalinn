
'use client';
// v1.2.0 — dashboard connected to live Firestore scan data

import { useAuth } from '@/hooks/use-auth';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useLocalization } from '@/hooks/use-localization';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ManualScanCenter, type ManualScanResult } from '@/components/dashboard/manual-scan-center';
import { useState } from 'react';

/* ─── SOC Dashboard Styles ─────────────────────────────────────── */
const SOC_STYLES = `
@keyframes sPulse{0%,100%{box-shadow:0 0 4px #00e5c8,0 0 10px #00e5c866}50%{box-shadow:0 0 10px #00e5c8,0 0 24px #00e5c8aa}}
@keyframes shine{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
@keyframes floatShield{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes streakGlow{0%,100%{box-shadow:0 0 6px #00e5c844}50%{box-shadow:0 0 16px #00e5c8aa}}
`;

const THREAT_LEVELS = {
  secure:   {pct:'8%',  bg:'linear-gradient(90deg,#00ff88,#00e5c8)', badge:'SECURE',   bc:'#00ff8822',btc:'#00ff88',bbd:'1px solid #00ff8844'},
  elevated: {pct:'38%', bg:'linear-gradient(90deg,#f0b429,#e09000)', badge:'ELEVATED', bc:'#f0b42922',btc:'#f0b429',bbd:'1px solid #f0b42944'},
  high:     {pct:'65%', bg:'linear-gradient(90deg,#e24b4a,#c02020)', badge:'HIGH',     bc:'#e24b4a22',btc:'#e24b4a',bbd:'1px solid #e24b4a44'},
  critical: {pct:'95%', bg:'linear-gradient(90deg,#e24b4a,#ff0000)', badge:'CRITICAL', bc:'#e24b4a33',btc:'#e24b4a',bbd:'1px solid #e24b4a88'},
};

type SocLevel = 'secure' | 'elevated' | 'high' | 'critical';

const MODULE_META: { key: string; label: string; color: string }[] = [
  { key: 'link', label: 'Link Scrutinizer', color: '#00e5c8' },
  { key: 'lure', label: 'Lure Detector', color: '#f0b429' },
  { key: 'email', label: 'Email Analyzer', color: '#818cf8' },
  { key: 'video', label: 'Video Auditor', color: '#a855f7' },
  { key: 'sms', label: 'SMS & Call Shield', color: '#00b4d8' },
  { key: 'deepfake', label: 'Deepfake Audio', color: '#e879f9' },
];

const PIE_CIRCUMFERENCE = 2 * Math.PI * 40;
const RING_CIRCUMFERENCE = 2 * Math.PI * 40;

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

  /* ─── SOC Dashboard components ─────────────────────────────── */

  const ThreatLevelMeter = ({ level, streak, counts }: { level: SocLevel; streak: number; counts: typeof levelCounts }) => {
    const tl = THREAT_LEVELS[level];
    return (
      <div style={{background:'#0a1520',borderRadius:12,border:'1px solid #00e5c833',padding:14,marginBottom:10}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
          <span style={{fontSize:9,fontWeight:700,letterSpacing:2,textTransform:'uppercase',color:'#2a5568'}}>⬡ Perimeter Threat Level</span>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{padding:'3px 10px',borderRadius:20,fontSize:9,fontWeight:800,letterSpacing:1,textTransform:'uppercase',background:tl.bc,color:tl.btc,border:tl.bbd,transition:'all 0.5s'}}>{tl.badge}</span>
            <div style={{textAlign:'center',background:'#060e18',border:'1px solid #00e5c833',borderRadius:8,padding:'5px 8px',animation:'streakGlow 3s ease-in-out infinite'}}>
              <div style={{fontSize:7,color:'#2a5568',letterSpacing:1}}>STREAK</div>
              <div style={{fontSize:16,fontWeight:800,color:'#00e5c8',lineHeight:1}}>{streak}</div>
              <div style={{fontSize:7,color:'#2a5568'}}>days clear</div>
            </div>
          </div>
        </div>
        <div style={{height:8,background:'#0d1f2e',borderRadius:4,overflow:'hidden',marginBottom:6,position:'relative'}}>
          <div style={{height:'100%',width:tl.pct,background:tl.bg,borderRadius:4,transition:'width 0.8s ease, background 0.5s ease',position:'relative'}}>
            <div style={{position:'absolute',top:0,left:0,right:0,bottom:0,background:'linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent)',animation:'shine 2s ease-in-out infinite'}}/>
          </div>
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8}}>
          {['SECURE','ELEVATED','HIGH','CRITICAL'].map(z=><span key={z} style={{fontSize:7,color:'#1e4a5a'}}>{z}</span>)}
        </div>
        <div style={{display:'flex',gap:5}}>
          {[{label:'Critical',color:'#e24b4a',value:counts.critical},{label:'High',color:'#f0b429',value:counts.high},{label:'Medium',color:'#00e5c8',value:counts.medium},{label:'Low',color:'#818cf8',value:counts.low}].map(({label,color,value})=>(
            <div key={label} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'5px 3px',background:'#060e18',borderRadius:8,border:'1px solid #1a3545'}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:color,boxShadow:`0 0 6px ${color}`}}/>
              <span style={{fontSize:11,fontWeight:700,color,lineHeight:1}}>{value}</span>
              <span style={{fontSize:7,color:'#2a5568'}}>{label}</span>
            </div>
          ))}
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'5px 3px',background:'#00ff8808',borderRadius:8,border:'1px solid #00ff8833'}}>
            <div style={{width:6,height:6,borderRadius:'50%',background:'#00ff88',animation:'sPulse 1.5s infinite'}}/>
            <span style={{fontSize:9,fontWeight:800,color:'#00ff88',lineHeight:1}}>{counts.critical+counts.high===0?'ALL CLEAR':'ATTENTION'}</span>
            <span style={{fontSize:7,color:'#2a5568'}}>Status</span>
          </div>
        </div>
      </div>
    );
  };

  const BackgroundSentryBar = ({active,scansToday,lastScanAt}:{active:boolean;scansToday:number;lastScanAt:Date|null}) => (
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:12,background:'#0a1a14',border:'1px solid #00e5c833',marginBottom:10,position:'relative',overflow:'hidden'}}>
      <svg style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',pointerEvents:'none'}} viewBox="0 0 300 46" preserveAspectRatio="none">
        <line x1="0" y1="23" x2="300" y2="23" stroke="#00e5c8" strokeWidth="0.4" strokeDasharray="8 6" opacity="0.2"><animate attributeName="stroke-dashoffset" from="0" to="-28" dur="1.5s" repeatCount="indefinite"/></line>
        <line x1="0" y1="12" x2="300" y2="12" stroke="#00e5c8" strokeWidth="0.3" strokeDasharray="4 10" opacity="0.1"><animate attributeName="stroke-dashoffset" from="0" to="-28" dur="2.2s" repeatCount="indefinite"/></line>
        <circle cx="280" cy="23" r="3" fill="#00e5c8" opacity="0.3"><animate attributeName="cx" values="300;0" dur="3s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0.6;0" dur="3s" repeatCount="indefinite"/></circle>
      </svg>
      <div style={{width:8,height:8,borderRadius:'50%',background:active?'#00e5c8':'#2a5568',animation:active?'sPulse 1.5s ease-in-out infinite':'none',boxShadow:active?'0 0 10px #00e5c8':'none',flexShrink:0}}/>
      <div style={{flex:1,position:'relative',zIndex:1}}>
        <div style={{fontSize:11,fontWeight:700,color:'#00e5c8',letterSpacing:1.5,textTransform:'uppercase'}}>Background Sentry</div>
        <div style={{fontSize:9,color:'#2a5568',marginTop:1}}>Monitoring WhatsApp · Email · SMS Alerts · Links · Media</div>
        <div style={{fontSize:8,color:'#1e4a5a',marginTop:2,fontStyle:'italic'}}>ℹ {t('dashboard_sentry_sms_note')}</div>
      </div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:3,position:'relative',zIndex:1}}>
        <span style={{padding:'3px 10px',borderRadius:20,background:active?'#00e5c8':'#1a3545',color:active?'#060b12':'#2a5568',fontSize:9,fontWeight:800,letterSpacing:1}}>{active?'ACTIVE':'INACTIVE'}</span>
        <span style={{fontSize:8,color:'#2a5568'}}>{scansToday} scans today{lastScanAt ? ` · last ${formatDistanceToNow(lastScanAt, {addSuffix:true})}` : ''}</span>
      </div>
    </div>
  );

  const ArcGaugeCards = ({stats}:{stats:{dailyCleaned:number;events:number;critical:number;toneMatches:number}}) => {
    const gauges = [
      {label:'Daily Cleaned', value:stats.dailyCleaned, desc:'Threats neutralized', color:'#00e5c8',
       icon:<path d="M40 25L30 30L30 39C30 46 34 51 40 53C46 51 50 46 50 39L50 30Z" fill="none" stroke="#00e5c8" strokeWidth="1.5" opacity="0.7"/>,
       dur:'8s', da:'55 159', from:'-90 40 40', to:'270 40 40'},
      {label:'Sentry Events', value:stats.events, desc:'Logs audited', color:'#f0b429',
       icon:<polyline points="25,45 30,34 34,49 40,27 46,41 50,35 55,45" fill="none" stroke="#f0b429" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.8"/>,
       dur:'10s', da:'40 174', from:'270 40 40', to:'-90 40 40'},
      {label:'Critical Blocks', value:stats.critical, desc:'High-risk exploits', color:'#e24b4a',
       icon:<><polygon points="40,27 29,47 51,47" fill="none" stroke="#e24b4a" strokeWidth="1.8" strokeLinejoin="round" opacity="0.8"/><line x1="40" y1="33" x2="40" y2="42" stroke="#e24b4a" strokeWidth="2" strokeLinecap="round"/><circle cx="40" cy="45" r="1.5" fill="#e24b4a"/></>,
       dur:'6s', da:'28 186', from:'-90 40 40', to:'270 40 40'},
      {label:'Tone Matches', value:stats.toneMatches, desc:'Linguistic checks', color:'#818cf8',
       icon:<><rect x="26" y="31" width="28" height="18" rx="3" fill="none" stroke="#818cf8" strokeWidth="1.5" opacity="0.8"/><path d="M26 31L40 42L54 31" fill="none" stroke="#818cf8" strokeWidth="1.5" strokeLinejoin="round" opacity="0.8"/></>,
       dur:'11s', da:'45 169', from:'90 40 40', to:'450 40 40'},
    ];
    return (
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:9,marginBottom:10}}>
        {gauges.map(({label,value,desc,color,icon,dur,da,from,to})=>(
          <div key={label} style={{background:'#0a1520',borderRadius:12,border:'1px solid #1a3545',padding:'10px 6px',display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="34" fill="none" stroke={color+'11'} strokeWidth="6"/>
              <circle cx="40" cy="40" r="34" fill="none" stroke={color} strokeWidth="6" strokeDasharray={da} strokeLinecap="round">
                <animateTransform attributeName="transform" type="rotate" from={from} to={to} dur={dur} repeatCount="indefinite"/>
              </circle>
              <circle cx="40" cy="40" r="26" fill="none" stroke={color+'22'} strokeWidth="1" strokeDasharray="3 4">
                <animateTransform attributeName="transform" type="rotate" from="0 40 40" to="-360 40 40" dur="12s" repeatCount="indefinite"/>
              </circle>
              {icon}
              <circle cx="40" cy="5" r="2" fill={color} opacity="0.6">
                <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite"/>
              </circle>
            </svg>
            <span style={{fontSize:8,fontWeight:700,letterSpacing:1,textTransform:'uppercase',color:'#2a5568',textAlign:'center'}}>{label}</span>
            <span style={{fontSize:22,fontWeight:800,color,lineHeight:1}}>{value}</span>
            <span style={{fontSize:7,color:'#1e4a5a',textAlign:'center'}}>{desc}</span>
          </div>
        ))}
      </div>
    );
  };

  const RadarCard = ({scansToday,lastScanAt}:{scansToday:number;lastScanAt:Date|null}) => (
    <div style={{background:'#0a1520',borderRadius:12,border:'1px solid #00e5c833',padding:14,marginBottom:10}}>
      <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:10}}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="#00e5c8"><polygon points="7,1 9,5 13,5 10,8 11,13 7,10 3,13 4,8 1,5 5,5"/></svg>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:'#00e5c8'}}>Autonomous Intelligence Mode</div>
          <div style={{fontSize:9,color:'#2a5568',marginTop:1}}>Zero-Interaction mode — Stateless AI Inference active</div>
        </div>
      </div>
      <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
        <div style={{position:'relative',flexShrink:0}}>
          <svg width="134" height="134" viewBox="0 0 134 134">
            <defs>
              <radialGradient id="rg"><stop offset="0%" stopColor="#00e5c8" stopOpacity="0.2"/><stop offset="100%" stopColor="#00e5c8" stopOpacity="0"/></radialGradient>
              <clipPath id="rclip"><circle cx="67" cy="67" r="62"/></clipPath>
            </defs>
            <circle cx="67" cy="67" r="62" fill="#060e18" stroke="#00e5c822" strokeWidth="1"/>
            <circle cx="67" cy="67" r="46" fill="none" stroke="#00e5c80e" strokeWidth="0.8"/>
            <circle cx="67" cy="67" r="31" fill="none" stroke="#00e5c80e" strokeWidth="0.8"/>
            <circle cx="67" cy="67" r="16" fill="none" stroke="#00e5c811" strokeWidth="0.8"/>
            <line x1="5" y1="67" x2="129" y2="67" stroke="#00e5c80a" strokeWidth="0.5"/>
            <line x1="67" y1="5" x2="67" y2="129" stroke="#00e5c80a" strokeWidth="0.5"/>
            <g clipPath="url(#rclip)">
              <path d="M67 67 L129 67 A62 62 0 0 0 67 5 Z" fill="url(#rg)"><animateTransform attributeName="transform" type="rotate" from="0 67 67" to="360 67 67" dur="3s" repeatCount="indefinite"/></path>
              <line x1="67" y1="67" x2="129" y2="67" stroke="#00e5c8" strokeWidth="1.5" opacity="0.9"><animateTransform attributeName="transform" type="rotate" from="0 67 67" to="360 67 67" dur="3s" repeatCount="indefinite"/></line>
            </g>
            <circle cx="67" cy="67" r="4" fill="#00e5c8"><animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite"/></circle>
            {(['N','E','S','W'] as const).map((d)=>{
              const positions:{[k:string]:{x:number,y:number}} = {N:{x:67,y:10},E:{x:126,y:70},S:{x:67,y:131},W:{x:8,y:70}};
              return <text key={d} x={positions[d].x} y={positions[d].y} textAnchor="middle" fontSize="7" fill="#00e5c833" fontFamily="monospace">{d}</text>;
            })}
          </svg>
          <div style={{position:'absolute',top:6,right:6,background:'#060e18cc',border:'1px solid #00e5c833',borderRadius:6,padding:'3px 7px',textAlign:'center'}}>
            <div style={{fontSize:7,color:'#2a5568',letterSpacing:1}}>SCANS TODAY</div>
            <div style={{fontSize:14,fontWeight:800,color:'#00e5c8'}}>{scansToday}</div>
          </div>
          <div style={{position:'absolute',bottom:6,left:6,background:'#060e18cc',border:'1px solid #00e5c822',borderRadius:6,padding:'3px 7px'}}>
            <div style={{fontSize:7,color:'#2a5568',letterSpacing:1}}>LAST SCAN</div>
            <div style={{fontSize:10,fontWeight:700,color:'#00e5c8'}}>{lastScanAt ? formatDistanceToNow(lastScanAt, {addSuffix:true}) : 'No scans yet'}</div>
          </div>
        </div>
        <div style={{flex:1,display:'flex',flexDirection:'column',gap:6}}>
          {[['Scan Mode','Zero-Interaction'],['AI Engine','Nemotron Active'],['Data Retained','None — Stateless'],['Coverage','Links · SMS · Email · Audio · Media']].map(([l,v])=>(
            <div key={l} style={{background:'#060e18',borderRadius:8,padding:'7px 10px',border:'1px solid #1a3545'}}>
              <div style={{fontSize:7,color:'#2a5568',letterSpacing:1,textTransform:'uppercase',marginBottom:2}}>{l}</div>
              <div style={{fontSize:11,fontWeight:700,color:l==='Data Retained'?'#00ff88':'#00e5c8'}}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const MonitoringRow = ({total,escalated,blocked}:{total:number,escalated:number,blocked:number}) => (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:10}}>
      {[{label:'Total Events',value:total,color:'#00e5c8'},
        {label:'Escalated',value:escalated,color:'#f0b429'},
        {label:'Blocked',value:blocked,color:'#e24b4a'}].map(({label,value,color})=>(
        <div key={label} style={{background:'#0a1520',borderRadius:10,border:'1px solid #1a3545',padding:'9px 7px',display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
          <svg width="46" height="46" viewBox="0 0 46 46">
            <circle cx="23" cy="23" r="19" fill="none" stroke={color+'11'} strokeWidth="5"/>
            <circle cx="23" cy="23" r="19" fill="none" stroke={color} strokeWidth="5" strokeDasharray="60 59" strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" from="-90 23 23" to="270 23 23" dur="8s" repeatCount="indefinite"/>
            </circle>
            <text x="23" y="27" textAnchor="middle" fontSize="9" fontWeight="800" fill={color} fontFamily="-apple-system,sans-serif">{value}</text>
          </svg>
          <span style={{fontSize:8,fontWeight:700,color:'#2a5568',letterSpacing:1,textTransform:'uppercase',textAlign:'center'}}>{label}</span>
          <span style={{fontSize:8,color:'#1e4a5a'}}>Today</span>
        </div>
      ))}
    </div>
  );

  const ActiveAlertsAndVelocity = ({activeCount,totalToday,velocity,maxVelocity}:{activeCount:number;totalToday:number;velocity:number[];maxVelocity:number}) => {
    const pct = totalToday > 0 ? (activeCount / totalToday) * 100 : 0;
    return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
      <div style={{background:'#0a1520',borderRadius:12,border:'1px solid #1a3545',padding:12}}>
        <div style={{fontSize:11,fontWeight:700,color:'#fff',marginBottom:2}}>Active Alerts</div>
        <div style={{fontSize:9,color:'#2a5568',marginBottom:8}}>Unresolved findings today</div>
        <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:8}}>
          <span style={{fontSize:32,fontWeight:800,color:'#e24b4a',lineHeight:1}}>{activeCount}</span>
          <div><div style={{fontSize:11,fontWeight:700,color:'#e24b4a'}}>{pct.toFixed(1)}%</div><div style={{fontSize:8,color:'#2a5568'}}>of today's scans</div></div>
        </div>
        <div style={{height:5,background:'#0d1f2e',borderRadius:3,overflow:'hidden',marginBottom:4}}>
          <div style={{width:`${Math.min(100,pct)}%`,height:'100%',background:'#e24b4a',borderRadius:3}}/>
        </div>
        <div style={{display:'flex',justifyContent:'space-between'}}>
          <span style={{fontSize:7,color:'#1e4a5a'}}>0%</span><span style={{fontSize:7,color:'#1e4a5a'}}>100%</span>
        </div>
      </div>
      <div style={{background:'#0a1520',borderRadius:12,border:'1px solid #1a3545',padding:12}}>
        <div style={{fontSize:11,fontWeight:700,color:'#fff',marginBottom:2}}>Scan Velocity</div>
        <div style={{fontSize:9,color:'#2a5568',marginBottom:6}}>Scans/day, last 7 days</div>
        <svg width="100%" height="68" viewBox="0 0 130 68">
          <g fill="#00e5c8">{velocity.map((v,i)=>{
            const h = Math.round((v/maxVelocity)*46);
            return <rect key={i} x={5+i*19} y={54-h} width="14" height={Math.max(h,2)} rx="2" opacity={0.4+i*0.08}/>;
          })}</g>
          <g fontSize="6" fill="#2a5568" fontFamily="-apple-system,sans-serif" textAnchor="middle">
            {dayBuckets.map((d,i)=><text key={i} x={12+i*19} y="66">{format(d,'EEEEE')}</text>)}
          </g>
        </svg>
      </div>
    </div>
    );
  };

  const OperationalPie = ({counts,total}:{counts:Record<string,number>;total:number}) => {
    let cumulative = 0;
    const segments = MODULE_META.map((m) => {
      const pct = total > 0 ? (counts[m.key] / total) * 100 : 0;
      const arc = (pct / 100) * PIE_CIRCUMFERENCE;
      const seg = { ...m, pct, da: `${arc} ${PIE_CIRCUMFERENCE - arc}`, offset: -cumulative };
      cumulative += arc;
      return seg;
    });
    return (
      <div style={{background:'#0a1520',borderRadius:12,border:'1px solid #1a3545',padding:12,marginBottom:10}}>
        <div style={{fontSize:11,fontWeight:700,color:'#fff',marginBottom:2}}>Operational Breakdown</div>
        <div style={{fontSize:9,color:'#2a5568',marginBottom:10}}>Your scan distribution by module</div>
        <div style={{display:'flex',alignItems:'center',gap:14}}>
          <svg width="110" height="110" viewBox="0 0 110 110" style={{flexShrink:0}}>
            {total === 0 ? (
              <circle cx="55" cy="55" r="40" fill="none" stroke="#1a3545" strokeWidth="14"/>
            ) : segments.map((s)=>(
              <circle key={s.key} cx="55" cy="55" r="40" fill="none" stroke={s.color} strokeWidth="14" strokeDasharray={s.da} strokeDashoffset={s.offset} transform="rotate(-90 55 55)"/>
            ))}
            <circle cx="55" cy="55" r="26" fill="#060e18"/>
            <text x="55" y="51" textAnchor="middle" fontSize="7" fill="#2a5568" fontFamily="-apple-system,sans-serif">TOTAL</text>
            <text x="55" y="63" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" fontFamily="-apple-system,sans-serif">{total} Scans</text>
          </svg>
          <div style={{flex:1,display:'flex',flexDirection:'column',gap:5}}>
            {total === 0 ? (
              <span style={{fontSize:9,color:'#2a5568'}}>Run a scan to see your module breakdown here.</span>
            ) : segments.map(({key,label,color,pct})=>(
              <div key={key}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:8,height:8,borderRadius:2,background:color}}/><span style={{fontSize:9}}>{label}</span></div>
                  <span style={{fontSize:10,fontWeight:700,color}}>{pct.toFixed(0)}%</span>
                </div>
                <div style={{height:4,background:'#0d1f2e',borderRadius:2,marginTop:2}}><div style={{width:`${pct}%`,height:'100%',background:color,borderRadius:2}}/></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const SecurityPostureScore = ({score,label,sentryActive,scanCoveragePct,streakDays}:{score:number;label:string;sentryActive:boolean;scanCoveragePct:number;streakDays:number}) => {
    const arc = (score/100) * RING_CIRCUMFERENCE;
    return (
    <div style={{background:'#0a1520',borderRadius:12,border:'1px solid #00e5c833',padding:12,marginBottom:10}}>
      <div style={{fontSize:11,fontWeight:700,color:'#fff',marginBottom:2}}>Security Posture Score</div>
      <div style={{fontSize:9,color:'#2a5568',marginBottom:10}}>Calculated from your scan activity, threat history & sentry status</div>
      <div style={{display:'flex',alignItems:'center',gap:14}}>
        <svg width="100" height="100" viewBox="0 0 100 100" style={{flexShrink:0}}>
          <defs><linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#00ff88"/><stop offset="100%" stopColor="#00e5c8"/></linearGradient></defs>
          <circle cx="50" cy="50" r="40" fill="none" stroke="#00e5c811" strokeWidth="8"/>
          <circle cx="50" cy="50" r="40" fill="none" stroke="url(#sg)" strokeWidth="8" strokeDasharray={`${arc} ${RING_CIRCUMFERENCE-arc}`} strokeLinecap="round" transform="rotate(-90 50 50)"/>
          <circle cx="50" cy="50" r="30" fill="none" stroke="#00e5c822" strokeWidth="0.8" strokeDasharray="3 4">
            <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="-360 50 50" dur="12s" repeatCount="indefinite"/>
          </circle>
          <circle cx="50" cy="50" r="22" fill="#060e18"/>
          <text x="50" y="46" textAnchor="middle" fontSize="18" fontWeight="800" fill="#00ff88" fontFamily="-apple-system,sans-serif">{score}</text>
          <text x="50" y="57" textAnchor="middle" fontSize="7" fill="#00e5c8" fontFamily="-apple-system,sans-serif">/ 100</text>
        </svg>
        <div style={{flex:1,display:'flex',flexDirection:'column',gap:5}}>
          {[
            {l:'Sentry Coverage',v:sentryActive?'100%':'50%',c:'#00e5c8',w:sentryActive?'100%':'50%'},
            {l:'Scan Coverage',v:`${scanCoveragePct}%`,c:'#00ff88',w:`${scanCoveragePct}%`},
            {l:'Zero-Knowledge',v:'100%',c:'#00e5c8',w:'100%'},
            {l:'Protection Streak',v:`${streakDays} days`,c:'#f0b429',w:`${Math.min(100,streakDays*10)}%`},
          ].map(({l,v,c,w})=>(
            <div key={l}>
              <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontSize:8,color:'#2a5568'}}>{l}</span><span style={{fontSize:9,fontWeight:700,color:c}}>{v}</span></div>
              <div style={{height:4,background:'#0d1f2e',borderRadius:2,marginTop:2}}><div style={{width:w,height:'100%',background:c,borderRadius:2}}/></div>
            </div>
          ))}
          <div style={{background:'#00ff8811',border:'1px solid #00ff8833',borderRadius:6,padding:'4px 8px',marginTop:3,textAlign:'center'}}>
            <span style={{fontSize:9,fontWeight:700,color:'#00ff88'}}>{label.toUpperCase()}</span>
          </div>
        </div>
      </div>
    </div>
    );
  };

  const PerimeterAlerts = ({alerts:alertList}:{alerts:any[]}) => {
    if (alertList && alertList.length > 0) return (
      <div style={{background:'#0a1520',borderRadius:12,border:'1px solid #1a3545',padding:12}}>
        <div style={{fontSize:11,fontWeight:700,color:'#fff',marginBottom:2}}>Recent Perimeter Alerts</div>
        <div style={{fontSize:9,color:'#2a5568',marginBottom:8}}>Real threat detections from your scan history</div>
        <div className="space-y-3">
          {alertList.map((alert) => (
            <div key={alert.id} className="flex items-start justify-between p-3 border rounded-lg bg-muted/20 hover:bg-muted/40 transition-all gap-3">
              <div className="flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-sm uppercase text-primary">{alert.moduleType}</span>
                  <Badge variant="outline" className="text-[9px] h-4 py-0">SENTRY</Badge>
                  <span className="text-[10px] text-muted-foreground">{format(new Date(alert.scanTimestamp),'HH:mm')}</span>
                </div>
                <span className="text-xs text-muted-foreground">{alert.summary}</span>
              </div>
              <Badge variant={alert.alertLevel==='critical'||alert.alertLevel==='high'?'destructive':'default'} className="text-[10px]">
                {alert.alertLevel.toUpperCase()}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    );
    return (
      <div style={{background:'#0a1520',borderRadius:12,border:'1px solid #1a3545',padding:12}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
          <div>
            <div style={{fontSize:11,fontWeight:700,color:'#fff'}}>Recent Perimeter Alerts</div>
            <div style={{fontSize:9,color:'#2a5568'}}>Real threat detections from your scan history</div>
          </div>
          <div style={{display:'flex',gap:6}}>
            {[{c:'#e24b4a',l:'Critical'},{c:'#f0b429',l:'High'},{c:'#00e5c8',l:'Low'}].map(({c,l})=>(
              <div key={l} style={{display:'flex',alignItems:'center',gap:3}}><div style={{width:5,height:5,borderRadius:'50%',background:c}}/><span style={{fontSize:8,color:'#2a5568'}}>{l}</span></div>
            ))}
          </div>
        </div>
        <svg width="100%" height="150" viewBox="0 0 320 150">
          <defs><radialGradient id="pg" cx="50%" cy="50%" r="50%"><stop offset="0%" stopColor="#00e5c8" stopOpacity="0.12"/><stop offset="100%" stopColor="#00e5c8" stopOpacity="0"/></radialGradient></defs>
          <g stroke="#00e5c8" strokeWidth="0.4" opacity="0.07"><line x1="0" y1="37" x2="320" y2="37"/><line x1="0" y1="75" x2="320" y2="75"/><line x1="0" y1="113" x2="320" y2="113"/><line x1="64" y1="0" x2="64" y2="150"/><line x1="128" y1="0" x2="128" y2="150"/><line x1="192" y1="0" x2="192" y2="150"/><line x1="256" y1="0" x2="256" y2="150"/></g>
          <circle cx="160" cy="75" r="18" fill="none" stroke="#00e5c8" strokeWidth="1" opacity="0"><animate attributeName="r" values="18;130;18" dur="4s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.6;0;0.6" dur="4s" repeatCount="indefinite"/></circle>
          <circle cx="160" cy="75" r="18" fill="none" stroke="#00e5c8" strokeWidth="0.6" opacity="0"><animate attributeName="r" values="18;130;18" dur="4s" begin="1.3s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.35;0;0.35" dur="4s" begin="1.3s" repeatCount="indefinite"/></circle>
          <circle cx="160" cy="75" r="26" fill="url(#pg)"/>
          <g style={{animation:'floatShield 3s ease-in-out infinite'}}><path d="M160 58L148 64L148 75C148 84 153 91 160 93C167 91 172 84 172 75L172 64Z" fill="none" stroke="#00e5c8" strokeWidth="2"/><path d="M155 75L158 78L165 71" stroke="#00e5c8" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/></g>
          <g fill="#00e5c8" opacity="0.3"><circle cx="32" cy="18" r="2.5"><animate attributeName="opacity" values="0.2;0.6;0.2" dur="2.5s" repeatCount="indefinite"/></circle><circle cx="288" cy="18" r="2.5"><animate attributeName="opacity" values="0.2;0.6;0.2" dur="3s" repeatCount="indefinite"/></circle><circle cx="32" cy="132" r="2.5"><animate attributeName="opacity" values="0.2;0.6;0.2" dur="2s" repeatCount="indefinite"/></circle><circle cx="288" cy="132" r="2.5"><animate attributeName="opacity" values="0.2;0.6;0.2" dur="3.5s" repeatCount="indefinite"/></circle></g>
          <text x="160" y="122" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily="-apple-system,sans-serif">Perimeter Clear</text>
          <text x="160" y="136" textAnchor="middle" fontSize="8" fill="#2a5568" fontFamily="-apple-system,sans-serif">No threats detected by Sentry</text>
        </svg>
      </div>
    );
  };

  /* ─── Main Dashboard ─────────────────────────────────────────── */
  const FullSentryDashboard = () => {
    const stats = {
      dailyCleaned: todaysAlerts.filter((a:any)=>a.alertLevel!=='low').length,
      events: scansToday,
      critical: levelCounts.critical,
      toneMatches: todaysAlerts.filter((a:any)=>a.moduleType==='email').length,
    };

    return (
      <>
        <style>{SOC_STYLES}</style>
        <ThreatLevelMeter level={currentThreatLevel} streak={streakDays} counts={levelCounts}/>
        <BackgroundSentryBar active={sentryActive} scansToday={scansToday} lastScanAt={lastScanAt}/>
        <ArcGaugeCards stats={stats}/>
        <RadarCard scansToday={scansToday} lastScanAt={lastScanAt}/>
        <div style={{fontSize:9,fontWeight:700,color:'#00e5c8',letterSpacing:2,textTransform:'uppercase',margin:'14px 0 8px'}}>◈ Monitoring</div>
        <MonitoringRow total={scansToday} escalated={levelCounts.high} blocked={levelCounts.critical}/>
        <ActiveAlertsAndVelocity activeCount={levelCounts.critical+levelCounts.high} totalToday={scansToday} velocity={velocity} maxVelocity={maxVelocity}/>
        <OperationalPie counts={moduleCounts} total={totalModuleScans}/>
        <SecurityPostureScore score={postureScore} label={postureLabel} sentryActive={sentryActive} scanCoveragePct={scanCoveragePct} streakDays={streakDays}/>
        <div style={{fontSize:9,fontWeight:700,color:'#00e5c8',letterSpacing:2,textTransform:'uppercase',margin:'14px 0 8px'}}>◈ Recent Perimeter Alerts</div>
        <PerimeterAlerts alerts={recentThreatAlerts}/>
        <div style={{marginTop:10}}>
          <ManualScanCenter result={manualScanResult} setResult={setManualScanResult}/>
        </div>
      </>
    );
  };

  const LimitedModeDashboard = () => (
    <>
      <Card className="border-destructive/20 bg-destructive/5">
        <CardHeader className="flex-row items-center gap-4">
          <AlertTriangle className="size-8 text-destructive"/>
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
      <ManualScanCenter result={manualScanResult} setResult={setManualScanResult}/>
    </>
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-headline text-3xl md:text-4xl">{t('dashboard_welcome')}</h1>
        <p className="text-muted-foreground">
          {authUser.sentryMode==='full' ? t('dashboard_subheader_full') : t('dashboard_subheader_limited')}
        </p>
      </div>
      {authUser.sentryMode==='full' ? <FullSentryDashboard/> : <LimitedModeDashboard/>}
    </div>
  );
}
