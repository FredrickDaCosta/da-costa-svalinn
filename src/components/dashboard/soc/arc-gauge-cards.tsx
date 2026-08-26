'use client';

interface ArcGaugeCardsProps {
  stats: {
    dailyCleaned: number;
    events: number;
    critical: number;
    toneMatches: number;
  };
}

const GAUGES = [
  {
    label: 'Daily Cleaned',
    key: 'dailyCleaned' as const,
    desc: 'Threats neutralized',
    color: '#00e5c8',
    icon: <path d="M40 25L30 30L30 39C30 46 34 51 40 53C46 51 50 46 50 39L50 30Z" fill="none" stroke="#00e5c8" strokeWidth="1.5" opacity="0.7" />,
    dur: '8s',
    da: '55 159',
    from: '-90 40 40',
    to: '270 40 40',
  },
  {
    label: 'Sentry Events',
    key: 'events' as const,
    desc: 'Logs audited',
    color: '#f0b429',
    icon: <polyline points="25,45 30,34 34,49 40,27 46,41 50,35 55,45" fill="none" stroke="#f0b429" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />,
    dur: '10s',
    da: '40 174',
    from: '270 40 40',
    to: '-90 40 40',
  },
  {
    label: 'Critical Blocks',
    key: 'critical' as const,
    desc: 'High-risk exploits',
    color: '#e24b4a',
    icon: (
      <>
        <polygon points="40,27 29,47 51,47" fill="none" stroke="#e24b4a" strokeWidth="1.8" strokeLinejoin="round" opacity="0.8" />
        <line x1="40" y1="33" x2="40" y2="42" stroke="#e24b4a" strokeWidth="2" strokeLinecap="round" />
        <circle cx="40" cy="45" r="1.5" fill="#e24b4a" />
      </>
    ),
    dur: '6s',
    da: '28 186',
    from: '-90 40 40',
    to: '270 40 40',
  },
  {
    label: 'Tone Matches',
    key: 'toneMatches' as const,
    desc: 'Linguistic checks',
    color: '#818cf8',
    icon: (
      <>
        <rect x="26" y="31" width="28" height="18" rx="3" fill="none" stroke="#818cf8" strokeWidth="1.5" opacity="0.8" />
        <path d="M26 31L40 42L54 31" fill="none" stroke="#818cf8" strokeWidth="1.5" strokeLinejoin="round" opacity="0.8" />
      </>
    ),
    dur: '11s',
    da: '45 169',
    from: '90 40 40',
    to: '450 40 40',
  },
];

export function ArcGaugeCards({ stats }: ArcGaugeCardsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 mb-2.5">
      {GAUGES.map(({ label, key, desc, color, icon, dur, da, from, to }) => (
        <div
          key={label}
          className="bg-[#0a1520] rounded-xl border border-[#1a3545] py-2.5 px-1.5 flex flex-col items-center gap-0.5"
        >
          <svg width="80" height="80" viewBox="0 0 80 80">
            <circle cx="40" cy="40" r="34" fill="none" stroke={color + '11'} strokeWidth="6" />
            <circle cx="40" cy="40" r="34" fill="none" stroke={color} strokeWidth="6" strokeDasharray={da} strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" from={from} to={to} dur={dur} repeatCount="indefinite" />
            </circle>
            <circle cx="40" cy="40" r="26" fill="none" stroke={color + '22'} strokeWidth="1" strokeDasharray="3 4">
              <animateTransform attributeName="transform" type="rotate" from="0 40 40" to="-360 40 40" dur="12s" repeatCount="indefinite" />
            </circle>
            {icon}
            <circle cx="40" cy="5" r="2" fill={color} opacity="0.6">
              <animate attributeName="opacity" values="0.4;1;0.4" dur="2s" repeatCount="indefinite" />
            </circle>
          </svg>
          <span className="text-[8px] font-bold tracking-wider uppercase text-[#2a5568] text-center">{label}</span>
          <span className="text-2xl font-extrabold leading-none" style={{ color }}>{stats[key]}</span>
          <span className="text-[7px] text-[#1e4a5a] text-center">{desc}</span>
        </div>
      ))}
    </div>
  );
}
