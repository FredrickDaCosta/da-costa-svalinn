'use client';

import { MODULE_META, PIE_CIRCUMFERENCE } from './types';

interface OperationalPieProps {
  counts: Record<string, number>;
  total: number;
}

export function OperationalPie({ counts, total }: OperationalPieProps) {
  let cumulative = 0;
  const segments = MODULE_META.map((m) => {
    const pct = total > 0 ? (counts[m.key] / total) * 100 : 0;
    const arc = (pct / 100) * PIE_CIRCUMFERENCE;
    const seg = { ...m, pct, da: `${arc} ${PIE_CIRCUMFERENCE - arc}`, offset: -cumulative };
    cumulative += arc;
    return seg;
  });

  return (
    <div className="bg-[#0a1520] rounded-xl border border-[#1a3545] p-3 mb-2.5">
      <div className="text-[11px] font-bold text-white mb-0.5">Operational Breakdown</div>
      <div className="text-[9px] text-[#2a5568] mb-2.5">Your scan distribution by module</div>
      <div className="flex items-center gap-3.5">
        {/* Pie chart */}
        <svg width="110" height="110" viewBox="0 0 110 110" className="shrink-0">
          {total === 0 ? (
            <circle cx="55" cy="55" r="40" fill="none" stroke="#1a3545" strokeWidth="14" />
          ) : (
            segments.map((s) => (
              <circle
                key={s.key}
                cx="55"
                cy="55"
                r="40"
                fill="none"
                stroke={s.color}
                strokeWidth="14"
                strokeDasharray={s.da}
                strokeDashoffset={s.offset}
                transform="rotate(-90 55 55)"
              />
            ))
          )}
          <circle cx="55" cy="55" r="26" fill="#060e18" />
          <text x="55" y="51" textAnchor="middle" fontSize="7" fill="#2a5568" fontFamily="-apple-system,sans-serif">
            TOTAL
          </text>
          <text x="55" y="63" textAnchor="middle" fontSize="11" fontWeight="800" fill="white" fontFamily="-apple-system,sans-serif">
            {total} Scans
          </text>
        </svg>

        {/* Legend bars */}
        <div className="flex-1 flex flex-col gap-1.5">
          {total === 0 ? (
            <span className="text-[9px] text-[#2a5568]">Run a scan to see your module breakdown here.</span>
          ) : (
            segments.map(({ key, label, color, pct }) => (
              <div key={key}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 rounded-sm" style={{ background: color }} />
                    <span className="text-[9px]">{label}</span>
                  </div>
                  <span className="text-[10px] font-bold" style={{ color }}>{pct.toFixed(0)}%</span>
                </div>
                <div className="h-1 bg-[#0d1f2e] rounded-sm mt-0.5">
                  <div className="h-full rounded-sm" style={{ width: `${pct}%`, background: color }} />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
