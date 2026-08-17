
'use client';
// v1.1.0 — SMS & Call Shield + Deepfake Audio Analyzer

import { useAuth } from '@/hooks/use-auth';
import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { Card, CardDescription, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, Activity, AlertTriangle, MailWarning, Zap, Loader2 } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { useLocalization } from '@/hooks/use-localization';
import type { TranslationKey } from '@/context/language-provider';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ManualScanCenter, type ManualScanResult } from '@/components/dashboard/manual-scan-center';
import { useState, useEffect, useRef } from 'react';

/* ─── SOC Dashboard Styles ─────────────────────────────────────── */
const SOC_STYLES = `
@keyframes bRing{0%{opacity:.85;transform:translate(-50%,-50%) scale(.5)}100%{opacity:0;transform:translate(-50%,-50%) scale(2.6)}}
@keyframes sPulse{0%,100%{box-shadow:0 0 4px #00e5c8,0 0 10px #00e5c866}50%{box-shadow:0 0 10px #00e5c8,0 0 24px #00e5c8aa}}
@keyframes shine{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
@keyframes floatShield{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes streakGlow{0%,100%{box-shadow:0 0 6px #00e5c844}50%{box-shadow:0 0 16px #00e5c8aa}}
@keyframes sentryFlow{0%{stroke-dashoffset:200}100%{stroke-dashoffset:0}}
@keyframes radarSpin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
@keyframes perimPulse{0%{opacity:.6}100%{r:120;opacity:0}}
.soc-blob{position:absolute;transform:translate(-50%,-50%);border-radius:50%;cursor:pointer}
.soc-blob-ring{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);border-radius:50%;animation:bRing 2.5s ease-out infinite}
.soc-blob-ring2{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);border-radius:50%;animation:bRing 2.5s ease-out infinite 0.9s}
.soc-blob-core,.soc-blob-dot{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);border-radius:50%}
.soc-tip{position:absolute;background:#0a1a2eee;border:1px solid #00e5c844;border-radius:8px;padding:8px 10px;font-size:11px;pointer-events:none;z-index:100;display:none;white-space:nowrap;box-shadow:0 4px 20px rgba(0,0,0,.6)}
.soc-tip.show{display:block}
.soc-map-tab{padding:4px 12px;border-radius:20px;font-size:10px;font-weight:700;cursor:pointer;border:1px solid #1a3545;background:transparent;color:#2a5568;transition:all .2s;margin-right:6px}
.soc-map-tab.active{background:#00e5c822;color:#00e5c8;border-color:#00e5c8}
`;

/* ─── Threat blob data (v6 pixel-verified positions) ───────────── */
const THREAT_BLOBS = [
  {region:'Asia',        left:74.6,top:37.8,so:100,sm:72,sc:40,sd:20,color:'#e24b4a',inner:'#ff6b6a',count:45,level:'CRITICAL'},
  {region:'Europe',      left:54.0,top:25.4,so:76, sm:54,sc:30,sd:15,color:'#e24b4a',inner:'#ff6b6a',count:28,level:'CRITICAL'},
  {region:'Russia',      left:67.5,top:22.8,so:64, sm:46,sc:26,sd:13,color:'#e24b4a',inner:'#ff8855',count:22,level:'HIGH'},
  {region:'Middle East', left:58.2,top:40.4,so:58, sm:40,sc:22,sd:11,color:'#f0b429',inner:'#ffd700',count:18,level:'HIGH'},
  {region:'N. America',  left:27.0,top:36.5,so:50, sm:35,sc:20,sd:10,color:'#f0b429',inner:'#ffd700',count:12,level:'HIGH'},
  {region:'Africa',      left:56.1,top:56.0,so:42, sm:30,sc:17,sd:8, color:'#00e5c8',inner:'#4fffdf',count:8, level:'LOW'},
  {region:'S. America',  left:36.2,top:63.8,so:36, sm:25,sc:15,sd:7, color:'#00e5c8',inner:'#4fffdf',count:5, level:'LOW'},
  {region:'Australia',   left:79.5,top:69.0,so:30, sm:20,sc:13,sd:6, color:'#00e5c8',inner:'#4fffdf',count:3, level:'LOW'},
];

