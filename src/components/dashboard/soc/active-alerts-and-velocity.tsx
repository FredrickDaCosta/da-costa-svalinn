'use client';

import { format } from 'date-fns';

interface ActiveAlertsAndVelocityProps {
  activeCount: number;
  totalToday: number;
  velocity: number[];
  maxVelocity: number;
  dayBuckets: Date[];
}

export function ActiveAlertsAndVelocity({ activeCount, totalToday, velocity, maxVelocity, dayBuckets }: ActiveAlertsAndVelocityProps) {
  const pct = totalToday > 0 ? (activeCount / totalToday) * 100 : 0;

  return (
    <div className="grid grid-cols-2 gap-2 mb-2.5">
      {/* Active Alerts */}
      <div className="bg-[#0a1520] rounded-xl border border-[#1a3545] p-3">
        <div className="text-[11px] font-bold text-white mb-0.5">Active Alerts</div>
        <div className="text-[9px] text-[#2a5568] mb-2">Unresolved findings today</div>
        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-[32px] font-extrabold text-[#e24b4a] leading-none">{activeCount}</span>
          <div>
            <div className="text-[11px] font-bold text-[#e24b4a]">{pct.toFixed(1)}%</div>
            <div className="text-[8px] text-[#2a5568]">of today&apos;s scans</div>
          </div>
        </div>
        <div className="h-[5px] bg-[#0d1f2e] rounded-[3px] overflow-hidden mb-1">
          <div
            className="h-full bg-[#e24b4a] rounded-[3px]"
            style={{ width: `${Math.min(100, pct)}%` }}
          />
        </div>
        <div className="flex justify-between">
          <span className="text-[7px] text-[#1e4a5a]">0%</span>
          <span className="text-[7px] text-[#1e4a5a]">100%</span>
        </div>
      </div>

      {/* Scan Velocity */}
      <div className="bg-[#0a1520] rounded-xl border border-[#1a3545] p-3">
        <div className="text-[11px] font-bold text-white mb-0.5">Scan Velocity</div>
        <div className="text-[9px] text-[#2a5568] mb-1.5">Scans/day, last 7 days</div>
        <svg width="100%" height="68" viewBox="0 0 130 68">
          <g fill="#00e5c8">
            {velocity.map((v, i) => {
              const h = Math.round((v / maxVelocity) * 46);
              return (
                <rect
                  key={i}
                  x={5 + i * 19}
                  y={54 - h}
                  width="14"
                  height={Math.max(h, 2)}
                  rx="2"
                  opacity={0.4 + i * 0.08}
                />
              );
            })}
          </g>
          <g fontSize="6" fill="#2a5568" fontFamily="-apple-system,sans-serif" textAnchor="middle">
            {dayBuckets.map((d, i) => (
              <text key={i} x={12 + i * 19} y="66">{format(d, 'EEEEE')}</text>
            ))}
          </g>
        </svg>
      </div>
    </div>
  );
}
