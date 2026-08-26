'use client';

import { THREAT_LEVELS, type SocLevel, type LevelCounts } from './types';

interface ThreatLevelMeterProps {
  level: SocLevel;
  streak: number;
  counts: LevelCounts;
}

export function ThreatLevelMeter({ level, streak, counts }: ThreatLevelMeterProps) {
  const tl = THREAT_LEVELS[level];
  return (
    <div className="rounded-xl border border-primary/20 bg-[#0a1520] p-3.5 mb-2.5">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-bold tracking-[2px] uppercase text-[#2a5568]">⬡ Perimeter Threat Level</span>
        <div className="flex items-center gap-2">
          <span
            className="px-2.5 py-[3px] rounded-full text-[9px] font-extrabold tracking-wider uppercase transition-all"
            style={{ background: tl.bc, color: tl.btc, border: tl.bbd }}
          >
            {tl.badge}
          </span>
          <div
            className="text-center bg-[#060e18] border border-primary/20 rounded-lg px-2 py-1"
            style={{ animation: 'streakGlow 3s ease-in-out infinite' }}
          >
            <div className="text-[7px] text-[#2a5568] tracking-wider">STREAK</div>
            <div className="text-base font-extrabold text-primary leading-none">{streak}</div>
            <div className="text-[7px] text-[#2a5568]">days clear</div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-[#0d1f2e] rounded overflow-hidden mb-1.5 relative">
        <div
          className="h-full rounded relative"
          style={{
            width: tl.pct,
            background: tl.bg,
            transition: 'width 0.8s ease, background 0.5s ease',
          }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(90deg,transparent,rgba(255,255,255,.3),transparent)',
              animation: 'shine 2s ease-in-out infinite',
            }}
          />
        </div>
      </div>

      {/* Level labels */}
      <div className="flex justify-between mb-2">
        {['SECURE', 'ELEVATED', 'HIGH', 'CRITICAL'].map((z) => (
          <span key={z} className="text-[7px] text-[#1e4a5a]">{z}</span>
        ))}
      </div>

      {/* Count cards */}
      <div className="flex gap-1.5">
        {([
          { label: 'Critical', color: '#e24b4a', value: counts.critical },
          { label: 'High', color: '#f0b429', value: counts.high },
          { label: 'Medium', color: '#00e5c8', value: counts.medium },
          { label: 'Low', color: '#818cf8', value: counts.low },
        ] as const).map(({ label, color, value }) => (
          <div
            key={label}
            className="flex-1 flex flex-col items-center gap-0.5 py-[5px] px-[3px] bg-[#060e18] rounded-lg border border-[#1a3545]"
          >
            <div className="w-1.5 h-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
            <span className="text-[11px] font-bold leading-none" style={{ color }}>{value}</span>
            <span className="text-[7px] text-[#2a5568]">{label}</span>
          </div>
        ))}
        <div className="flex-1 flex flex-col items-center gap-0.5 py-[5px] px-[3px] bg-[#00ff8808] rounded-lg border border-[#00ff8833]">
          <div
            className="w-1.5 h-1.5 rounded-full bg-[#00ff88]"
            style={{ animation: 'sPulse 1.5s infinite' }}
          />
          <span className="text-[9px] font-extrabold text-[#00ff88] leading-none">
            {counts.critical + counts.high === 0 ? 'ALL CLEAR' : 'ATTENTION'}
          </span>
          <span className="text-[7px] text-[#2a5568]">Status</span>
        </div>
      </div>
    </div>
  );
}