const THREAT_TIPS: Record<string,{t:string,c:string,m:string,tr:string}> = {
  'Asia':        {t:'CRITICAL',c:'#e24b4a',m:'Link (28) · Email (11) · SMS Shield (4) · Lure (2)',  tr:'↑ +8 vs yesterday'},
  'Europe':      {t:'CRITICAL',c:'#e24b4a',m:'Email (18) · Link (7) · Deepfake (2) · Lure (1)',     tr:'↑ +3 vs yesterday'},
  'Russia':      {t:'HIGH',    c:'#e24b4a',m:'Link (14) · Lure (5) · Deepfake (3)',                 tr:'→ Same as yesterday'},
  'Middle East': {t:'HIGH',    c:'#f0b429',m:'SMS Shield (8) · Lure (6) · Email (4)',               tr:'↑ +2 vs yesterday'},
  'N. America':  {t:'HIGH',    c:'#f0b429',m:'Link (7) · Email (4) · Deepfake (1)',                 tr:'↓ -1 vs yesterday'},
  'Africa':      {t:'LOW',     c:'#00e5c8',m:'SMS Shield (5) · Lure (2) · Link (1)',                tr:'→ Same as yesterday'},
  'S. America':  {t:'LOW',     c:'#00e5c8',m:'Link (3) · SMS Shield (2)',                           tr:'↓ -1 vs yesterday'},
  'Australia':   {t:'LOW',     c:'#00e5c8',m:'Link (2) · Lure (1)',                                 tr:'→ Same as yesterday'},
};

const THREAT_LEVELS = {
  secure:   {pct:'8%',  bg:'linear-gradient(90deg,#00ff88,#00e5c8)', badge:'SECURE',   bc:'#00ff8822',btc:'#00ff88',bbd:'1px solid #00ff8844'},
  elevated: {pct:'38%', bg:'linear-gradient(90deg,#f0b429,#e09000)', badge:'ELEVATED', bc:'#f0b42922',btc:'#f0b429',bbd:'1px solid #f0b42944'},
  high:     {pct:'65%', bg:'linear-gradient(90deg,#e24b4a,#c02020)', badge:'HIGH',     bc:'#e24b4a22',btc:'#e24b4a',bbd:'1px solid #e24b4a44'},
  critical: {pct:'95%', bg:'linear-gradient(90deg,#e24b4a,#ff0000)', badge:'CRITICAL', bc:'#e24b4a33',btc:'#e24b4a',bbd:'1px solid #e24b4a88'},
};

