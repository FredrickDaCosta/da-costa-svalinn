'use client';
// v1.1.0 — 6 modules: link lure video email sms deepfake

import { useLocalization } from '@/hooks/use-localization';

export type ScanCardState = 'idle' | 'manual' | 'sentry' | 'threat' | 'clear';

export type ScanModuleType = 'link' | 'lure' | 'video' | 'email' | 'sms' | 'deepfake';

interface ScanModuleCardProps {
  module: ScanModuleType;
  state: ScanCardState;
  onClick?: () => void;
}

const MODULE_CONFIG = {
  link: {
    color: '#00e5c8',
    colorDim: '#00e5c822',
    colorBorder: '#00e5c844',
    bgGradient: 'radial-gradient(ellipse 80% 80% at 30% 40%,#0a2535,#060b12)',
    badgeKey: 'scan_card_badge_link' as const,
    titleKey: 'scan_card_title_link' as const,
    descKey: 'scan_card_desc_link' as const,
    statKey: 'scan_card_stat_link' as const,
  },
  lure: {
    color: '#f0b429',
    colorDim: '#f0b42922',
    colorBorder: '#f0b42944',
    bgGradient: 'radial-gradient(ellipse 80% 80% at 70% 30%,#1a1000,#060b12)',
    badgeKey: 'scan_card_badge_lure' as const,
    titleKey: 'scan_card_title_lure' as const,
    descKey: 'scan_card_desc_lure' as const,
    statKey: 'scan_card_stat_lure' as const,
  },
  video: {
    color: '#a855f7',
    colorDim: '#a855f722',
    colorBorder: '#a855f744',
    bgGradient: 'radial-gradient(ellipse 80% 80% at 40% 50%,#120820,#060b12)',
    badgeKey: 'scan_card_badge_video' as const,
    titleKey: 'scan_card_title_video' as const,
    descKey: 'scan_card_desc_video' as const,
    statKey: 'scan_card_stat_video' as const,
  },
  email: {
    color: '#38bdf8',
    colorDim: '#38bdf822',
    colorBorder: '#38bdf844',
    bgGradient: 'radial-gradient(ellipse 80% 80% at 60% 60%,#081828,#060b12)',
    badgeKey: 'scan_card_badge_email' as const,
    titleKey: 'scan_card_title_email' as const,
    descKey: 'scan_card_desc_email' as const,
    statKey: 'scan_card_stat_email' as const,
  },
  sms: {
    color: '#00b4d8',
    colorDim: '#00b4d822',
    colorBorder: '#00b4d844',
    bgGradient: 'radial-gradient(ellipse 80% 80% at 50% 50%,#081828,#060b12)',
    badgeKey: 'scan_card_badge_sms' as const,
    titleKey: 'scan_card_title_sms' as const,
    descKey: 'scan_card_desc_sms' as const,
    statKey: 'scan_card_stat_sms' as const,
  },
  deepfake: {
    color: '#e879f9',
    colorDim: '#e879f922',
    colorBorder: '#e879f944',
    bgGradient: 'radial-gradient(ellipse 80% 80% at 50% 40%,#1a0828,#060b12)',
    badgeKey: 'scan_card_badge_deepfake' as const,
    titleKey: 'scan_card_title_deepfake' as const,
    descKey: 'scan_card_desc_deepfake' as const,
    statKey: 'scan_card_stat_deepfake' as const,
  },
};

