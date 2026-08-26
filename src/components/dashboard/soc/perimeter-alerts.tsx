'use client';

import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';

interface PerimeterAlertsProps {
  alerts: any[];
}

export function PerimeterAlerts({ alerts: alertList }: PerimeterAlertsProps) {
  // Has real alerts
  if (alertList && alertList.length > 0) {
    return (
      <div className="bg-[#0a1520] rounded-xl border border-[#1a3545] p-3">
        <div className="text-[11px] font-bold text-white mb-0.5">Recent Perimeter Alerts</div>
        <div className="text-[9px] text-[#2a5568] mb-2">Real threat detections from your scan history</div>
        <div className="space-y-3">
          {alertList.map((alert) => (
            <div key={alert.id} className="flex items-start justify-between p-3 border rounded-lg bg-muted/20 hover:bg-muted/40 transition-all gap-3">
              <div className="flex flex-col flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-sm uppercase text-primary">{alert.moduleType}</span>
                  <Badge variant="outline" className="text-[9px] h-4 py-0">SENTRY</Badge>
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(alert.scanTimestamp), 'HH:mm')}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">{alert.summary}</span>
              </div>
              <Badge
                variant={alert.alertLevel === 'critical' || alert.alertLevel === 'high' ? 'destructive' : 'default'}
                className="text-[10px]"
              >
                {alert.alertLevel.toUpperCase()}
              </Badge>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Empty state — radar/shield visualization
  return (
    <div className="bg-[#0a1520] rounded-xl border border-[#1a3545] p-3">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-[11px] font-bold text-white">Recent Perimeter Alerts</div>
          <div className="text-[9px] text-[#2a5568]">Real threat detections from your scan history</div>
        </div>
        <div className="flex gap-1.5">
          {[
            { c: '#e24b4a', l: 'Critical' },
            { c: '#f0b429', l: 'High' },
            { c: '#00e5c8', l: 'Low' },
          ].map(({ c, l }) => (
            <div key={l} className="flex items-center gap-0.5">
              <div className="w-[5px] h-[5px] rounded-full" style={{ background: c }} />
              <span className="text-[8px] text-[#2a5568]">{l}</span>
            </div>
          ))}
        </div>
      </div>

      <svg width="100%" height="150" viewBox="0 0 320 150">
        <defs>
          <radialGradient id="pg" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#00e5c8" stopOpacity="0.12" />
            <stop offset="100%" stopColor="#00e5c8" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Grid */}
        <g stroke="#00e5c8" strokeWidth="0.4" opacity="0.07">
          <line x1="0" y1="37" x2="320" y2="37" />
          <line x1="0" y1="75" x2="320" y2="75" />
          <line x1="0" y1="113" x2="320" y2="113" />
          <line x1="64" y1="0" x2="64" y2="150" />
          <line x1="128" y1="0" x2="128" y2="150" />
          <line x1="192" y1="0" x2="192" y2="150" />
          <line x1="256" y1="0" x2="256" y2="150" />
        </g>
        {/* Pulse rings */}
        <circle cx="160" cy="75" r="18" fill="none" stroke="#00e5c8" strokeWidth="1" opacity="0">
          <animate attributeName="r" values="18;130;18" dur="4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.6;0;0.6" dur="4s" repeatCount="indefinite" />
        </circle>
        <circle cx="160" cy="75" r="18" fill="none" stroke="#00e5c8" strokeWidth="0.6" opacity="0">
          <animate attributeName="r" values="18;130;18" dur="4s" begin="1.3s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.35;0;0.35" dur="4s" begin="1.3s" repeatCount="indefinite" />
        </circle>
        <circle cx="160" cy="75" r="26" fill="url(#pg)" />
        {/* Shield */}
        <g style={{ animation: 'floatShield 3s ease-in-out infinite' }}>
          <path d="M160 58L148 64L148 75C148 84 153 91 160 93C167 91 172 84 172 75L172 64Z" fill="none" stroke="#00e5c8" strokeWidth="2" />
          <path d="M155 75L158 78L165 71" stroke="#00e5c8" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
        {/* Corner dots */}
        <g fill="#00e5c8" opacity="0.3">
          <circle cx="32" cy="18" r="2.5"><animate attributeName="opacity" values="0.2;0.6;0.2" dur="2.5s" repeatCount="indefinite" /></circle>
          <circle cx="288" cy="18" r="2.5"><animate attributeName="opacity" values="0.2;0.6;0.2" dur="3s" repeatCount="indefinite" /></circle>
          <circle cx="32" cy="132" r="2.5"><animate attributeName="opacity" values="0.2;0.6;0.2" dur="2s" repeatCount="indefinite" /></circle>
          <circle cx="288" cy="132" r="2.5"><animate attributeName="opacity" values="0.2;0.6;0.2" dur="3.5s" repeatCount="indefinite" /></circle>
        </g>
        <text x="160" y="122" textAnchor="middle" fontSize="11" fontWeight="700" fill="white" fontFamily="-apple-system,sans-serif">
          Perimeter Clear
        </text>
        <text x="160" y="136" textAnchor="middle" fontSize="8" fill="#2a5568" fontFamily="-apple-system,sans-serif">
          No threats detected by Sentry
        </text>
      </svg>
    </div>
  );
}
