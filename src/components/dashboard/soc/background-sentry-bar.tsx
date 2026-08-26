'use client';

import { formatDistanceToNow } from 'date-fns';

interface BackgroundSentryBarProps {
  active: boolean;
  scansToday: number;
  lastScanAt: Date | null;
  smsNote: string;
}

export function BackgroundSentryBar({ active, scansToday, lastScanAt, smsNote }: BackgroundSentryBarProps) {
  return (
    <div className="flex items-center gap-2.5 py-2.5 px-3.5 rounded-xl bg-[#0a1a14] border border-primary/20 mb-2.5 relative overflow-hidden">
      {/* Animated scan lines */}
      <svg className="absolute top-0 left-0 w-full h-full pointer-events-none" viewBox="0 0 300 46" preserveAspectRatio="none">
        <line x1="0" y1="23" x2="300" y2="23" stroke="#00e5c8" strokeWidth="0.4" strokeDasharray="8 6" opacity="0.2">
          <animate attributeName="stroke-dashoffset" from="0" to="-28" dur="1.5s" repeatCount="indefinite" />
        </line>
        <line x1="0" y1="12" x2="300" y2="12" stroke="#00e5c8" strokeWidth="0.3" strokeDasharray="4 10" opacity="0.1">
          <animate attributeName="stroke-dashoffset" from="0" to="-28" dur="2.2s" repeatCount="indefinite" />
        </line>
        <circle cx="280" cy="23" r="3" fill="#00e5c8" opacity="0.3">
          <animate attributeName="cx" values="300;0" dur="3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0;0.6;0" dur="3s" repeatCount="indefinite" />
        </circle>
      </svg>

      {/* Status dot */}
      <div
        className="w-2 h-2 rounded-full shrink-0"
        style={{
          background: active ? '#00e5c8' : '#2a5568',
          animation: active ? 'sPulse 1.5s ease-in-out infinite' : 'none',
          boxShadow: active ? '0 0 10px #00e5c8' : 'none',
        }}
      />

      {/* Label */}
      <div className="flex-1 relative z-10">
        <div className="text-[11px] font-bold text-primary tracking-[1.5px] uppercase">Background Sentry</div>
        <div className="text-[9px] text-[#2a5568] mt-0.5">Monitoring WhatsApp · Email · SMS Alerts · Links · Media</div>
        <div className="text-[8px] text-[#1e4a5a] mt-0.5 italic">ℹ {smsNote}</div>
      </div>

      {/* Status badge + scan count */}
      <div className="flex flex-col items-end gap-0.5 relative z-10">
        <span
          className="px-2.5 py-[3px] rounded-full text-[9px] font-extrabold tracking-wider"
          style={{
            background: active ? '#00e5c8' : '#1a3545',
            color: active ? '#060b12' : '#2a5568',
          }}
        >
          {active ? 'ACTIVE' : 'INACTIVE'}
        </span>
        <span className="text-[8px] text-[#2a5568]">
          {scansToday} scans today{lastScanAt ? ` · last ${formatDistanceToNow(lastScanAt, { addSuffix: true })}` : ''}
        </span>
      </div>
    </div>
  );
}