const STATE_CONFIG = {
  idle: {
    cardBorder: '#1a3545',
    cardBg: '#0a1520',
    cardShadow: 'none',
    pillBg: '#1e3a4a',
    pillColor: '#2a5568',
    pillBorder: '#1e3a4a',
    pillAnim: 'none',
    dotColor: '#1e3a4a',
    dotShadow: 'none',
    dotAnim: 'none',
    showArc: false,
    showSentry: false,
    showThreat: false,
    showClear: false,
    statKey: 'scan_state_idle' as const,
    pillKey: 'scan_pill_idle' as const,
  },
  manual: {
    cardBorder: '#00e5c8',
    cardBg: '#0a1a20',
    cardShadow: '0 0 16px #00e5c822, 0 0 4px #00e5c844',
    pillBg: '#00e5c822',
    pillColor: '#00e5c8',
    pillBorder: '#00e5c8',
    pillAnim: 'dcPillPulse 1s ease-in-out infinite',
    dotColor: '#00e5c8',
    dotShadow: '0 0 6px #00e5c8, 0 0 12px #00e5c866',
    dotAnim: 'dcDotGlow 1s ease-in-out infinite',
    showArc: true,
    showSentry: false,
    showThreat: false,
    showClear: false,
    statKey: 'scan_state_manual' as const,
    pillKey: 'scan_pill_manual' as const,
  },
  sentry: {
    cardBorder: '#f0b429',
    cardBg: '#12100a',
    cardShadow: '0 0 16px #f0b42922, 0 0 4px #f0b42944',
    pillBg: '#f0b42922',
    pillColor: '#f0b429',
    pillBorder: '#f0b429',
    pillAnim: 'dcPillPulse 2s ease-in-out infinite',
    dotColor: '#f0b429',
    dotShadow: '0 0 6px #f0b429, 0 0 12px #f0b42966',
    dotAnim: 'dcDotGlow 2s ease-in-out infinite',
    showArc: true,
    showSentry: true,
    showThreat: false,
    showClear: false,
    statKey: 'scan_state_sentry' as const,
    pillKey: 'scan_pill_sentry' as const,
  },
  threat: {
    cardBorder: '#e24b4a',
    cardBg: '#140808',
    cardShadow: '0 0 20px #e24b4a33, 0 0 6px #e24b4a66',
    pillBg: '#e24b4a33',
    pillColor: '#e24b4a',
    pillBorder: '#e24b4a',
    pillAnim: 'dcThreatFlash 0.6s ease-in-out infinite',
    dotColor: '#e24b4a',
    dotShadow: '0 0 8px #e24b4a, 0 0 18px #e24b4a88',
    dotAnim: 'dcDotGlow 0.5s ease-in-out infinite',
    showArc: false,
    showSentry: false,
    showThreat: true,
    showClear: false,
    statKey: 'scan_state_threat' as const,
    pillKey: 'scan_pill_threat' as const,
  },
  clear: {
    cardBorder: '#00ff88',
    cardBg: '#081408',
    cardShadow: '0 0 16px #00ff8822',
    pillBg: '#00ff8822',
    pillColor: '#00ff88',
    pillBorder: '#00ff88',
    pillAnim: 'none',
    dotColor: '#00ff88',
    dotShadow: '0 0 6px #00ff88, 0 0 12px #00ff8866',
    dotAnim: 'none',
    showArc: false,
    showSentry: false,
    showThreat: false,
    showClear: true,
    statKey: 'scan_state_clear' as const,
    pillKey: 'scan_pill_clear' as const,
  },
};

