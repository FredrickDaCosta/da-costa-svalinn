'use client';

import { RING_CIRCUMFERENCE } from './types';

interface SecurityPostureScoreProps {
  score: number;
  label: string;
  sentryActive: boolean;
  scanCoveragePct: number;
  streakDays: number;
}

export function SecurityPostureScore({ score, label, sentryActive, scanCoveragePct, streakDays }: SecurityPostureScoreProps) {
  const arc = (score / 100) * RING_CIRCUMFERENCE;

  const bars = [
    { l: 'Sentry Coverage', v: sentryActive ? '100%' : '50%', c: '#00e5c8', w: sentryActive ? '100%' : '50%' },
    { l: 'Scan Coverage', v: `${scanCoveragePct}%`, c: '#00ff88', w: `${scanCoveragePct}%` },
    { l: 'Zero-Knowledge', v: '100%', c: '#00e5c8', w: '100%' },
    { l: 'Protection Streak', v: `${streakDays} days`, c: '#f0b429', w: `${Math.min(100, streakDays * 10)}%` },
  ];

  return (
    <div className="bg-[#0a1520] rounded-xl border border-primary/20 p-3 mb-2.5">
      <div className="text-[11px] font-bold text-white mb-0.5">Security Posture Score</div>
      <div className="text-[9px] text-[#2a5568] mb-2.5">Calculated from your scan activity, threat history &amp; sentry status</div>
      <div className="flex items-center gap-3.5">
        {/* Ring chart */}
        <svg width="100" height="100" viewBox="0 0 100 100" className="shrink-0">
          <defs>
            <linearGradient id="sg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00ff88" />
              <stop offset="100%" stopColor="#00e5c8" />
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="40" fill="none" stroke="#00e5c811" strokeWidth="8" />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke="url(#sg)"
            strokeWidth="8"
            strokeDasharray={`${arc} ${RING_CIRCUMFERENCE - arc}`}
            strokeLinecap="round"
            transform="rotate(-90 50 50)"
          />
          <circle cx="50" cy="50" r="30" fill="none" stroke="#00e5c822" strokeWidth="0.8" strokeDasharray="3 4">
            <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="-360 50 50" dur="12s" repeatCount="indefinite" />
          </circle>
          <circle cx="50" cy="50" r="22" fill="#060e18" />
          <text x="50" y="46" textAnchor="middle" fontSize="18" fontWeight="800" fill="#00ff88" fontFamily="-apple-system,sans-serif">
            {score}
          </text>
          <text x="50" y="57" textAnchor="middle" fontSize="7" fill="#00e5c8" fontFamily="-apple-system,sans-serif">
            / 100
          </text>
        </svg>

        {/* Breakdown bars */}
        <div className="flex-1 flex flex-col gap-1.5">
          {bars.map(({ l, v, c, w }) => (
            <div key={l}>
              <div className="flex justify-between">
                <span className="text-[8px] text-[#2a5568]">{l}</span>
                <span className="text-[9px] font-bold" style={{ color: c }}>{v}</span>
              </div>
              <div className="h-1 bg-[#0d1f2e] rounded-sm mt-0.5">
                <div className="h-full rounded-sm" style={{ width: w, background: c }} />
              </div>
            </div>
          ))}
          <div className="bg-[#00ff8811] border border-[#00ff8833] rounded-md py-1 px-2 mt-0.5 text-center">
            <span className="text-[9px] font-bold text-[#00ff88]">{label.toUpperCase()}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
