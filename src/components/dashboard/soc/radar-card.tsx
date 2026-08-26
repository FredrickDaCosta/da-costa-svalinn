'use client';

import { formatDistanceToNow } from 'date-fns';

interface RadarCardProps {
  scansToday: number;
  lastScanAt: Date | null;
}

const INFO_ROWS: [string, string][] = [
  ['Scan Mode', 'Zero-Interaction'],
  ['AI Engine', 'Nemotron Active'],
  ['Data Retained', 'None — Stateless'],
  ['Coverage', 'Links · SMS · Email · Audio · Media'],
];

export function RadarCard({ scansToday, lastScanAt }: RadarCardProps) {
  return (
    <div className="bg-[#0a1520] rounded-xl border border-primary/20 p-3.5 mb-2.5">
      {/* Header */}
      <div className="flex items-center gap-1.5 mb-2.5">
        <svg width="14" height="14" viewBox="0 0 14 14" fill="#00e5c8">
          <polygon points="7,1 9,5 13,5 10,8 11,13 7,10 3,13 4,8 1,5 5,5" />
        </svg>
        <div>
          <div className="text-[11px] font-bold text-primary">Autonomous Intelligence Mode</div>
          <div className="text-[9px] text-[#2a5568] mt-0.5">Zero-Interaction mode — Stateless AI Inference active</div>
        </div>
      </div>

      <div className="flex gap-3 items-start">
        {/* Radar SVG */}
        <div className="relative shrink-0">
          <svg width="134" height="134" viewBox="0 0 134 134">
            <defs>
              <radialGradient id="rg">
                <stop offset="0%" stopColor="#00e5c8" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#00e5c8" stopOpacity="0" />
              </radialGradient>
              <clipPath id="rclip">
                <circle cx="67" cy="67" r="62" />
              </clipPath>
            </defs>
            <circle cx="67" cy="67" r="62" fill="#060e18" stroke="#00e5c822" strokeWidth="1" />
            <circle cx="67" cy="67" r="46" fill="none" stroke="#00e5c80e" strokeWidth="0.8" />
            <circle cx="67" cy="67" r="31" fill="none" stroke="#00e5c80e" strokeWidth="0.8" />
            <circle cx="67" cy="67" r="16" fill="none" stroke="#00e5c811" strokeWidth="0.8" />
            <line x1="5" y1="67" x2="129" y2="67" stroke="#00e5c80a" strokeWidth="0.5" />
            <line x1="67" y1="5" x2="67" y2="129" stroke="#00e5c80a" strokeWidth="0.5" />
            <g clipPath="url(#rclip)">
              <path d="M67 67 L129 67 A62 62 0 0 0 67 5 Z" fill="url(#rg)">
                <animateTransform attributeName="transform" type="rotate" from="0 67 67" to="360 67 67" dur="3s" repeatCount="indefinite" />
              </path>
              <line x1="67" y1="67" x2="129" y2="67" stroke="#00e5c8" strokeWidth="1.5" opacity="0.9">
                <animateTransform attributeName="transform" type="rotate" from="0 67 67" to="360 67 67" dur="3s" repeatCount="indefinite" />
              </line>
            </g>
            <circle cx="67" cy="67" r="4" fill="#00e5c8">
              <animate attributeName="r" values="3;5;3" dur="2s" repeatCount="indefinite" />
            </circle>
            {(['N', 'E', 'S', 'W'] as const).map((d) => {
              const positions: Record<string, { x: number; y: number }> = {
                N: { x: 67, y: 10 },
                E: { x: 126, y: 70 },
                S: { x: 67, y: 131 },
                W: { x: 8, y: 70 },
              };
              return (
                <text key={d} x={positions[d].x} y={positions[d].y} textAnchor="middle" fontSize="7" fill="#00e5c833" fontFamily="monospace">
                  {d}
                </text>
              );
            })}
          </svg>

          {/* Scans today badge */}
          <div className="absolute top-1.5 right-1.5 bg-[#060e18cc] border border-primary/20 rounded-md px-1.5 py-[3px] text-center">
            <div className="text-[7px] text-[#2a5568] tracking-wider">SCANS TODAY</div>
            <div className="text-sm font-extrabold text-primary">{scansToday}</div>
          </div>

          {/* Last scan badge */}
          <div className="absolute bottom-1.5 left-1.5 bg-[#060e18cc] border border-primary/10 rounded-md px-1.5 py-[3px]">
            <div className="text-[7px] text-[#2a5568] tracking-wider">LAST SCAN</div>
            <div className="text-[10px] font-bold text-primary">
              {lastScanAt ? formatDistanceToNow(lastScanAt, { addSuffix: true }) : 'No scans yet'}
            </div>
          </div>
        </div>

        {/* Info rows */}
        <div className="flex-1 flex flex-col gap-1.5">
          {INFO_ROWS.map(([l, v]) => (
            <div key={l} className="bg-[#060e18] rounded-lg py-[7px] px-2.5 border border-[#1a3545]">
              <div className="text-[7px] text-[#2a5568] tracking-wider uppercase mb-0.5">{l}</div>
              <div className="text-[11px] font-bold" style={{ color: l === 'Data Retained' ? '#00ff88' : '#00e5c8' }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