function LinkArt({ color, scanSpeed }: { color: string; scanSpeed: string }) {
  return (
    <svg width="100%" height="118" viewBox="0 0 180 118" fill="none" style={{ position: 'absolute', top: 0, left: 0 }}>
      <g opacity="0.07" stroke={color} strokeWidth="0.6">
        <polygon points="20,5 38,5 47,20 38,35 20,35 11,20" fill="none"/>
        <polygon points="56,5 74,5 83,20 74,35 56,35 47,20" fill="none"/>
        <polygon points="92,5 110,5 119,20 110,35 92,35 83,20" fill="none"/>
        <polygon points="128,5 146,5 155,20 146,35 128,35 119,20" fill="none"/>
        <polygon points="38,35 56,35 65,50 56,65 38,65 29,50" fill="none"/>
        <polygon points="74,35 92,35 101,50 92,65 74,65 65,50" fill="none"/>
        <polygon points="110,35 128,35 137,50 128,65 110,65 101,50" fill="none"/>
      </g>
      <g style={{ animation: 'dcFloatY 3s ease-in-out infinite', transformOrigin: '36px 60px' }}>
        <rect x="18" y="49" width="36" height="22" rx="11" fill="none" stroke={color} strokeWidth="2.2"/>
        <rect x="22" y="53" width="28" height="14" rx="7" fill="#060b12"/>
        <rect x="18" y="49" width="36" height="6" rx="3" fill={`${color}22`}/>
      </g>
      <line x1="54" y1="60" x2="106" y2="60" stroke={color} strokeWidth="1.5" strokeDasharray="4 3" opacity="0.6">
        <animate attributeName="stroke-dashoffset" from="0" to="-14" dur="0.8s" repeatCount="indefinite"/>
      </line>
      <g style={{ animation: 'dcFloatY 3s ease-in-out infinite 0.4s', transformOrigin: '130px 60px' }}>
        <rect x="112" y="49" width="36" height="22" rx="11" fill="none" stroke={color} strokeWidth="2.2"/>
        <rect x="116" y="53" width="28" height="14" rx="7" fill="#060b12"/>
        <rect x="112" y="49" width="36" height="6" rx="3" fill={`${color}22`}/>
      </g>
      <g style={{ animation: 'dcFloatY2 2.5s ease-in-out infinite 0.8s', transformOrigin: '113px 59px' }}>
        <circle cx="113" cy="59" r="17" fill="#0d2535" stroke={color} strokeWidth="2"/>
        <circle cx="113" cy="59" r="11" fill="#091a28" stroke={`${color}44`} strokeWidth="0.7"/>
        <line x1="124" y1="72" x2="134" y2="82" stroke={color} strokeWidth="3" strokeLinecap="round"/>
        <path d="M110 53 L105 55 L105 59 C105 62 107 64 110 65 C113 64 115 62 115 59 L115 55 Z" fill={`${color}22`} stroke={color} strokeWidth="0.7"/>
        <line x1="104" y1="59" x2="122" y2="59" stroke={color} strokeWidth="1" opacity="0.8">
          <animate attributeName="y1" values="52;66;52" dur={scanSpeed} repeatCount="indefinite"/>
          <animate attributeName="y2" values="52;66;52" dur={scanSpeed} repeatCount="indefinite"/>
        </line>
      </g>
      <circle cx="113" cy="59" r="24" fill="none" stroke={color} strokeWidth="0.5" strokeDasharray="3 5" opacity="0.25">
        <animateTransform attributeName="transform" type="rotate" from="0 113 59" to="360 113 59" dur="8s" repeatCount="indefinite"/>
      </circle>
      <g opacity="0.6">
        <circle cx="25" cy="98" r="2.5" fill={color}><animate attributeName="opacity" values="0.3;1;0.3" dur="1.8s" repeatCount="indefinite"/></circle>
        <circle cx="55" cy="93" r="2" fill={color}><animate attributeName="opacity" values="0.3;1;0.3" dur="2.2s" begin="0.3s" repeatCount="indefinite"/></circle>
        <circle cx="80" cy="98" r="2.5" fill="#f0b429"><animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" begin="0.6s" repeatCount="indefinite"/></circle>
      </g>
    </svg>
  );
}

function LureArt({ color, scanSpeed }: { color: string; scanSpeed: string }) {
  return (
    <svg width="100%" height="118" viewBox="0 0 180 118" fill="none" style={{ position: 'absolute', top: 0, left: 0 }}>
      <g opacity="0.07" stroke={color} strokeWidth="0.5">
        <line x1="0" y1="30" x2="180" y2="30"/><line x1="0" y1="60" x2="180" y2="60"/>
        <line x1="0" y1="90" x2="180" y2="90"/><line x1="45" y1="0" x2="45" y2="118"/>
        <line x1="90" y1="0" x2="90" y2="118"/><line x1="135" y1="0" x2="135" y2="118"/>
      </g>
      <g fill={color} opacity="0.22">
        <circle cx="45" cy="30" r="1.8"/><circle cx="90" cy="30" r="1.8"/><circle cx="135" cy="30" r="1.8"/>
        <circle cx="45" cy="60" r="1.8"/><circle cx="135" cy="60" r="1.8"/>
        <circle cx="45" cy="90" r="1.8"/><circle cx="90" cy="90" r="1.8"/><circle cx="135" cy="90" r="1.8"/>
      </g>
      <g style={{ animation: 'dcHookSwing 3s ease-in-out infinite', transformOrigin: '75px 8px' }}>
        <line x1="75" y1="0" x2="75" y2="12" stroke={color} strokeWidth="1.2" strokeDasharray="2 2" opacity="0.6"/>
        <path d="M75 12 L75 68 Q75 87 56 87 Q37 87 37 70 Q37 58 49 58" fill="none" stroke={color} strokeWidth="3.5" strokeLinecap="round"/>
        <path d="M77 14 L77 69 Q77 88 58 88" fill="none" stroke={color} strokeWidth="0.8" opacity="0.2" strokeLinecap="round"/>
        <path d="M49 58 L42 50" stroke={color} strokeWidth="3" strokeLinecap="round"/>
        <path d="M42 50 L48 52" stroke={color} strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="75" cy="10" r="6" fill="none" stroke={color} strokeWidth="2"/>
      </g>
      <circle cx="49" cy="72" r="5" fill={color} opacity="0.2">
        <animate attributeName="r" values="4;7;4" dur={scanSpeed} repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.2;0.5;0.2" dur={scanSpeed} repeatCount="indefinite"/>
      </circle>
      <g style={{ animation: 'dcScaleBreath 2.5s ease-in-out infinite', transformOrigin: '130px 57px' }}>
        <polygon points="130,30 158,78 102,78" fill={`${color}11`} stroke={color} strokeWidth="2" strokeLinejoin="round"/>
        <line x1="130" y1="44" x2="130" y2="62" stroke={color} strokeWidth="3" strokeLinecap="round"/>
        <circle cx="130" cy="69" r="3" fill={color}/>
      </g>
      <circle cx="130" cy="57" r="30" fill="none" stroke={color} strokeWidth="0.5" opacity="0.12">
        <animate attributeName="r" values="26;36;26" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.25;0;0.25" dur="2s" repeatCount="indefinite"/>
      </circle>
      <g fill={color}>
        <circle cx="25" cy="80" r="1.5"><animate attributeName="cy" values="100;20;100" dur="3s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0.7;0" dur="3s" repeatCount="indefinite"/></circle>
        <circle cx="165" cy="80" r="1"><animate attributeName="cy" values="110;30;110" dur="3.5s" begin="0.5s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0.5;0" dur="3.5s" begin="0.5s" repeatCount="indefinite"/></circle>
      </g>
    </svg>
  );
}

