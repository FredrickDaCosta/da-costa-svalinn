/* ─── SOC Dashboard Shared Types & Constants ─────────────────── */

export type SocLevel = 'secure' | 'elevated' | 'high' | 'critical';

export const THREAT_LEVELS: Record<SocLevel, {
  pct: string;
  bg: string;
  badge: string;
  bc: string;
  btc: string;
  bbd: string;
}> = {
  secure:   { pct: '8%',  bg: 'linear-gradient(90deg,#00ff88,#00e5c8)', badge: 'SECURE',   bc: '#00ff8822', btc: '#00ff88', bbd: '1px solid #00ff8844' },
  elevated: { pct: '38%', bg: 'linear-gradient(90deg,#f0b429,#e09000)', badge: 'ELEVATED', bc: '#f0b42922', btc: '#f0b429', bbd: '1px solid #f0b42944' },
  high:     { pct: '65%', bg: 'linear-gradient(90deg,#e24b4a,#c02020)', badge: 'HIGH',     bc: '#e24b4a22', btc: '#e24b4a', bbd: '1px solid #e24b4a44' },
  critical: { pct: '95%', bg: 'linear-gradient(90deg,#e24b4a,#ff0000)', badge: 'CRITICAL', bc: '#e24b4a33', btc: '#e24b4a', bbd: '1px solid #e24b4a88' },
};

export interface ModuleMeta {
  key: string;
  label: string;
  color: string;
}

export const MODULE_META: ModuleMeta[] = [
  { key: 'link', label: 'Link Scrutinizer', color: '#00e5c8' },
  { key: 'lure', label: 'Lure Detector', color: '#f0b429' },
  { key: 'email', label: 'Email Analyzer', color: '#818cf8' },
  { key: 'video', label: 'Video Auditor', color: '#a855f7' },
  { key: 'sms', label: 'SMS & Call Shield', color: '#00b4d8' },
  { key: 'deepfake', label: 'Deepfake Audio', color: '#e879f9' },
];

export const PIE_CIRCUMFERENCE = 2 * Math.PI * 40;
export const RING_CIRCUMFERENCE = 2 * Math.PI * 40;

export const SOC_STYLES = `
@keyframes sPulse{0%,100%{box-shadow:0 0 4px #00e5c8,0 0 10px #00e5c866}50%{box-shadow:0 0 10px #00e5c8,0 0 24px #00e5c8aa}}
@keyframes shine{0%{transform:translateX(-100%)}100%{transform:translateX(200%)}}
@keyframes floatShield{0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
@keyframes streakGlow{0%,100%{box-shadow:0 0 6px #00e5c844}50%{box-shadow:0 0 16px #00e5c8aa}}
`;

export interface LevelCounts {
  critical: number;
  high: number;
  medium: number;
  low: number;
}
