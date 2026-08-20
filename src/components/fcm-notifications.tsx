'use client';
import { useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { db } from '@/firebase/config';
import { doc, setDoc } from 'firebase/firestore';

export function FcmNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.uid) return;
    if (!('Notification' in window)) return;
    if (!('serviceWorker' in navigator)) return;
    if (!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY) return;

    async function setupFCM() {
      try {
        const { getMessaging, getToken, onMessage } =
          await import('firebase/messaging');
        const { default: app } =
          await import('@/firebase/config');

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // Reuse the app's own registered service worker (public/sw.js) rather
        // than letting Firebase auto-register a separate firebase-messaging-sw.js —
        // a second SW registration at the same scope would conflict with it.
        const swRegistration = await navigator.serviceWorker.ready;

        const messaging = getMessaging(app);

        const token = await getToken(messaging, {
          vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: swRegistration,
        });

        if (token && user.uid) {
          await setDoc(
            doc(db, 'users', user.uid),
            { fcmToken: token, fcmUpdatedAt: Date.now() },
            { merge: true }
          );
          console.log('[FCM] Token saved for user:', user.uid);
        }

        onMessage(messaging, (payload) => {
          console.log('[FCM] Foreground message:', payload);
          if (payload.notification?.title) {
            new Notification(payload.notification.title, {
              body: payload.notification.body || '',
              icon: '/icons/icon-192x192.png',
            });
          }
        });
      } catch (error) {
        console.error('[FCM] Setup error:', error);
      }
    }

    setupFCM();
  }, [user?.uid]);

  return null;
}