function VideoArt({ color, scanSpeed }: { color: string; scanSpeed: string }) {
  return (
    <svg width="100%" height="118" viewBox="0 0 180 118" fill="none" style={{ position: 'absolute', top: 0, left: 0 }}>
      <g fill={color} opacity="0.06">
        {[15,35,55,75,95,115,135,155,175].map(x => [10,30,100].map(y => (
          <circle key={`${x}-${y}`} cx={x} cy={y} r="1.4"/>
        )))}
      </g>
      <g style={{ animation: 'dcFloatY 3.5s ease-in-out infinite' }}>
        <rect x="22" y="18" width="92" height="65" rx="7" fill="#1a0835" stroke={color} strokeWidth="1.8"/>
        <rect x="22" y="18" width="92" height="10" rx="4" fill={`${color}11`}/>
        <rect x="26" y="22" width="84" height="57" rx="4" fill="#0d0520"/>
        {[35,48,61,74].map(y => <line key={y} x1="26" y1={y} x2="110" y2={y} stroke={color} strokeWidth="0.4" opacity="0.3"/>)}
        <line x1="26" y1="50" x2="110" y2="50" stroke={color} strokeWidth="1.2" opacity="0.7">
          <animate attributeName="y1" values="23;79;23" dur={scanSpeed} repeatCount="indefinite"/>
          <animate attributeName="y2" values="23;79;23" dur={scanSpeed} repeatCount="indefinite"/>
        </line>
        <circle cx="68" cy="50" r="18" fill={`${color}22`} stroke={color} strokeWidth="1.8"/>
        <circle cx="68" cy="50" r="12" fill={`${color}11`}/>
        <polygon points="63,42 63,58 79,50" fill={color}/>
        <rect x="97" y="21" width="13" height="11" rx="2" fill={color} opacity="0.9"/>
        <path d="M100 21 L100 18 C100 15 110 15 110 18 L110 21" stroke={color} strokeWidth="1.5" fill="none"/>
        <circle cx="103.5" cy="26" r="1.5" fill="#060b12"/>
      </g>
      <g>
        {[
          { x: 124, dur: '1.2s', del: '0s', h1: 20, h2: 45, y1: 63, y2: 38, op: 0.6 },
          { x: 138, dur: '1.8s', del: '0.2s', h1: 35, h2: 55, y1: 52, y2: 32, op: 0.4 },
          { x: 152, dur: '1.4s', del: '0.4s', h1: 40, h2: 60, y1: 43, y2: 23, op: 0.7 },
        ].map(b => (
          <g key={b.x}>
            <rect x={b.x} y="18" width="10" height="65" rx="3" fill="#1a0835" stroke={color} strokeWidth="0.5"/>
            <rect x={b.x} y={b.y1} width="10" height={b.h1} rx="2" fill={color} opacity={b.op}>
              <animate attributeName="height" values={`${b.h1};${b.h2};${b.h1}`} dur={b.dur} begin={b.del} repeatCount="indefinite"/>
              <animate attributeName="y" values={`${b.y1};${b.y2};${b.y1}`} dur={b.dur} begin={b.del} repeatCount="indefinite"/>
            </rect>
          </g>
        ))}
      </g>
    </svg>
  );
}

