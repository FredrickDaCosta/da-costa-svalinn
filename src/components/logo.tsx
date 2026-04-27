import { cn } from '@/lib/utils';

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <svg width="28" height="33" viewBox="0 0 60 72" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="logoMs1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1a4560" />
            <stop offset="100%" stopColor="#060e18" />
          </linearGradient>
          <linearGradient id="logoMs2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00e5c8" />
            <stop offset="100%" stopColor="#0099aa" />
          </linearGradient>
        </defs>
        {/* Closed shield body */}
        <path
          d="M30 3 L5 14 L5 38 C5 57 17 69 30 70 C43 69 55 57 55 38 L55 14 Z"
          fill="url(#logoMs1)"
          stroke="url(#logoMs2)"
          strokeWidth="2.2"
          strokeLinejoin="round"
        />
        {/* Circuit cross lines */}
        <line x1="18" y1="30" x2="42" y2="30" stroke="#00e5c8" strokeWidth="0.7" opacity="0.35" />
        <line x1="30" y1="16" x2="30" y2="54" stroke="#00e5c8" strokeWidth="0.7" opacity="0.35" />
        {/* Lock body */}
        <rect x="21" y="37" width="18" height="14" rx="2.5" fill="#00e5c8" opacity="0.88" />
        {/* Lock shackle */}
        <path
          d="M25 37 L25 31 C25 26 35 26 35 31 L35 37"
          stroke="#00e5c8"
          strokeWidth="2.5"
          fill="none"
          strokeLinecap="round"
        />
        {/* Keyhole */}
        <circle cx="30" cy="43" r="2.8" fill="#060e18" />
        <rect x="28.8" y="44" width="2.4" height="3.5" fill="#060e18" />
        {/* Corner rivets */}
        <circle cx="14" cy="22" r="1.8" fill="#00e5c8" opacity="0.4" />
        <circle cx="46" cy="22" r="1.8" fill="#00e5c8" opacity="0.4" />
      </svg>
      <div className="flex flex-col leading-tight">
        <span className="font-headline text-base font-bold text-primary tracking-wide">Da-Costa</span>
        <span className="text-[8px] font-medium tracking-[0.3em] uppercase" style={{ color: '#00e5c8' }}>Svalinn</span>
      </div>
    </div>
  );
}
