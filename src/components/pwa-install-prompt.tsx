'use client';

import { useEffect, useState, useRef } from 'react';
import { ShieldCheck, X, Download } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

const DISMISSED_KEY = 'da-costa-pwa-prompt-dismissed';

export function PwaInstallPrompt() {
  const [visible, setVisible] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (sessionStorage.getItem(DISMISSED_KEY)) return;
    if (window.innerWidth >= 768) return;

    const isStandalone =
      window.matchMedia?.('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) return;

    const ios = /iPad|iPhone|iPod/.test(window.navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(ios);

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
    };
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);

    const timer = setTimeout(() => {
      if (ios || deferredPromptRef.current) {
        setVisible(true);
      }
    }, 3000);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    sessionStorage.setItem(DISMISSED_KEY, '1');
  };

  const handleInstall = async () => {
    const deferred = deferredPromptRef.current;
    if (!deferred) {
      dismiss();
      return;
    }
    await deferred.prompt();
    await deferred.userChoice;
    deferredPromptRef.current = null;
    dismiss();
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Install Da-Costa Svalinn"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 9999,
        background: '#0a1520',
        border: '1px solid #00e5c833',
        borderRadius: 14,
        padding: '14px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,.5)',
        animation: 'pwaSlideUp 0.35s ease-out',
      }}
    >
      <style>{`@keyframes pwaSlideUp{from{transform:translateY(24px);opacity:0}to{transform:translateY(0);opacity:1}}`}</style>
      <div
        style={{
          flexShrink: 0,
          width: 40,
          height: 40,
          borderRadius: 10,
          background: '#00e5c81a',
          border: '1px solid #00e5c833',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <ShieldCheck size={20} color="#00e5c8" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Install Da-Costa Svalinn</div>
        <div style={{ fontSize: 11, color: '#8296a8', marginTop: 2 }}>
          {isIOS ? 'Tap Share → Add to Home Screen to install' : 'Add to your home screen for quick, full-screen access'}
        </div>
      </div>
      {!isIOS && (
        <button
          onClick={handleInstall}
          style={{
            flexShrink: 0,
            background: '#00e5c8',
            color: '#060b12',
            fontSize: 12,
            fontWeight: 700,
            border: 'none',
            borderRadius: 8,
            padding: '8px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            cursor: 'pointer',
          }}
        >
          <Download size={14} />
          Add to Home Screen
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label="Dismiss install prompt"
        style={{
          flexShrink: 0,
          background: 'transparent',
          border: 'none',
          color: '#5a7285',
          cursor: 'pointer',
          padding: 4,
        }}
      >
        <X size={18} />
      </button>
    </div>
  );
}