function EmailArt({ color, scanSpeed }: { color: string; scanSpeed: string }) {
  return (
    <svg width="100%" height="118" viewBox="0 0 180 118" fill="none" style={{ position: 'absolute', top: 0, left: 0 }}>
      <g fill={color} opacity="0.05" fontFamily="monospace" fontSize="8">
        <text x="5" y="18">01</text><text x="5" y="30">10</text><text x="5" y="42">01</text>
        <text x="155" y="18">00</text><text x="155" y="30">11</text><text x="155" y="42">10</text>
      </g>
      <g style={{ animation: 'dcFloatY 3s ease-in-out infinite 0.3s' }}>
        <rect x="22" y="20" width="100" height="68" rx="7" fill={`${color}11`}/>
        <rect x="20" y="18" width="100" height="68" rx="7" fill="#0d2035" stroke={color} strokeWidth="1.8"/>
        <rect x="20" y="18" width="100" height="10" rx="4" fill={`${color}11`}/>
        <path d="M20 18 L70 52 L120 18" fill="none" stroke={color} strokeWidth="1.8" strokeLinejoin="round"/>
        <line x1="20" y1="86" x2="52" y2="58" stroke={color} strokeWidth="0.7" opacity="0.3"/>
        <line x1="120" y1="86" x2="88" y2="58" stroke={color} strokeWidth="0.7" opacity="0.3"/>
        <circle cx="44" cy="64" r="5" fill="#e24b4a" opacity="0.85"><animate attributeName="opacity" values="0.5;1;0.5" dur="1.3s" repeatCount="indefinite"/></circle>
        <circle cx="60" cy="58" r="4" fill="#f0b429" opacity="0.8"><animate attributeName="opacity" values="0.4;1;0.4" dur="1.8s" begin="0.2s" repeatCount="indefinite"/></circle>
        <circle cx="76" cy="64" r="5" fill="#00e5c8" opacity="0.7"><animate attributeName="opacity" values="0.4;1;0.4" dur="1.5s" begin="0.4s" repeatCount="indefinite"/></circle>
        <line x1="44" y1="64" x2="60" y2="58" stroke={color} strokeWidth="0.5" opacity="0.25"/>
        <line x1="60" y1="58" x2="76" y2="64" stroke={color} strokeWidth="0.5" opacity="0.25"/>
      </g>
      <g style={{ animation: 'dcFloatY2 2.8s ease-in-out infinite 0.6s' }}>
        <circle cx="136" cy="70" r="21" fill={`${color}11`}/>
        <circle cx="134" cy="68" r="20" fill="#0d2035" stroke={color} strokeWidth="2"/>
        <circle cx="134" cy="68" r="13" fill="#081828" stroke={`${color}44`} strokeWidth="0.7"/>
        <line x1="149" y1="81" x2="159" y2="91" stroke={color} strokeWidth="3.5" strokeLinecap="round"/>
        <line x1="126" y1="64" x2="142" y2="64" stroke={color} strokeWidth="0.8" opacity="0.5"/>
        <line x1="124" y1="68" x2="144" y2="68" stroke={color} strokeWidth="1" opacity="0.8"/>
        <line x1="126" y1="72" x2="142" y2="72" stroke={color} strokeWidth="0.8" opacity="0.5"/>
        <line x1="134" y1="56" x2="134" y2="80" stroke={color} strokeWidth="0.6" opacity="0.35">
          <animate attributeName="x1" values={`123;145;123`} dur={scanSpeed} repeatCount="indefinite"/>
          <animate attributeName="x2" values={`123;145;123`} dur={scanSpeed} repeatCount="indefinite"/>
        </line>
      </g>
      <circle cx="134" cy="68" r="27" fill="none" stroke={color} strokeWidth="0.4" strokeDasharray="3 6" opacity="0.18">
        <animateTransform attributeName="transform" type="rotate" from="0 134 68" to="-360 134 68" dur="10s" repeatCount="indefinite"/>
      </circle>
      <g fill={color}>
        <circle cx="15" cy="90" r="1.5"><animate attributeName="cy" values="108;22;108" dur="4s" repeatCount="indefinite"/><animate attributeName="opacity" values="0;0.6;0" dur="4s" repeatCount="indefinite"/></circle>
      </g>
    </svg>
  );
}


