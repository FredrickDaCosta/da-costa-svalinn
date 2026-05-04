''''''
'use client';
import { useEffect, useRef } from 'react';

export function DcBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    let animId: number;
    const resize = () => { canvas.width = canvas.offsetWidth; canvas.height = canvas.offsetHeight; };
    resize();
    window.addEventListener('resize', resize);
    const colors = ['#00e5c8', '#00e5c8', '#f0b429', '#ffffff'];
    const particles: any[] = [];
    for (let i = 0; i < 40; i++) {
      particles.push({ x: Math.random() * 1000, y: Math.random() * 800, vx: (Math.random()-0.5)*0.3, vy: -(0.3+Math.random()*0.6), r: 1+Math.random()*2, color: colors[Math.floor(Math.random()*colors.length)], alpha: 0, va: 0.008+Math.random()*0.012 });
    }
    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of particles) {
        p.alpha += p.va;
        if (p.alpha > 1) { p.alpha = 0; p.x = Math.random()*canvas.width; p.y = canvas.height*(0.2+Math.random()*0.7); }
        p.x += p.vx; p.y += p.vy;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.fillStyle = p.color; ctx.globalAlpha = Math.sin(p.alpha*Math.PI)*0.8;
        ctx.shadowBlur = 6; ctx.shadowColor = p.color; ctx.fill();
        ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animId); window.removeEventListener('resize', resize); };
  }, []);

  return (
    <>
      {/* Base background */}
      <div style={{ position: 'absolute', inset: 0, background: '#060b12', zIndex: 0 }} />
      {/* Grid */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1,
        backgroundImage: 'linear-gradient(rgba(0,229,200,0.05) 1px,transparent 1px),linear-gradient(90deg,rgba(0,229,200,0.05) 1px,transparent 1px)',
        backgroundSize: '36px 36px',
        WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%,black 40%,transparent 100%)',
        maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%,black 40%,transparent 100%)',
        pointerEvents: 'none' }} />
      {/* Radial glow */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 2,
        background: 'radial-gradient(ellipse 70% 60% at 50% 30%,#0a2030 0%,#060b12 70%)',
        pointerEvents: 'none' }} />
      {/* Particle canvas */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 3, pointerEvents: 'none' }} />
    </>
  );
}