const TOP_ORIGINS = [
  {r:'Asia',        p:100,c:'#e24b4a',c2:'#ff6b6a',n:45},
  {r:'Europe',      p:62, c:'#e24b4a',c2:'#ff6b6a',n:28},
  {r:'Russia',      p:49, c:'#e24b4a',c2:'#ff6b6a',n:22},
  {r:'Middle East', p:40, c:'#f0b429',c2:'#ffd700',n:18},
  {r:'N. America',  p:27, c:'#f0b429',c2:'#ffd700',n:12},
  {r:'Africa',      p:18, c:'#00e5c8',c2:'#4fffdf',n:8},
  {r:'S. America',  p:11, c:'#00e5c8',c2:'#4fffdf',n:5},
  {r:'Australia',   p:7,  c:'#00e5c8',c2:'#4fffdf',n:3},
];

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
      limit(5)
    );
  }, [firestore, firebaseUser]);

  const { data: alerts, isLoading: isAlertsLoading } = useCollection(recentAlertsQuery);
  const isLoading = isUserLoading || isAlertsLoading;

  if (isLoading) {
    return <div className="flex h-full items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  /* ─── SOC Dashboard components ─────────────────────────────── */

  const ThreatLevelMeter = () => {
    const [level, setLevel] = useState<'secure'|'elevated'|'high'|'critical'>('secure');
    const tl = THREAT_LEVELS[level];
    return (
      <div style={{background:'#0a1520',borderRadius:12,border:'1px solid #00e5c833',padding:14,marginBottom:10}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
          <span style={{fontSize:9,fontWeight:700,letterSpacing:2,textTransform:'uppercase',color:'#2a5568'}}>⬡ Perimeter Threat Level</span>
          <div style={{display:'flex',alignItems:'center',gap:8}}>
            <span style={{padding:'3px 10px',borderRadius:20,fontSize:9,fontWeight:800,letterSpacing:1,textTransform:'uppercase',background:tl.bc,color:tl.btc,border:tl.bbd,transition:'all 0.5s'}}>{tl.badge}</span>
            <div style={{textAlign:'center',background:'#060e18',border:'1px solid #00e5c833',borderRadius:8,padding:'5px 8px',animation:'streakGlow 3s ease-in-out infinite'}}>
              <div style={{fontSize:7,color:'#2a5568',letterSpacing:1}}>STREAK</div>
              <div style={{fontSize:16,fontWeight:800,color:'#00e5c8',lineHeight:1}}>14</div>
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
        <div style={{display:'flex',gap:5,marginBottom:10}}>
          {[{label:'Critical',color:'#e24b4a'},{label:'High',color:'#f0b429'},{label:'Medium',color:'#00e5c8'},{label:'Low',color:'#818cf8'}].map(({label,color})=>(
            <div key={label} style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'5px 3px',background:'#060e18',borderRadius:8,border:'1px solid #1a3545'}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:color,boxShadow:`0 0 6px ${color}`}}/>
              <span style={{fontSize:11,fontWeight:700,color,lineHeight:1}}>0</span>
              <span style={{fontSize:7,color:'#2a5568'}}>{label}</span>
            </div>
          ))}
          <div style={{flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:3,padding:'5px 3px',background:'#00ff8808',borderRadius:8,border:'1px solid #00ff8833'}}>
            <div style={{width:6,height:6,borderRadius:'50%',background:'#00ff88',animation:'sPulse 1.5s infinite'}}/>
            <span style={{fontSize:9,fontWeight:800,color:'#00ff88',lineHeight:1}}>ALL CLEAR</span>
            <span style={{fontSize:7,color:'#2a5568'}}>Status</span>
          </div>
        </div>
        <div style={{display:'flex',gap:5}}>
          {(['secure','elevated','high','critical'] as const).map(l=>(
            <button key={l} onClick={()=>setLevel(l)} style={{flex:1,padding:5,borderRadius:8,border:`1px solid ${THREAT_LEVELS[l].bbd.split(' ')[2]}`,background:THREAT_LEVELS[l].bc,color:THREAT_LEVELS[l].btc,fontSize:8,fontWeight:700,cursor:'pointer',letterSpacing:1,textTransform:'uppercase'}}>
              {l}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const BackgroundSentryBar = ({scanCount}:{scanCount:number}) => (
    <div style={{display:'flex',alignItems:'center',gap:10,padding:'10px 14px',borderRadius:12,background:'#0a1a14',border:'1px solid #00e5c833',marginBottom:10,position:'relative',overflow:'hidden'}}>
      <svg style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',pointerEvents:'none'}} viewBox="0 0 300 46" preserveAspectRatio="none">
        <line x1="0" y1="23" x2="300" y2="23" stroke="#00e5c8" strokeWidth="0.4" strokeDasharray="8 6" opacity="0.2"><animate attributeName="stroke-dashoffset" from="0" to="-28" dur="1.5s" repeatCount="indefinite"/></line>
        <line x1="0" y1="12" x2="300" y2="12" stroke="#00e5c8" strokeWidth="0.3" strokeDasharray="4 10" opacity="0.1"><animate attributeName="stroke-dashoffset" from="0" to="-28" dur="2.2s" repeatCount="indefinite"/></line>
        <circle cx="280" cy="23" r="3" fill="#00e5c8" opacity="0.3"><animate attributeName="cx" values="300;0" dur="3s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0.6;0" dur="3s" repeatCount="indefinite"/></circle>
      </svg>
      <div style={{width:8,height:8,borderRadius:'50%',background:'#00e5c8',animation:'sPulse 1.5s ease-in-out infinite',boxShadow:'0 0 10px #00e5c8',flexShrink:0}}/>
      <div style={{flex:1,position:'relative',zIndex:1}}>
        <div style={{fontSize:11,fontWeight:700,color:'#00e5c8',letterSpacing:1.5,textTransform:'uppercase'}}>Background Sentry</div>
        <div style={{fontSize:9,color:'#2a5568',marginTop:1}}>Monitoring WhatsApp · Email · SMS Alerts · Links · Media</div>
        <div style={{fontSize:8,color:'#1e4a5a',marginTop:2,fontStyle:'italic'}}>ℹ SMS monitoring captures notification previews. For full SMS analysis use SMS & Call Shield.</div>
      </div>
      <div style={{display:'flex',flexDirection:'column',alignItems:'flex-end',gap:3,position:'relative',zIndex:1}}>
        <span style={{padding:'3px 10px',borderRadius:20,background:'#00e5c8',color:'#060b12',fontSize:9,fontWeight:800,letterSpacing:1}}>ACTIVE</span>
        <span style={{fontSize:8,color:'#2a5568'}}>{scanCount} scans today</span>
      </div>
    </div>
  );

  const ArcGaugeCards = ({stats}:{stats:any}) => {
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

  const RadarCard = ({scanCount}:{scanCount:number}) => (
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
            <circle cx="93" cy="40" r="0" fill="#00e5c8"><animate attributeName="r" values="0;4;0" dur="3s" begin="0.7s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="3s" begin="0.7s" repeatCount="indefinite"/></circle>
            <circle cx="42" cy="86" r="0" fill="#00e5c8"><animate attributeName="r" values="0;3;0" dur="3s" begin="1.6s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0.8;0" dur="3s" begin="1.6s" repeatCount="indefinite"/></circle>
            <circle cx="108" cy="74" r="0" fill="#f0b429"><animate attributeName="r" values="0;3;0" dur="3s" begin="2.3s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;1;0" dur="3s" begin="2.3s" repeatCount="indefinite"/></circle>
            <circle cx="67" cy="67" r="4" fill="#00e5c8"><animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite"/></circle>
            {(['N','E','S','W'] as const).map((d,i)=>{
              const positions:{[k:string]:{x:number,y:number}} = {N:{x:67,y:10},E:{x:126,y:70},S:{x:67,y:131},W:{x:8,y:70}};
              return <text key={d} x={positions[d].x} y={positions[d].y} textAnchor="middle" fontSize="7" fill="#00e5c833" fontFamily="monospace">{d}</text>;
            })}
          </svg>
          <div style={{position:'absolute',top:6,right:6,background:'#060e18cc',border:'1px solid #00e5c833',borderRadius:6,padding:'3px 7px',textAlign:'center'}}>
            <div style={{fontSize:7,color:'#2a5568',letterSpacing:1}}>SCANS TODAY</div>
            <div style={{fontSize:14,fontWeight:800,color:'#00e5c8'}}>{scanCount}</div>
          </div>
          <div style={{position:'absolute',bottom:6,left:6,background:'#060e18cc',border:'1px solid #00e5c822',borderRadius:6,padding:'3px 7px'}}>
            <div style={{fontSize:7,color:'#2a5568',letterSpacing:1}}>LAST SCAN</div>
            <div style={{fontSize:10,fontWeight:700,color:'#00e5c8'}}>2 min ago</div>
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

  const GlobalThreatMap = () => {
    const mapRef = useRef<HTMLDivElement>(null);
    const [activeTip, setActiveTip] = useState<{region:string,count:number,color:string,top:number,left:number}|null>(null); // top/left are % values
    const showTip = (region:string, count:number, level:string, color:string, blobLeft:number, blobTop:number) => {
      const d = THREAT_TIPS[region];
      if (!d) return;
      const tipTop = Math.max(blobTop - 22, 3);
      const tipLeft = Math.min(Math.max(blobLeft - 12, 1), 60);
      setActiveTip({region, count, color, top: tipTop, left: tipLeft});
      setTimeout(()=>setActiveTip(null), 5000);
    };
    return (
      <div style={{background:'#0a1520',borderRadius:12,border:'1px solid #1a3545',padding:12,marginBottom:10}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:8}}>
          <div>
            <div style={{fontSize:12,fontWeight:700,color:'#fff'}}>🌍 Global Threat Map</div>
            <div style={{fontSize:9,color:'#2a5568',marginTop:2}}>Real-time threat origin — tap a node for details</div>
          </div>
          <div style={{fontSize:8,color:'#2a5568',background:'#060e18',border:'1px solid #1a3545',borderRadius:6,padding:'3px 8px'}}>Last 24h</div>
        </div>
        <div ref={mapRef} data-mapwrap="true" style={{position:'relative',width:'100%',borderRadius:10,overflow:'visible',marginBottom:10}}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/world-map.png" alt="Global Threat Map" style={{width:'100%',height:'auto',display:'block'}}/>
          <div style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',pointerEvents:'none'}}>
            {THREAT_BLOBS.map(({region,left,top,so,sm,sc,sd,color,inner,count,level})=>(
              <div key={region} className="soc-blob" style={{left:`${left}%`,top:`${top}%`,pointerEvents:'all'}} onClick={()=>showTip(region,count,level,color,left,top)}>
                <div className="soc-blob-ring" style={{width:so,height:so,background:color,opacity:0.12}}/>
                <div className="soc-blob-ring2" style={{width:sm,height:sm,background:color,opacity:0.17}}/>
                <div className="soc-blob-core" style={{width:sc,height:sc,background:color,opacity:0.30}}/>
                <div className="soc-blob-dot" style={{width:sd,height:sd,background:color,opacity:0.90}}/>
                <div className="soc-blob-dot" style={{width:sd/2,height:sd/2,background:inner}}/>
                <div style={{position:'absolute',top:'50%',left:'50%',transform:'translate(-50%,calc(-50% - 18px))',fontSize:9,fontWeight:800,color,whiteSpace:'nowrap',textShadow:`0 0 8px ${color}`,pointerEvents:'none'}}>{count}</div>
              </div>
            ))}
          </div>
          {activeTip && (
            <div style={{
              position:'absolute',
              top:`${activeTip.top}%`,
              left:`${activeTip.left}%`,
              background:'rgba(8,16,36,0.97)',
              border:`1px solid ${activeTip.color}66`,
              borderRadius:10,
              padding:'10px 14px',
              fontSize:11,
              pointerEvents:'none',
              zIndex:999,
              whiteSpace:'nowrap',
              boxShadow:`0 4px 24px rgba(0,0,0,.8), 0 0 12px ${activeTip.color}22`,
              minWidth:160,
            }}>
              {(() => {
                const d = THREAT_TIPS[activeTip.region];
                if (!d) return null;
                return <>
                  <div style={{fontSize:10,fontWeight:700,color:d.c,marginBottom:4}}>{activeTip.region} — {d.t}</div>
                  <div style={{fontSize:9,color:'#fff',marginBottom:2}}>Threats: <b style={{color:d.c}}>{activeTip.count}</b></div>
                  <div style={{fontSize:8,color:'#2a5568',marginBottom:2}}>{d.m}</div>
                  <div style={{fontSize:8,color:'#2a5568'}}>{d.tr}</div>
                </>;
              })()}
            </div>
          )}
        </div>
        <div style={{fontSize:8,color:'#2a5568',letterSpacing:1.5,textTransform:'uppercase',marginBottom:8,fontWeight:700}}>Top Threat Origins</div>
        {TOP_ORIGINS.map(({r,p,c,c2,n})=>(
          <div key={r} style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
            <div style={{fontSize:8,color:'#2a5568',width:80,textAlign:'right',flexShrink:0}}>{r}</div>
            <div style={{flex:1,height:5,background:'#0d1f2e',borderRadius:3,overflow:'hidden'}}>
              <div style={{width:`${p}%`,height:'100%',borderRadius:3,background:`linear-gradient(90deg,${c},${c2})`}}/>
            </div>
            <div style={{fontSize:8,fontWeight:700,width:22,color:c}}>{n}</div>
          </div>
        ))}
        <div style={{display:'flex',gap:8,marginTop:10,paddingTop:8,borderTop:'1px solid #1a3545',flexWrap:'wrap',alignItems:'center'}}>
          {[{c:'#e24b4a',l:'Critical (20+)'},{c:'#f0b429',l:'High (10–20)'},{c:'#00e5c8',l:'Low (<10)'}].map(({c,l})=>(
            <div key={l} style={{display:'flex',alignItems:'center',gap:4}}>
              <div style={{width:7,height:7,borderRadius:'50%',background:c,boxShadow:`0 0 5px ${c}`}}/>
              <span style={{fontSize:8,color:'#2a5568'}}>{l}</span>
            </div>
          ))}
          <div style={{marginLeft:'auto',background:'#e24b4a11',border:'1px solid #e24b4a33',borderRadius:6,padding:'3px 8px'}}>
            <span style={{fontSize:8,color:'#e24b4a',fontWeight:700}}>⚠ Top: Asia (45)</span>
          </div>
        </div>
      </div>
    );
  };

  const MonitoringRow = ({total,escalated,blocked}:{total:number,escalated:number,blocked:number}) => (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:10}}>
      {[{label:'Total Events',value:total,color:'#00e5c8',trend:'↑ +12 today',tc:'#00ff88'},
        {label:'Escalated',value:escalated,color:'#f0b429',trend:'↑ +3 today',tc:'#e24b4a'},
        {label:'Blocked',value:blocked,color:'#e24b4a',trend:'↓ -2 today',tc:'#00ff88'}].map(({label,value,color,trend,tc})=>(
        <div key={label} style={{background:'#0a1520',borderRadius:10,border:'1px solid #1a3545',padding:'9px 7px',display:'flex',flexDirection:'column',alignItems:'center',gap:3}}>
          <svg width="46" height="46" viewBox="0 0 46 46">
            <circle cx="23" cy="23" r="19" fill="none" stroke={color+'11'} strokeWidth="5"/>
            <circle cx="23" cy="23" r="19" fill="none" stroke={color} strokeWidth="5" strokeDasharray="60 59" strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" from="-90 23 23" to="270 23 23" dur="8s" repeatCount="indefinite"/>
            </circle>
            <text x="23" y="27" textAnchor="middle" fontSize="9" fontWeight="800" fill={color} fontFamily="-apple-system,sans-serif">{value}</text>
          </svg>
          <span style={{fontSize:8,fontWeight:700,color:'#2a5568',letterSpacing:1,textTransform:'uppercase',textAlign:'center'}}>{label}</span>
          <span style={{fontSize:8,color:tc}}>{trend}</span>
        </div>
      ))}
    </div>
  );

  const ActiveAlertsAndVelocity = ({activeCount}:{activeCount:number}) => (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:10}}>
      <div style={{background:'#0a1520',borderRadius:12,border:'1px solid #1a3545',padding:12}}>
        <div style={{fontSize:11,fontWeight:700,color:'#fff',marginBottom:2}}>Active Alerts</div>
        <div style={{fontSize:9,color:'#2a5568',marginBottom:8}}>Unresolved findings</div>
        <div style={{display:'flex',alignItems:'baseline',gap:8,marginBottom:8}}>
          <span style={{fontSize:32,fontWeight:800,color:'#e24b4a',lineHeight:1}}>{activeCount}</span>
          <div><div style={{fontSize:11,fontWeight:700,color:'#e24b4a'}}>4.8%</div><div style={{fontSize:8,color:'#2a5568'}}>of all scans</div></div>
        </div>
        <div style={{height:5,background:'#0d1f2e',borderRadius:3,overflow:'hidden',marginBottom:4}}>
          <div style={{width:'4.8%',height:'100%',background:'#e24b4a',borderRadius:3}}/>
        </div>
        <div style={{display:'flex',justifyContent:'space-between'}}>
          <span style={{fontSize:7,color:'#1e4a5a'}}>0%</span><span style={{fontSize:7,color:'#e24b4a'}}>4.8%</span><span style={{fontSize:7,color:'#1e4a5a'}}>100%</span>
        </div>
      </div>
      <div style={{background:'#0a1520',borderRadius:12,border:'1px solid #1a3545',padding:12}}>
        <div style={{fontSize:11,fontWeight:700,color:'#fff',marginBottom:2}}>Scan Velocity</div>
        <div style={{fontSize:9,color:'#2a5568',marginBottom:6}}>Scans/day this week</div>
        <svg width="100%" height="68" viewBox="0 0 130 68">
          <g fill="#00e5c8">{[[5,40,28],[24,33,35],[43,26,42],[62,20,48],[81,16,52],[100,10,58],[119,14,54]].map(([x,y,h],i)=><rect key={i} x={x} y={y} width="14" height={h} rx="2" opacity={0.4+i*0.08}/>)}</g>
          <g fontSize="6" fill="#2a5568" fontFamily="-apple-system,sans-serif" textAnchor="middle">
            {['M','T','W','T','F','S','S'].map((d,i)=><text key={i} x={12+i*19} y="66">{d}</text>)}
          </g>
        </svg>
        <div style={{fontSize:8,color:'#00ff88',textAlign:'right',marginTop:2}}>↑ +18% vs last week</div>
      </div>
    </div>
  );

  const OperationalPie = () => (
    <div style={{background:'#0a1520',borderRadius:12,border:'1px solid #1a3545',padding:12,marginBottom:10}}>
      <div style={{fontSize:11,fontWeight:700,color:'#fff',marginBottom:2}}>Operational Breakdown</div>
      <div style={{fontSize:9,color:'#2a5568',marginBottom:10}}>Scan distribution by module</div>
      <div style={{display:'flex',alignItems:'center',gap:14}}>
        <svg width="110" height="110" viewBox="0 0 110 110" style={{flexShrink:0}}>
          {[{s:'#00e5c8',da:'80 171',off:0},{s:'#f0b429',da:'55 196',off:-80},{s:'#818cf8',da:'50 201',off:-135},{s:'#a855f7',da:'25 226',off:-185},{s:'#00b4d8',da:'25 226',off:-210},{s:'#e879f9',da:'15 236',off:-235}].map(({s,da,off},i)=>(
            <circle key={i} cx="55" cy="55" r="40" fill="none" stroke={s} strokeWidth="14" strokeDasharray={da} strokeDashoffset={off} transform="rotate(-90 55 55)">
              <animateTransform attributeName="transform" type="rotate" from="-90 55 55" to="270 55 55" dur="20s" repeatCount="indefinite"/>
            </circle>
          ))}
          <circle cx="55" cy="55" r="26" fill="#060e18"/>
          <text x="55" y="51" textAnchor="middle" fontSize="7" fill="#2a5568" fontFamily="-apple-system,sans-serif">TOTAL</text>
          <text x="55" y="63" textAnchor="middle" fontSize="11" fontWeight="800" fill="#fff" fontFamily="-apple-system,sans-serif">6 Modules</text>
        </svg>
        <div style={{flex:1,display:'flex',flexDirection:'column',gap:5}}>
          {[{c:'#00e5c8',l:'Link Scrutinizer',p:'32%',w:'32%'},{c:'#f0b429',l:'Lure Detector',p:'22%',w:'22%'},{c:'#818cf8',l:'Email Analyzer',p:'20%',w:'20%'},{c:'#a855f7',l:'Video Auditor',p:'10%',w:'10%'},{c:'#00b4d8',l:'SMS & Call Shield',p:'10%',w:'10%'},{c:'#e879f9',l:'Deepfake Audio',p:'6%',w:'6%'}].map(({c,l,p,w})=>(
            <div key={l}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <div style={{display:'flex',alignItems:'center',gap:5}}><div style={{width:8,height:8,borderRadius:2,background:c}}/><span style={{fontSize:9}}>{l}</span></div>
                <span style={{fontSize:10,fontWeight:700,color:c}}>{p}</span>
              </div>
              <div style={{height:4,background:'#0d1f2e',borderRadius:2,marginTop:2}}><div style={{width:w,height:'100%',background:c,borderRadius:2}}/></div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const SecurityPostureScore = () => (
    <div style={{background:'#0a1520',borderRadius:12,border:'1px solid #00e5c833',padding:12,marginBottom:10}}>
      <div style={{fontSize:11,fontWeight:700,color:'#fff',marginBottom:2}}>Security Posture Score</div>
      <div style={{fontSize:9,color:'#2a5568',marginBottom:10}}>Calculated from scan activity, threat history & sentry status</div>
      <div style={{display:'flex',alignItems:'center',gap:14}}>
        <svg width="100" height="100" viewBox="0 0 100 100" style={{flexShrink:0}}>
          <defs><linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stopColor="#00ff88"/><stop offset="100%" stopColor="#00e5c8"/></linearGradient></defs>
          <circle cx="50" cy="50" r="40" fill="none" stroke="#00e5c811" strokeWidth="8"/>
          <circle cx="50" cy="50" r="40" fill="none" stroke="url(#sg)" strokeWidth="8" strokeDasharray="236 15" strokeLinecap="round" transform="rotate(-90 50 50)">
            <animate attributeName="stroke-dasharray" values="0 251;236 15" dur="2s" fill="freeze"/>
          </circle>
          <circle cx="50" cy="50" r="30" fill="none" stroke="#00e5c822" strokeWidth="0.8" strokeDasharray="3 4">
            <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="-360 50 50" dur="12s" repeatCount="indefinite"/>
          </circle>
          <circle cx="50" cy="50" r="22" fill="#060e18"/>
          <text x="50" y="46" textAnchor="middle" fontSize="18" fontWeight="800" fill="#00ff88" fontFamily="-apple-system,sans-serif">94</text>
          <text x="50" y="57" textAnchor="middle" fontSize="7" fill="#00e5c8" fontFamily="-apple-system,sans-serif">/ 100</text>
        </svg>
        <div style={{flex:1,display:'flex',flexDirection:'column',gap:5}}>
          {[{l:'Sentry Coverage',v:'100%',c:'#00e5c8',w:'100%'},{l:'Threat Response',v:'96%',c:'#00ff88',w:'96%'},{l:'Zero-Knowledge',v:'100%',c:'#00e5c8',w:'100%'},{l:'Protection Streak',v:'14 days',c:'#f0b429',w:'80%'}].map(({l,v,c,w})=>(
            <div key={l}>
              <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontSize:8,color:'#2a5568'}}>{l}</span><span style={{fontSize:9,fontWeight:700,color:c}}>{v}</span></div>
              <div style={{height:4,background:'#0d1f2e',borderRadius:2,marginTop:2}}><div style={{width:w,height:'100%',background:c,borderRadius:2}}/></div>
            </div>
          ))}
          <div style={{background:'#00ff8811',border:'1px solid #00ff8833',borderRadius:6,padding:'4px 8px',marginTop:3,textAlign:'center'}}>
            <span style={{fontSize:9,fontWeight:700,color:'#00ff88'}}>EXCELLENT — Top 5% of users</span>
          </div>
        </div>
      </div>
    </div>
  );

  const PerimeterAlerts = ({alerts:alertList}:{alerts:any[]}) => {
    const [mapMode, setMapMode] = useState<'clear'|'threats'>('clear');
    if (alertList && alertList.length > 0) return (
      <div style={{background:'#0a1520',borderRadius:12,border:'1px solid #1a3545',padding:12}}>
        <div style={{fontSize:11,fontWeight:700,color:'#fff',marginBottom:2}}>Recent Perimeter Alerts</div>
        <div style={{fontSize:9,color:'#2a5568',marginBottom:8}}>Integrated real-time feed from autonomous security engine</div>
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
            <div style={{fontSize:9,color:'#2a5568'}}>Integrated real-time feed from autonomous security engine</div>
          </div>
          <div style={{display:'flex',gap:6}}>
            {[{c:'#e24b4a',l:'Critical'},{c:'#f0b429',l:'High'},{c:'#00e5c8',l:'Low'}].map(({c,l})=>(
              <div key={l} style={{display:'flex',alignItems:'center',gap:3}}><div style={{width:5,height:5,borderRadius:'50%',background:c}}/><span style={{fontSize:8,color:'#2a5568'}}>{l}</span></div>
            ))}
          </div>
        </div>
        <div style={{marginBottom:8}}>
          <button className={`soc-map-tab${mapMode==='clear'?' active':''}`} onClick={()=>setMapMode('clear')}>Perimeter Clear</button>
          <button className={`soc-map-tab${mapMode==='threats'?' active':''}`} onClick={()=>setMapMode('threats')}>With Threats</button>
        </div>
        {mapMode==='clear'?(
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
        ):(
          <svg width="100%" height="150" viewBox="0 0 320 150">
            <g stroke="#00e5c8" strokeWidth="0.4" opacity="0.07"><line x1="0" y1="37" x2="320" y2="37"/><line x1="0" y1="75" x2="320" y2="75"/><line x1="0" y1="113" x2="320" y2="113"/><line x1="64" y1="0" x2="64" y2="150"/><line x1="128" y1="0" x2="128" y2="150"/><line x1="192" y1="0" x2="192" y2="150"/><line x1="256" y1="0" x2="256" y2="150"/></g>
            <line x1="80" y1="35" x2="200" y2="65" stroke="#e24b4a" strokeWidth="0.5" opacity="0.3" strokeDasharray="3 4"/>
            <line x1="200" y1="65" x2="250" y2="110" stroke="#f0b429" strokeWidth="0.5" opacity="0.3" strokeDasharray="3 4"/>
            <line x1="80" y1="35" x2="130" y2="100" stroke="#e24b4a" strokeWidth="0.5" opacity="0.3" strokeDasharray="3 4"/>
            <line x1="40" y1="90" x2="130" y2="100" stroke="#00e5c8" strokeWidth="0.5" opacity="0.3" strokeDasharray="3 4"/>
            {[{cx:80,cy:35,c:'#e24b4a',l:'Link',d:'2s'},{cx:200,cy:65,c:'#e24b4a',l:'Email',d:'2s',b:'0.5s'}].map(({cx,cy,c,l,d,b}:any)=>(
              <g key={l}><circle cx={cx} cy={cy} r="14" fill="none" stroke={c} strokeWidth="0.5" opacity="0"><animate attributeName="r" values="8;22;8" dur={d} begin={b} repeatCount="indefinite"/><animate attributeName="opacity" values="0.6;0;0.6" dur={d} begin={b} repeatCount="indefinite"/></circle><circle cx={cx} cy={cy} r="6" fill={c+'22'} stroke={c} strokeWidth="1.5"/><circle cx={cx} cy={cy} r="3" fill={c}/><text x={cx} y={cy+17} textAnchor="middle" fontSize="7" fill={c} fontFamily="-apple-system,sans-serif">{l}</text></g>
            ))}
            {[{cx:250,cy:110,c:'#f0b429',l:'Lure'},{cx:40,cy:90,c:'#00e5c8',l:'SMS'},{cx:130,cy:100,c:'#00e5c8',l:'Media'}].map(({cx,cy,c,l}:any)=>(
              <g key={l}><circle cx={cx} cy={cy} r="10" fill="none" stroke={c} strokeWidth="0.5" opacity="0"><animate attributeName="r" values="6;15;6" dur="3s" repeatCount="indefinite"/><animate attributeName="opacity" values="0.4;0;0.4" dur="3s" repeatCount="indefinite"/></circle><circle cx={cx} cy={cy} r="5" fill={c+'22'} stroke={c} strokeWidth="1.2"/><circle cx={cx} cy={cy} r="2.5" fill={c}/><text x={cx} y={cy+17} textAnchor="middle" fontSize="7" fill={c} fontFamily="-apple-system,sans-serif">{l}</text></g>
            ))}
            <rect x="4" y="4" width="72" height="18" rx="4" fill="#e24b4a22" stroke="#e24b4a44" strokeWidth="0.5"/>
            <text x="40" y="16" textAnchor="middle" fontSize="8" fontWeight="700" fill="#e24b4a" fontFamily="-apple-system,sans-serif">⚠ 5 Active Alerts</text>
          </svg>
        )}
      </div>
    );
  };

  /* ─── Main Dashboard ─────────────────────────────────────────── */
  const FullSentryDashboard = () => {
    const [scanCount, setScanCount] = useState(247);
    useEffect(()=>{
      const t = setInterval(()=>{ if(Math.random()>.7) setScanCount(c=>c+1); },3000);
      return ()=>clearInterval(t);
    },[]);

    const stats = {
      dailyCleaned: alerts?.filter((a:any)=>a.alertLevel!=='low').length||0,
      events: alerts?.length||0,
      critical: alerts?.filter((a:any)=>a.alertLevel==='critical').length||0,
      toneMatches: alerts?.filter((a:any)=>a.moduleType==='email').length||0,
    };

    return (
      <>
        <style>{SOC_STYLES}</style>
        <ThreatLevelMeter/>
        <BackgroundSentryBar scanCount={scanCount}/>
        <ArcGaugeCards stats={stats}/>
        <RadarCard scanCount={scanCount}/>
        <div style={{fontSize:9,fontWeight:700,color:'#00e5c8',letterSpacing:2,textTransform:'uppercase',margin:'14px 0 8px',display:'flex',alignItems:'center',gap:6}}>🌍 Global Threat Map</div>
        <GlobalThreatMap/>
        <div style={{fontSize:9,fontWeight:700,color:'#00e5c8',letterSpacing:2,textTransform:'uppercase',margin:'14px 0 8px'}}>◈ Monitoring</div>
        <MonitoringRow total={stats.events||247} escalated={Math.round((stats.events||12)*0.05)} blocked={Math.round((stats.events||7)*0.03)}/>
        <ActiveAlertsAndVelocity activeCount={stats.critical||5}/>
        <OperationalPie/>
        <SecurityPostureScore/>
        <div style={{fontSize:9,fontWeight:700,color:'#00e5c8',letterSpacing:2,textTransform:'uppercase',margin:'14px 0 8px'}}>◈ Recent Perimeter Alerts</div>
        <PerimeterAlerts alerts={alerts||[]}/>
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