function DeepfakeArt({ color, scanSpeed }: { color: string; scanSpeed: string }) {
  return (
    <svg width="100%" height="118" viewBox="0 0 180 118" fill="none" style={{ position: 'absolute', top: 0, left: 0 }}>
      <g opacity="0.06" stroke={color} strokeWidth="0.5">
        <line x1="0" y1="30" x2="180" y2="30"/><line x1="0" y1="60" x2="180" y2="60"/>
        <line x1="0" y1="90" x2="180" y2="90"/><line x1="45" y1="0" x2="45" y2="118"/>
        <line x1="90" y1="0" x2="90" y2="118"/><line x1="135" y1="0" x2="135" y2="118"/>
      </g>
      {/* Microphone */}
      <g style={{ animation: 'dcFloatY 3s ease-in-out infinite' }}>
        <rect x="68" y="8" width="24" height="44" rx="12" fill="none" stroke={color} strokeWidth="2"/>
        <rect x="72" y="12" width="16" height="36" rx="8" fill={`${color}11`}/>
        <path d="M56 38 Q56 66 90 66 Q124 66 124 38" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="90" y1="66" x2="90" y2="78" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
        <line x1="78" y1="78" x2="102" y2="78" stroke={color} strokeWidth="1.8" strokeLinecap="round"/>
      </g>
      {/* Audio waveform bars — animated */}
      <g>
        {[
          {x:20, h1:10, h2:25, d:'1.1s', del:'0s'},
          {x:30, h1:18, h2:40, d:'0.9s', del:'0.1s'},
          {x:40, h1:8,  h2:20, d:'1.3s', del:'0.2s'},
          {x:130, h1:14, h2:35, d:'1.0s', del:'0.15s'},
          {x:140, h1:20, h2:45, d:'0.85s', del:'0.05s'},
          {x:150, h1:10, h2:28, d:'1.2s', del:'0.25s'},
          {x:160, h1:16, h2:38, d:'0.95s', del:'0.1s'},
        ].map(({x, h1, h2, d, del}, i) => (
          <g key={i}>
            <rect x={x} y={59 - h1/2} width="6" height={h1} rx="3" fill={color} opacity="0.5">
              <animate attributeName="height" values={`${h1};${h2};${h1}`} dur={d} begin={del} repeatCount="indefinite"/>
              <animate attributeName="y" values={`${59-h1/2};${59-h2/2};${59-h1/2}`} dur={d} begin={del} repeatCount="indefinite"/>
            </rect>
          </g>
        ))}
      </g>
      {/* Warning indicator — scanning line across face */}
      <line x1="20" y1="59" x2="160" y2="59" stroke={color} strokeWidth="0.8" opacity="0.3">
        <animate attributeName="y1" values="20;98;20" dur={scanSpeed} repeatCount="indefinite"/>
        <animate attributeName="y2" values="20;98;20" dur={scanSpeed} repeatCount="indefinite"/>
      </line>
      {/* Alert nodes */}
      <circle cx="30" cy="95" r="3" fill={color} opacity="0.6">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1.2s" repeatCount="indefinite"/>
      </circle>
      <circle cx="150" cy="95" r="3" fill={color} opacity="0.6">
        <animate attributeName="opacity" values="0.3;1;0.3" dur="1.6s" begin="0.4s" repeatCount="indefinite"/>
      </circle>
      <circle cx="90" cy="95" r="2.5" fill="#f0b429" opacity="0.7">
        <animate attributeName="opacity" values="0.4;1;0.4" dur="0.9s" begin="0.2s" repeatCount="indefinite"/>
      </circle>
    </svg>
  );
}


