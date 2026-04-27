'use client';
import { useState, useEffect, useRef } from 'react';
import { useLocalization } from '@/hooks/use-localization';
import { supportedLanguages, type Locale } from '@/context/language-provider';

interface SplashScreenProps {
  onEnter: () => void;
}

export function SplashScreen({ onEnter }: SplashScreenProps) {
  const { t, locale, setLocale } = useLocalization();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(true);
  const [exiting, setExiting] = useState(false);

  // Particle canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;
    const resize = () => {
      canvas.width = canvas.offsetWidth;
      canvas.height = canvas.offsetHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const particles: { x: number; y: number; vx: number; vy: number; r: number; color: string; alpha: number; va: number }[] = [];
    const colors = ['#00e5c8', '#00e5c8', '#f0b429', '#ffffff'];
    for (let i = 0; i < 40; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: canvas.height * (0.2 + Math.random() * 0.7),
        vx: (Math.random() - 0.5) * 0.3,
        vy: -(0.3 + Math.random() * 0.6),
        r: 1 + Math.random() * 2,
        color: colors[Math.floor(Math.random() * colors.length)],
        alpha: 0,
        va: 0.008 + Math.random() * 0.012,
      });
    }

    let phase = 0;
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      phase += 0.01;
      for (const p of particles) {
        p.alpha += p.va;
        if (p.alpha > 1) { p.alpha = 0; p.x = Math.random() * canvas.width; p.y = canvas.height * (0.2 + Math.random() * 0.7); }
        p.x += p.vx;
        p.y += p.vy;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = Math.sin(p.alpha * Math.PI) * 0.8;
        ctx.shadowBlur = 6;
        ctx.shadowColor = p.color;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  const handleEnter = () => {
    setExiting(true);
    setTimeout(() => { setVisible(false); onEnter(); }, 600);
  };

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#060b12',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'opacity 0.6s ease',
        opacity: exiting ? 0 : 1,
        overflow: 'hidden',
      }}
    >
      {/* Grid background */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(0,229,200,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,200,0.05) 1px,transparent 1px)',
        backgroundSize: '36px 36px',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%,black 40%,transparent 100%)',
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%,black 40%,transparent 100%)',
        pointerEvents: 'none',
      }} />

      {/* Radial glow */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'radial-gradient(ellipse 70% 60% at 50% 30%,#0a2030 0%,#060b12 70%)',
        pointerEvents: 'none',
      }} />

      {/* Particle canvas */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} />

      {/* Phone-width content column */}
      <div style={{
        position: 'relative', zIndex: 1,
        width: '100%', maxWidth: '380px',
        padding: '0 24px',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        animation: 'dcFadeIn 0.8s ease both',
      }}>

        {/* TOP BAR */}
        <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
          {/* Brand left: mini shield + name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="30" height="36" viewBox="0 0 60 72" fill="none">
              <defs>
                <linearGradient id="ms1" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#1a4560" /><stop offset="100%" stopColor="#060e18" />
                </linearGradient>
                <linearGradient id="ms2" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00e5c8" /><stop offset="100%" stopColor="#0099aa" />
                </linearGradient>
              </defs>
              <path d="M30 3 L5 14 L5 38 C5 57 17 69 30 70 C43 69 55 57 55 38 L55 14 Z" fill="url(#ms1)" stroke="url(#ms2)" strokeWidth="2.2" strokeLinejoin="round" />
              <line x1="18" y1="30" x2="42" y2="30" stroke="#00e5c8" strokeWidth="0.7" opacity="0.35" />
              <line x1="30" y1="16" x2="30" y2="54" stroke="#00e5c8" strokeWidth="0.7" opacity="0.35" />
              <rect x="21" y="37" width="18" height="14" rx="2.5" fill="#00e5c8" opacity="0.88" />
              <path d="M25 37 L25 31 C25 26 35 26 35 31 L35 37" stroke="#00e5c8" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              <circle cx="30" cy="43" r="2.8" fill="#060e18" />
              <rect x="28.8" y="44" width="2.4" height="3.5" fill="#060e18" />
              <circle cx="14" cy="22" r="1.8" fill="#00e5c8" opacity="0.4" />
              <circle cx="46" cy="22" r="1.8" fill="#00e5c8" opacity="0.4" />
            </svg>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#fff', letterSpacing: '1.5px' }}>DA-COSTA</span>
              <span style={{ fontSize: '8.5px', fontWeight: 500, color: '#00e5c8', letterSpacing: '4px', textTransform: 'uppercase', marginTop: '1px' }}>Svalinn</span>
            </div>
          </div>

          {/* Right: flag + First-in-Africa badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ fontSize: '16px', lineHeight: 1 }}>🇳🇬</span>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              background: 'linear-gradient(135deg,#b87200,#f0b429,#c8860a)',
              borderRadius: '20px', padding: '3px 8px 3px 5px',
              boxShadow: '0 0 10px #f0b42944',
            }}>
              <svg width="16" height="16" viewBox="0 0 34 34" fill="none">
                <circle cx="17" cy="17" r="15" fill="#2a1400" stroke="#c8860a" strokeWidth="1.2" />
                <ellipse cx="17" cy="17" rx="15" ry="6" fill="none" stroke="#f0b429" strokeWidth="0.8" opacity="0.7" />
                <ellipse cx="17" cy="17" rx="15" ry="11" fill="none" stroke="#f0b429" strokeWidth="0.5" opacity="0.35" />
                <line x1="17" y1="2" x2="17" y2="32" stroke="#f0b429" strokeWidth="0.8" opacity="0.6" />
                <line x1="2" y1="17" x2="32" y2="17" stroke="#f0b429" strokeWidth="0.6" opacity="0.4" />
                <circle cx="17" cy="17" r="2.5" fill="#f0b429" />
              </svg>
              <span style={{ fontSize: '7.5px', fontWeight: 800, color: '#2a1400', letterSpacing: '0.8px', whiteSpace: 'nowrap', textTransform: 'uppercase' }}>
                {t('splash_fia_badge')}
              </span>
            </div>
          </div>
        </div>

        {/* MAIN SHIELD */}
        <div style={{ position: 'relative', width: '216px', height: '222px', margin: '8px 0 4px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          {/* Orbit nodes */}
          {[0,1,2,3,4].map(i => (
            <div key={i} style={{
              position: 'absolute', top: '50%', left: '50%',
              width: i === 1 || i === 2 ? '5px' : i === 3 ? '4px' : '7px',
              height: i === 1 || i === 2 ? '5px' : i === 3 ? '4px' : '7px',
              borderRadius: '50%',
              background: i === 1 || i === 4 ? '#f0b429' : i === 3 ? '#ffffff' : '#00e5c8',
              boxShadow: i === 3 ? 'none' : `0 0 6px ${i === 1 || i === 4 ? '#f0b429' : '#00e5c8'}`,
              opacity: i === 3 ? 0.5 : 1,
              animation: `dcOrbit${i} 7s linear infinite`,
              marginTop: '-3.5px', marginLeft: '-3.5px',
            }} />
          ))}

          {/* Shield SVG */}
          <div style={{ animation: 'dcShieldPulse 3.5s ease-in-out infinite' }}>
            <svg width="216" height="222" viewBox="0 0 216 222" fill="none">
              <defs>
                <linearGradient id="shBg" x1="30%" y1="0%" x2="70%" y2="100%">
                  <stop offset="0%" stopColor="#122840" /><stop offset="50%" stopColor="#091828" /><stop offset="100%" stopColor="#050e1a" />
                </linearGradient>
                <linearGradient id="shS" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00e5c8" /><stop offset="50%" stopColor="#00b8a0" /><stop offset="100%" stopColor="#00e5c8" />
                </linearGradient>
                <linearGradient id="shBv" x1="0%" y1="0%" x2="50%" y2="100%">
                  <stop offset="0%" stopColor="#fff" stopOpacity="0.13" /><stop offset="100%" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="lkG" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00ffe8" /><stop offset="100%" stopColor="#0099aa" />
                </linearGradient>
                <linearGradient id="gdG" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ffe066" /><stop offset="100%" stopColor="#c8860a" />
                </linearGradient>
                <radialGradient id="cG" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#00e5c8" stopOpacity="0.3" /><stop offset="100%" stopColor="#00e5c8" stopOpacity="0" />
                </radialGradient>
                <filter id="bl4" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="4" /></filter>
                <clipPath id="shCl"><path d="M108 10 L18 44 L18 100 C18 156 60 202 108 216 C156 202 198 156 198 100 L198 44 Z" /></clipPath>
              </defs>
              <ellipse cx="108" cy="118" rx="88" ry="98" fill="#00e5c8" opacity="0.04" filter="url(#bl4)" />
              <path d="M108 10 L18 44 L18 100 C18 156 60 202 108 216 C156 202 198 156 198 100 L198 44 Z" fill="none" stroke="#00e5c8" strokeWidth="1" opacity="0.22" strokeDasharray="8 5" />
              <path d="M108 10 L18 44 L18 100 C18 156 60 202 108 216 C156 202 198 156 198 100 L198 44 Z" fill="url(#shBg)" stroke="url(#shS)" strokeWidth="2.5" />
              <path d="M108 10 L18 44 L18 100 C18 156 60 202 108 216 L108 10 Z" fill="url(#shBv)" opacity="0.55" />
              <path d="M108 22 L32 52 L32 100 C32 148 66 190 108 203 C150 190 184 148 184 100 L184 52 Z" fill="none" stroke="#00e5c8" strokeWidth="0.7" opacity="0.18" />
              <g clipPath="url(#shCl)">
                <g opacity="0.13">
                  {['108,40 120,47 120,61 108,68 96,61 96,47','132,40 144,47 144,61 132,68 120,61 120,47','84,40 96,47 96,61 84,68 72,61 72,47','60,40 72,47 72,61 60,68 48,61 48,47','156,40 168,47 168,61 156,68 144,61 144,47','108,68 120,75 120,89 108,96 96,89 96,75','132,68 144,75 144,89 132,96 120,89 120,75','84,68 96,75 96,89 84,96 72,89 72,75','60,68 72,75 72,89 60,96 48,89 48,75','156,68 168,75 168,89 156,96 144,89 144,75','108,96 120,103 120,117 108,124 96,117 96,103','132,96 144,103 144,117 132,124 120,117 120,103','84,96 96,103 96,117 84,124 72,117 72,103','108,124 120,131 120,145 108,152 96,145 96,131','132,124 144,131 144,145 132,152 120,145 120,131','84,124 96,131 96,145 84,152 72,145 72,131'].map((pts, i) => (
                    <polygon key={i} points={pts} fill="none" stroke="#00e5c8" strokeWidth="0.6" />
                  ))}
                </g>
                <g stroke="#00e5c8" strokeWidth="0.8" opacity="0.28" fill="none">
                  <line x1="32" y1="78" x2="86" y2="78" /><line x1="130" y1="78" x2="184" y2="78" />
                  <line x1="32" y1="148" x2="82" y2="148" /><line x1="134" y1="148" x2="184" y2="148" />
                  <line x1="68" y1="44" x2="68" y2="188" /><line x1="148" y1="44" x2="148" y2="188" />
                </g>
                <g fill="#00e5c8" opacity="0.45">
                  <circle cx="68" cy="78" r="2.2" /><circle cx="148" cy="78" r="2.2" />
                  <circle cx="68" cy="148" r="2.2" /><circle cx="148" cy="148" r="2.2" />
                </g>
                <line x1="32" y1="78" x2="86" y2="78" stroke="#00e5c8" strokeWidth="1.5" strokeDasharray="6 8" opacity="0.55"><animate attributeName="stroke-dashoffset" from="0" to="-28" dur="1.2s" repeatCount="indefinite" /></line>
                <line x1="184" y1="78" x2="130" y2="78" stroke="#00e5c8" strokeWidth="1.5" strokeDasharray="6 8" opacity="0.55"><animate attributeName="stroke-dashoffset" from="0" to="-28" dur="1.5s" repeatCount="indefinite" /></line>
                <line x1="148" y1="44" x2="148" y2="188" stroke="#f0b429" strokeWidth="1" strokeDasharray="5 10" opacity="0.3"><animate attributeName="stroke-dashoffset" from="0" to="30" dur="2s" repeatCount="indefinite" /></line>
                <line x1="68" y1="44" x2="68" y2="188" stroke="#f0b429" strokeWidth="1" strokeDasharray="5 10" opacity="0.3"><animate attributeName="stroke-dashoffset" from="0" to="30" dur="2.6s" repeatCount="indefinite" /></line>
                <circle cx="108" cy="122" r="44" fill="url(#cG)" />
                <circle cx="108" cy="122" r="50" fill="none" stroke="#00e5c8" strokeWidth="0.6" strokeDasharray="4 4" opacity="0.28"><animateTransform attributeName="transform" type="rotate" from="0 108 122" to="360 108 122" dur="18s" repeatCount="indefinite" /></circle>
                <circle cx="108" cy="122" r="38" fill="none" stroke="#00e5c8" strokeWidth="0.4" strokeDasharray="2 6" opacity="0.18"><animateTransform attributeName="transform" type="rotate" from="0 108 122" to="-360 108 122" dur="12s" repeatCount="indefinite" /></circle>
                <rect x="88" y="120" width="40" height="32" rx="5.5" fill="#000" opacity="0.35" />
                <rect x="86" y="118" width="44" height="34" rx="6" fill="#0a2535" stroke="url(#lkG)" strokeWidth="1.5" />
                <rect x="88" y="120" width="40" height="30" rx="5" fill="url(#shBv)" opacity="0.7" />
                <line x1="86" y1="132" x2="130" y2="132" stroke="#00e5c8" strokeWidth="0.5" opacity="0.25" />
                <path d="M96 118 L96 106 C96 95 120 95 120 106 L120 118" stroke="#000" strokeWidth="7" fill="none" strokeLinecap="round" opacity="0.45" />
                <path d="M96 118 L96 106 C96 95 120 95 120 106 L120 118" stroke="url(#lkG)" strokeWidth="5" fill="none" strokeLinecap="round" />
                <path d="M97 118 L97 107 C97 99 108 96 108 96" stroke="#00ffe8" strokeWidth="1.5" fill="none" strokeLinecap="round" opacity="0.45" />
                <circle cx="108" cy="133" r="7" fill="#060e18" stroke="#00e5c8" strokeWidth="0.8" />
                <circle cx="108" cy="131" r="2.5" fill="#00e5c8" opacity="0.85" />
                <rect x="106.7" y="133" width="2.6" height="4" rx="1" fill="#00e5c8" opacity="0.75" />
                <g fill="url(#gdG)" opacity="0.85">
                  <polygon points="52,56 53.5,52 55,56 59,57.5 55,59 53.5,63 52,59 48,57.5" />
                  <polygon points="160,52 161,49 162,52 165,53 162,54 161,57 160,54 157,53" />
                  <polygon points="108,168 109,165 110,168 113,169 110,170 109,173 108,170 105,169" />
                </g>
                <text x="108" y="166" textAnchor="middle" fontSize="6.5" fontWeight="700" fill="#00e5c8" opacity="0.65" letterSpacing="2" fontFamily="-apple-system,sans-serif">{t('splash_perimeter_active')}</text>
                <text x="34" y="60" fontSize="6" fill="#00e5c8" opacity="0.18" fontFamily="monospace">01</text>
                <text x="34" y="69" fontSize="6" fill="#00e5c8" opacity="0.13" fontFamily="monospace">10</text>
                <text x="172" y="60" fontSize="6" fill="#00e5c8" opacity="0.18" fontFamily="monospace">11</text>
                <text x="172" y="69" fontSize="6" fill="#00e5c8" opacity="0.13" fontFamily="monospace">00</text>
              </g>
              <circle cx="36" cy="56" r="3.2" fill="#0a2535" stroke="#00e5c8" strokeWidth="1" opacity="0.55" />
              <circle cx="180" cy="56" r="3.2" fill="#0a2535" stroke="#00e5c8" strokeWidth="1" opacity="0.55" />
              <circle cx="108" cy="14" r="2.8" fill="#0a2535" stroke="#00e5c8" strokeWidth="1" opacity="0.45" />
            </svg>
          </div>

          {/* Scan line */}
          <div style={{ position: 'absolute', width: '150px', height: '162px', overflow: 'hidden', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}>
            <div style={{ width: '100%', height: '2px', background: 'linear-gradient(90deg,transparent,#00e5c8cc 40%,#00e5c8ff 50%,#00e5c8cc 60%,transparent)', animation: 'dcScan 3s ease-in-out infinite', position: 'absolute', top: '50%' }} />
          </div>
        </div>

        {/* APP NAME */}
        <div style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '3px', color: '#00e5c8', textTransform: 'uppercase', textAlign: 'center', marginBottom: '5px', textShadow: '0 0 12px #00e5c888', animation: 'dcFadeUp 0.9s ease 0.3s both' }}>
          {t('splash_app_name')}
        </div>

        {/* TAGLINES */}
        <div style={{ textAlign: 'center', width: '100%', animation: 'dcFadeUp 0.9s ease 0.55s both' }}>
          <div style={{ fontSize: '13px', fontWeight: 700, color: '#fff', lineHeight: 1.38, marginBottom: '7px' }}>
            {t('splash_tagline_primary_1')}&nbsp;&amp;<br />
            <span style={{ color: '#00e5c8' }}>{t('splash_tagline_primary_2')}</span>
          </div>
          <div style={{ fontSize: '9.5px', color: '#5a9aae', lineHeight: 1.75, marginBottom: '3px' }}>
            {t('splash_tagline_secondary')}
          </div>
          <div style={{ fontSize: '9px', color: '#3a6878', fontStyle: 'italic', marginBottom: '14px' }}>
            {t('splash_tagline_tertiary')}
          </div>


          {/* LANGUAGE SELECTOR */}
          <div style={{ width: '100%', marginBottom: '10px', position: 'relative' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              background: '#0d1f2e', border: '1px solid #1e3a4a',
              borderRadius: '8px', padding: '8px 12px', cursor: 'pointer',
              width: '100%',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00e5c8" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: '#00e5c8', fontSize: '11px', fontWeight: 600,
                  letterSpacing: '0.5px', cursor: 'pointer',
                  appearance: 'none', WebkitAppearance: 'none',
                }}
              >
                {supportedLanguages.map((lang) => (
                  <option key={lang.code} value={lang.code} style={{ background: '#0d1f2e', color: '#fff' }}>
                    {lang.name}
                  </option>
                ))}
              </select>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="#00e5c8">
                <path d="M1 3 L5 7 L9 3" stroke="#00e5c8" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
              </svg>
            </div>
          </div>


          {/* CTA BUTTON */}
          <button
            onClick={handleEnter}
            style={{
              width: '100%', padding: '14px 0',
              background: 'linear-gradient(135deg,#00e5c811,#00e5c805)',
              border: '1.5px solid #00e5c8', borderRadius: '10px',
              color: '#00e5c8', fontSize: '10.5px', fontWeight: 800,
              letterSpacing: '3px', textTransform: 'uppercase', cursor: 'pointer',
              marginBottom: '0', animation: 'dcBtnGlow 3s ease-in-out infinite, dcFadeUp 0.9s ease 0.8s both',
              transition: 'all 0.25s', position: 'relative', overflow: 'hidden',
            }}
          >
            {t('splash_cta')}
          </button>
        </div>

        {/* STATUS FOOTER */}
        <div style={{
          width: '100%', marginTop: '14px', paddingTop: '12px',
          borderTop: '1px solid #1e3a4a',
          display: 'grid', gridTemplateColumns: '1fr 1px 1fr 1px 1fr',
          alignItems: 'start', animation: 'dcFadeUp 0.9s ease 1.1s both',
        }}>
          {/* Node Status */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingRight: '6px', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '6.5px', fontWeight: 700, color: '#2a5568', letterSpacing: '1.8px', textTransform: 'uppercase' }}>{t('splash_node_status_label')}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#00ff88', flexShrink: 0, animation: 'dcNodePulse 2s ease-in-out infinite', boxShadow: '0 0 8px #00ff88, 0 0 16px #00ff8866' }} />
              <span style={{ color: '#00ff88', fontSize: '9px', fontWeight: 800, letterSpacing: '1px' }}>{t('splash_node_status_value')}</span>
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: '1px', background: '#1e3a4a', height: '32px', alignSelf: 'center' }} />

          {/* Encryption */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '0 6px', alignItems: 'center' }}>
            <span style={{ fontSize: '6.5px', fontWeight: 700, color: '#2a5568', letterSpacing: '1.8px', textTransform: 'uppercase', textAlign: 'center' }}>{t('splash_encryption_label')}</span>
            <span style={{ color: '#00e5c8', fontSize: '8px', fontWeight: 800, letterSpacing: '0.5px', textAlign: 'center', lineHeight: 1.3 }}>{t('splash_encryption_value')}</span>
          </div>

          {/* Divider */}
          <div style={{ width: '1px', background: '#1e3a4a', height: '32px', alignSelf: 'center' }} />

          {/* Protocol */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '6px', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '6.5px', fontWeight: 700, color: '#2a5568', letterSpacing: '1.8px', textTransform: 'uppercase' }}>{t('splash_protocol_label')}</span>
            <span style={{ color: '#f0b429', fontSize: '8.5px', fontWeight: 800, letterSpacing: '0.5px', textAlign: 'right' }}>{t('splash_protocol_value')}</span>
          </div>
        </div>

      </div>

      {/* Keyframe styles */}
      <style>{`
        @keyframes dcShieldPulse {
          0%,100% { filter: drop-shadow(0 0 20px #00e5c8bb) drop-shadow(0 0 50px #00e5c844); }
          50% { filter: drop-shadow(0 0 38px #00e5c8ff) drop-shadow(0 0 80px #00e5c866); }
        }
        @keyframes dcScan {
          0% { transform: translateY(-100px); opacity: 0; }
          8% { opacity: 0.6; }
          92% { opacity: 0.6; }
          100% { transform: translateY(100px); opacity: 0; }
        }
        @keyframes dcFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes dcFadeUp { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes dcBtnGlow {
          0%,100% { box-shadow: 0 0 18px #00e5c844, inset 0 0 12px #00e5c811; }
          50% { box-shadow: 0 0 36px #00e5c888, inset 0 0 20px #00e5c822; }
        }
        @keyframes dcNodePulse {
          0%,100% { box-shadow: 0 0 4px #00ff88, 0 0 10px #00ff8866, 0 0 20px #00ff8833; }
          50% { box-shadow: 0 0 8px #00ff88, 0 0 20px #00ff88cc, 0 0 35px #00ff8855; }
        }
        @keyframes dcOrbit0 { from { transform: rotate(0deg) translateX(76px) rotate(0deg); } to { transform: rotate(360deg) translateX(76px) rotate(-360deg); } }
        @keyframes dcOrbit1 { from { transform: rotate(72deg) translateX(76px) rotate(-72deg); } to { transform: rotate(432deg) translateX(76px) rotate(-432deg); } }
        @keyframes dcOrbit2 { from { transform: rotate(144deg) translateX(76px) rotate(-144deg); } to { transform: rotate(504deg) translateX(76px) rotate(-504deg); } }
        @keyframes dcOrbit3 { from { transform: rotate(216deg) translateX(76px) rotate(-216deg); } to { transform: rotate(576deg) translateX(76px) rotate(-576deg); } }
        @keyframes dcOrbit4 { from { transform: rotate(288deg) translateX(76px) rotate(-288deg); } to { transform: rotate(648deg) translateX(76px) rotate(-648deg); } }
      `}</style>
    </div>
  );
}
