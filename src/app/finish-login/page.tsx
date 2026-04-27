'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Logo } from '@/components/logo';
import { Loader2, ShieldCheck, ShieldX } from 'lucide-react';
import { useFirebase } from '@/firebase';
import { completeMagicLinkSignIn } from '@/auth/magic-link';

export default function FinishLoginPage() {
  const router = useRouter();
  const { auth } = useFirebase();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Verifying your secure access link...');

  useEffect(() => {
    if (!auth) return;
    async function handle() {
      const result = await completeMagicLinkSignIn(auth);
      if (result.success) {
        setStatus('success');
        setMessage(`Perimeter secured. Welcome, ${result.displayName || result.userId}.`);
        setTimeout(() => router.replace('/'), 1800);
      } else {
        if (result.error === 'Not a valid sign-in link.') { router.replace('/'); return; }
        setStatus('error');
        setMessage(result.error || 'Access link invalid or expired. Please request a new one.');
        setTimeout(() => router.replace('/'), 3000);
      }
    }
    handle();
  }, [auth, router]);

  return (
    <div className="flex h-screen w-full flex-col items-center justify-center bg-gradient-to-br from-[#0B1426] to-[#111C33] space-y-6 px-4">
      <Logo />
      <div className="flex flex-col items-center gap-3 text-center max-w-xs">
        {status === 'loading' && <Loader2 className="animate-spin text-primary size-8" />}
        {status === 'success' && <ShieldCheck className="text-primary size-8 drop-shadow-[0_0_12px_hsl(var(--primary))]" />}
        {status === 'error' && <ShieldX className="text-destructive size-8" />}
        <p className={`text-sm font-medium ${status === 'error' ? 'text-destructive' : status === 'success' ? 'text-primary' : 'text-muted-foreground'}`}>{message}</p>
      </div>
    </div>
  );
}