function SmsArt({ color, scanSpeed }: { color: string; scanSpeed: string }) {
  return (
    <svg width="100%" height="118" viewBox="0 0 180 118" fill="none" style={{ position: 'absolute', top: 0, left: 0 }}>
      <g opacity="0.07" stroke={color} strokeWidth="0.5">
        <line x1="0" y1="30" x2="180" y2="30"/><line x1="0" y1="60" x2="180" y2="60"/>
        <line x1="0" y1="90" x2="180" y2="90"/><line x1="45" y1="0" x2="45" y2="118"/>
        <line x1="90" y1="0" x2="90" y2="118"/><line x1="135" y1="0" x2="135" y2="118"/>
      </g>
      {/* Phone handset */}
      <g style={{ animation: 'dcFloatY 3s ease-in-out infinite' }}>
        <rect x="55" y="10" width="44" height="78" rx="8" fill="#081828" stroke={color} strokeWidth="2"/>
        <rect x="60" y="18" width="34" height="48" rx="3" fill="#060e18"/>
        <circle cx="77" cy="73" r="4" fill="none" stroke={color} strokeWidth="1.5" opacity="0.7"/>
        {/* Screen lines — like SMS text */}
        <rect x="64" y="22" width="26" height="3" rx="1.5" fill={color} opacity="0.6"/>
        <rect x="64" y="29" width="20" height="3" rx="1.5" fill={color} opacity="0.4"/>
        <rect x="64" y="36" width="24" height="3" rx="1.5" fill={color} opacity="0.5"/>
        {/* Scan line */}
        <line x1="60" y1="40" x2="94" y2="40" stroke={color} strokeWidth="1" opacity="0.8">
          <animate attributeName="y1" values="18;66;18" dur={scanSpeed} repeatCount="indefinite"/>
          <animate attributeName="y2" values="18;66;18" dur={scanSpeed} repeatCount="indefinite"/>
        </line>
      </g>
      {/* Shield overlay */}
      <g style={{ animation: 'dcFloatY2 2.5s ease-in-out infinite 0.5s', transformOrigin: '130px 55px' }}>
        <circle cx="130" cy="55" r="22" fill={`${color}11`}/>
        <circle cx="130" cy="55" r="18" fill="#081828" stroke={color} strokeWidth="1.8"/>
        <path d="M130 42L121 46L121 54C121 61 125 66 130 68C135 66 139 61 139 54L139 46Z" fill={`${color}22`} stroke={color} strokeWidth="1.5"/>
        <path d="M126 54L129 57L134 51" stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
      </g>
      <circle cx="130" cy="55" r="26" fill="none" stroke={color} strokeWidth="0.5" strokeDasharray="3 5" opacity="0.2">
        <animateTransform attributeName="transform" type="rotate" from="0 130 55" to="360 130 55" dur="8s" repeatCount="indefinite"/>
      </circle>
      {/* Signal waves */}
      <path d="M105 42 Q112 55 105 68" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" opacity="0.4">
        <animate attributeName="opacity" values="0.2;0.7;0.2" dur="1.5s" repeatCount="indefinite"/>
      </path>
      <path d="M109 38 Q118 55 109 72" fill="none" stroke={color} strokeWidth="1.2" strokeLinecap="round" opacity="0.25">
        <animate attributeName="opacity" values="0.1;0.5;0.1" dur="1.8s" begin="0.3s" repeatCount="indefinite"/>
      </path>
      {/* Floating dots */}
      <g fill={color}>
        <circle cx="20" cy="90" r="2"><animate attributeName="opacity" values="0.3;1;0.3" dur="2s" repeatCount="indefinite"/></circle>
        <circle cx="35" cy="80" r="1.5"><animate attributeName="opacity" values="0.3;1;0.3" dur="1.5s" begin="0.4s" repeatCount="indefinite"/></circle>
        <circle cx="165" cy="95" r="1.5"><animate attributeName="opacity" values="0.3;1;0.3" dur="2.2s" begin="0.7s" repeatCount="indefinite"/></circle>
      </g>
    </svg>
  );
}

