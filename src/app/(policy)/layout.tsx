'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Logo } from '@/components/logo';
import { useLocalization } from '@/hooks/use-localization';
import { Skeleton } from '@/components/ui/skeleton';
import { AuthProvider } from '@/hooks/use-auth';

function PolicyLayoutContent({ children }: { children: React.ReactNode }) {
  const { t } = useLocalization();
  const searchParams = useSearchParams();
  const fromOnboarding = searchParams.get('from') === 'onboarding';

  // The root page '/' handles routing to the correct onboarding step.
  const backHref = fromOnboarding ? '/' : '/dashboard';
  
  const backButtonTextKey = fromOnboarding ? 'nav_back_to_setup' : 'nav_back_to_dashboard';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
        <Logo />
        <Button asChild variant="outline">
          <Link href={backHref}>
            <ArrowLeft className="mr-2" />
            {t(backButtonTextKey as any)}
          </Link>
        </Button>
      </header>
      <main className="mx-auto max-w-3xl p-4 sm:p-6 md:p-8">
        <div className="space-y-6">{children}</div>
      </main>
    </div>
  );
}

function PolicyLayoutSkeleton() {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <header className="sticky top-0 z-10 flex h-16 items-center justify-between border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
                <Logo />
                <Skeleton className="h-10 w-48" />
            </header>
            <main className="mx-auto max-w-3xl p-4 sm:p-6 md:p-8">
                <div className="space-y-6">
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-96 w-full" />
                </div>
            </main>
        </div>
    );
}

export default function PolicyLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <Suspense fallback={<PolicyLayoutSkeleton />}>
        <PolicyLayoutContent>{children}</PolicyLayoutContent>
      </Suspense>
    </AuthProvider>
  );
}
