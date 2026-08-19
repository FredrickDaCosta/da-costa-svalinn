'use client';

import { useEffect } from 'react';

export function SwRegister() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator
    ) {
      const register = () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            console.log('[SW] Registered:', registration.scope);
          })
          .catch((error) => {
            console.error('[SW] Registration failed:', error);
          });
      };

      // The 'load' event may already have fired by the time this effect
      // runs (e.g. fast hydration, cached page) — in that case addEventListener
      // would silently never call back, so register immediately instead.
      if (document.readyState === 'complete') {
        register();
      } else {
        window.addEventListener('load', register);
      }
    }
  }, []);

  return null;
}