export function ScanModuleCard({ module, state, onClick }: ScanModuleCardProps) {
  const { t } = useLocalization();
  const cfg = MODULE_CONFIG[module];
  const st = STATE_CONFIG[state];
  const scanSpeed = state === 'manual' ? '0.8s' : '2s';
  const arcColor = state === 'sentry' ? '#f0b429' : cfg.color;

  const artMap = {
    link: <LinkArt color={cfg.color} scanSpeed={scanSpeed} />,
    lure: <LureArt color={cfg.color} scanSpeed={scanSpeed} />,
    video: <VideoArt color={cfg.color} scanSpeed={scanSpeed} />,
    email: <EmailArt color={cfg.color} scanSpeed={scanSpeed} />,
    sms: <SmsArt color={cfg.color} scanSpeed={scanSpeed} />,
    deepfake: <DeepfakeArt color={cfg.color} scanSpeed={scanSpeed} />,
  };

  return (
    <>
      <style>{`
        @keyframes dcFloatY{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
        @keyframes dcFloatY2{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
        @keyframes dcHookSwing{0%,100%{transform:rotate(-7deg)}50%{transform:rotate(7deg)}}
        @keyframes dcScaleBreath{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
        @keyframes dcArcSpin{from{stroke-dashoffset:0}to{stroke-dashoffset:-120}}
        @keyframes dcPillPulse{0%,100%{opacity:.7}50%{opacity:1}}
        @keyframes dcThreatFlash{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes dcDotGlow{0%,100%{transform:scale(1)}50%{transform:scale(1.5)}}
        @keyframes dcThreatOverlay{0%,100%{opacity:0}50%{opacity:1}}
      `}</style>

      <div
        onClick={onClick}
        style={{
          borderRadius: '16px',
          border: `1px solid ${st.cardBorder}`,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          background: st.cardBg,
          boxShadow: st.cardShadow,
          cursor: onClick ? 'pointer' : 'default',
          transition: 'transform 0.15s ease, box-shadow 0.3s ease, border-color 0.3s ease',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'scale(1.02) rotateX(2deg)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; }}
      >
        {/* Rotating arc ring */}
        {st.showArc && (
          <div style={{ position: 'absolute', inset: '-3px', borderRadius: '19px', pointerEvents: 'none', zIndex: 5 }}>
            <svg width="100%" height="100%" style={{ position: 'absolute', top: 0, left: 0 }} viewBox="0 0 200 260" fill="none">
              <rect x="2" y="2" width="196" height="256" rx="17" fill="none" stroke={arcColor} strokeWidth="2.5" strokeDasharray="28 10" style={{ animation: 'dcArcSpin 1.5s linear infinite' }}/>
            </svg>
          </div>
        )}

        {/* Threat overlay flash */}
        {st.showThreat && (
          <div style={{ position: 'absolute', inset: 0, background: '#e24b4a08', pointerEvents: 'none', zIndex: 4, animation: 'dcThreatOverlay 0.8s ease-in-out infinite' }}/>
        )}

        {/* Clear overlay */}
        {st.showClear && (
          <div style={{ position: 'absolute', inset: 0, background: '#00ff8805', pointerEvents: 'none', zIndex: 4 }}/>
        )}

        {/* Sentry badge */}
        {st.showSentry && (
          <div style={{
            position: 'absolute', top: 8, right: 8, zIndex: 20,
            padding: '2px 7px', borderRadius: '10px',
            background: '#f0b42922', color: '#f0b429', border: '1px solid #f0b42966',
            fontSize: '6.5px', fontWeight: 800, letterSpacing: '1px', textTransform: 'uppercase',
            animation: 'dcPillPulse 2s ease-in-out infinite',
          }}>
            {t('scan_badge_sentry')}
          </div>
        )}

        {/* Art area */}
        <div style={{ width: '100%', height: '118px', position: 'relative', overflow: 'hidden', background: cfg.bgGradient, flexShrink: 0 }}>
          {(artMap as any)[module]}

          {/* Status pill */}
          <div style={{
            position: 'absolute', bottom: 10, left: '50%', transform: 'translateX(-50%)',
            padding: '2px 10px', borderRadius: '20px',
            background: st.pillBg, color: st.pillColor, border: `1px solid ${st.pillBorder}`,
            fontSize: '7px', fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase',
            whiteSpace: 'nowrap', zIndex: 10,
            animation: st.pillAnim,
            transition: 'all 0.3s',
          }}>
            {t(st.pillKey)}
          </div>
        </div>

        {/* Card body */}
        <div style={{ padding: '9px 12px 12px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '4px',
            padding: '2px 8px', borderRadius: '20px', width: 'fit-content',
            background: cfg.colorDim, border: `1px solid ${cfg.colorBorder}`,
            color: cfg.color, fontSize: '7px', fontWeight: 700,
            letterSpacing: '1px', textTransform: 'uppercase', marginBottom: '3px',
          }}>
            {t(cfg.badgeKey)}
          </div>
          <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#fff', letterSpacing: '0.2px' }}>
            {t(cfg.titleKey)}
          </div>
          <div style={{ fontSize: '8.5px', color: '#3a6878', lineHeight: 1.5 }}>
            {t(cfg.descKey)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '5px', paddingTop: '5px', borderTop: '1px solid #1a3545' }}>
            <span style={{ fontSize: '7px', color: '#1e4a5a', letterSpacing: '1px', textTransform: 'uppercase' }}>
              {t(st.statKey)}
            </span>
            <div style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: st.dotColor, boxShadow: st.dotShadow,
              flexShrink: 0, transition: 'all 0.3s',
              animation: st.dotAnim,
            }}/>
          </div>
        </div>
      </div>
    </>
  );
}
