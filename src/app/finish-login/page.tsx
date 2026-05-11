'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/logo';
import { Loader2, ShieldCheck, ShieldX } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { completeMagicLinkSignIn } from '@/auth/magic-link';
import { doc, setDoc, getDoc } from 'firebase/firestore';

export default function FinishLoginPage() {
  const router = useRouter();
  const { auth, firestore } = useFirebase();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('Verifying your secure access link...');

  useEffect(() => {
    if (!auth || !firestore) return;
    async function handle() {
      const result = await completeMagicLinkSignIn(auth);
      if (result.success) {
        setStatus('success');
        setMessage('Perimeter secured. Welcome, ' + (result.displayName || result.userId) + '.');
        try {
          const user = auth.currentUser;
          if (user) {
            const userRef = doc(firestore, 'users', user.uid);
            const snap = await getDoc(userRef);
            if (!snap.exists()) {
              await setDoc(userRef, {
                id: user.uid,
                displayName: result.displayName || result.userId || user.uid,
                email: user.email || '',
                role: 'user',
                creditBalance: 10,
                subscriptionStatus: 'free',
                sentryMode: 'limited',
                onboardingAccepted: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
              });
            } else {
              await setDoc(userRef, {
                displayName: result.displayName || snap.data().displayName,
                updatedAt: new Date().toISOString(),
              }, { merge: true });
            }
            sessionStorage.setItem('da-costa-magic-login', user.uid);
          }
        } catch (e) {
          console.error('Firestore update error:', e);
        }
        setTimeout(() => router.replace('/'), 1800);
      } else {
        if (result.error === 'Not a valid sign-in link.') { router.replace('/'); return; }
        setStatus('error');
        setMessage(result.error || 'Access link invalid or expired. Please request a new one.');
        setTimeout(() => router.replace('/'), 3000);
      }
    }
    handle();
  }, [auth, firestore, router]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-gradient-to-br from-[#0B1426] to-[#111C33] space-y-6 px-4">
      <Logo />
      <div className="flex flex-col items-center gap-3 text-center max-w-xs">
        {status === 'loading' && <Loader2 className="animate-spin text-primary size-8" />}
        {status === 'success' && <ShieldCheck className="text-primary size-8" />}
        {status === 'error' && <ShieldX className="text-destructive size-8" />}
        <p className={"text-sm font-medium " + (status === 'error' ? 'text-destructive' : status === 'success' ? 'text-primary' : 'text-muted-foreground')}>{message}</p>
      </div>
    </div>
  );
}