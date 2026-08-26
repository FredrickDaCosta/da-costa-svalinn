'use client';

interface MonitoringRowProps {
  total: number;
  escalated: number;
  blocked: number;
}

const ITEMS = [
  { label: 'Total Events', key: 'total' as const, color: '#00e5c8' },
  { label: 'Escalated', key: 'escalated' as const, color: '#f0b429' },
  { label: 'Blocked', key: 'blocked' as const, color: '#e24b4a' },
];

export function MonitoringRow({ total, escalated, blocked }: MonitoringRowProps) {
  const values = { total, escalated, blocked };

  return (
    <div className="grid grid-cols-3 gap-2 mb-2.5">
      {ITEMS.map(({ label, key, color }) => (
        <div
          key={label}
          className="bg-[#0a1520] rounded-[10px] border border-[#1a3545] py-[9px] px-[7px] flex flex-col items-center gap-0.5"
        >
          <svg width="46" height="46" viewBox="0 0 46 46">
            <circle cx="23" cy="23" r="19" fill="none" stroke={color + '11'} strokeWidth="5" />
            <circle cx="23" cy="23" r="19" fill="none" stroke={color} strokeWidth="5" strokeDasharray="60 59" strokeLinecap="round">
              <animateTransform attributeName="transform" type="rotate" from="-90 23 23" to="270 23 23" dur="8s" repeatCount="indefinite" />
            </circle>
            <text x="23" y="27" textAnchor="middle" fontSize="9" fontWeight="800" fill={color} fontFamily="-apple-system,sans-serif">
              {values[key]}
            </text>
          </svg>
          <span className="text-[8px] font-bold text-[#2a5568] tracking-wider uppercase text-center">{label}</span>
          <span className="text-[8px] text-[#1e4a5a]">Today</span>
        </div>
      ))}
    </div>
  );
}
