'use client';

import { useEffect, useCallback, useRef } from 'react';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import app from '@/firebase/config';
import { useAuth } from '@/hooks/use-auth';
import { useFirestore } from '@/firebase';

type ClipboardScanResult = {
  status?: string;
  risk_score?: number;
  reason?: string;
};

function alertLevelFromScore(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 9) return 'critical';
  if (score >= 7) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

/**
 * Real (not simulated) clipboard monitoring.
 *
 * Only acts when:
 * - sentryMode is 'full'
 * - the browser reports clipboard-read permission as already 'granted'
 *
 * Deliberately never calls navigator.clipboard.readText() unless permission
 * is already granted — a bare focus event is not a user gesture, and
 * prompting for clipboard access every time the user alt-tabs back into the
 * app would be a bad (and in most browsers non-functional) pattern. The
 * actual grant happens once, explicitly, during onboarding.
 *
 * Chrome/Edge only in practice: Firefox and Safari don't support
 * programmatic clipboard reads for unprivileged web content at all, so the
 * permissions query itself throws there and this silently does nothing —
 * which is the honest outcome, not a bug.
 *
 * De-duplicates on clipboard content so repeated focus events with the same
 * copied text don't re-trigger a scan API call each time (the scan API runs
 * against a free-tier quota shared with manual scans).
 */
export function useClipboardMonitor(onThreatDetected?: (url: string, result: ClipboardScanResult) => void) {
  const { user } = useAuth();
  const firestore = useFirestore();
  const lastCheckedRef = useRef<string>('');

  const checkClipboard = useCallback(async () => {
    if (user.sentryMode !== 'full') return;
    if (!('clipboard' in navigator) || !('permissions' in navigator)) return;

    try {
      const perm = await navigator.permissions.query({ name: 'clipboard-read' as PermissionName });
      if (perm.state !== 'granted') return;

      const text = await navigator.clipboard.readText();
      if (!text || text === lastCheckedRef.current) return;
      lastCheckedRef.current = text;

      const urlRegex = /https?:\/\/[^\s]+/g;
      const urls = text.match(urlRegex);
      if (!urls || urls.length === 0) return;

      const url = urls[0];
      const idToken = await getAuth(app).currentUser?.getIdToken();
      if (!idToken) return;

      const response = await fetch('/api/scan/analyze-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
        body: JSON.stringify({ url }),
      });
      if (!response.ok) return;
      const result: ClipboardScanResult = await response.json();

      if (firestore && user.uid) {
        try {
          await addDoc(collection(firestore, 'users', user.uid, 'securityScanResults'), {
            userId: user.uid,
            moduleType: 'link',
            scanTimestamp: new Date().toISOString(),
            alertLevel: alertLevelFromScore(result.risk_score ?? 0),
            summary: `Clipboard auto-scan: ${url} — ${result.reason || result.status || 'analysed'}`,
            createdAt: serverTimestamp(),
          });
        } catch (e) {
          console.error('Failed to log clipboard scan result:', e);
        }
      }

      if (result.status === 'unsafe' || result.status === 'suspicious') {
        onThreatDetected?.(url, result);
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('Da-Costa Sentry Alert', {
            body: `Suspicious link detected: ${url}`,
            icon: '/icons/icon-192x192.png',
          });
        }
      }
    } catch {
      // Clipboard access unavailable/denied — silent, expected in most browsers.
    }
  }, [user.sentryMode, user.uid, firestore, onThreatDetected]);

  useEffect(() => {
    if (user.sentryMode !== 'full') return;
    window.addEventListener('focus', checkClipboard);
    return () => window.removeEventListener('focus', checkClipboard);
  }, [user.sentryMode, checkClipboard]);
}
