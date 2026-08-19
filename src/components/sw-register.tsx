'use client';

import { useEffect } from 'react';

export function SwRegister() {
  useEffect(() => {
    if (
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator
    ) {
      // Register directly rather than gating on the 'load' event: waiting for
      // 'load' is only a soft bandwidth-conservation convention, not a
      // requirement, and it introduces a real race — if 'load' has already
      // fired by the time this effect runs (fast hydration, cached page,
      // slow first paint on a heavy page), addEventListener('load', ...)
      // never calls back and the service worker silently never registers.
      navigator.serviceWorker
        .register('/sw.js')
        .then((registration) => {
          console.log('[SW] Registered:', registration.scope);
        })
        .catch((error) => {
          console.error('[SW] Registration failed:', error);
        });
    }
  }, []);

  return null;
}
