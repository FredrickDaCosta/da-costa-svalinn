'use client';

import { useEffect, useCallback } from 'react';
import type { PropsWithChildren } from 'react';
import { BannerAd } from "@/components/dashboard/banner-ad";
import { useRouter } from 'next/navigation';
import {
  Sidebar,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import { UserNav } from '@/components/dashboard/user-nav';
import { MainNav } from '@/components/dashboard/main-nav';
import { Logo } from '@/components/logo';
import { AuthProvider, useAuth } from '@/hooks/use-auth.tsx';
import { Shield } from 'lucide-react';
import { AISecurityAssistant } from '@/components/dashboard/ai-security-assistant';
import { useLocalization } from '@/hooks/use-localization';
import { Skeleton } from '@/components/ui/skeleton';

function DashboardLayoutContent({ children }: PropsWithChildren) {
  const { t } = useLocalization();
  const { user, isLoading } = useAuth();
  const router = useRouter();

  // Strong auth guard
  useEffect(() => {
    if (!isLoading && (!user.email || user.role === 'guest')) {
      sessionStorage.removeItem('da-costa-onboarding-done');
      router.replace('/');
    }
  }, [isLoading, user, router]);

  // Block back-button after logout
  useEffect(() => {
    window.history.pushState(null, '', window.location.href);
    const blockBack = () => {
      if (!user.email || user.role === 'guest') {
        sessionStorage.removeItem('da-costa-onboarding-done');
        router.replace('/');
      } else {
        window.history.pushState(null, '', window.location.href);
      }
    };
    window.addEventListener('popstate', blockBack);
    return () => window.removeEventListener('popstate', blockBack);
  }, [user, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
        <Logo />
        <Skeleton className="mt-4 h-4 w-48" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <Logo />
        </SidebarHeader>
        <MainNav />
      </Sidebar>
      <SidebarInset className="flex flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center justify-between gap-4 border-b bg-background/80 px-4 backdrop-blur-sm sm:px-6">
          <div className="flex items-center gap-4">
            <SidebarTrigger className="md:hidden" />
            {user.sentryMode === 'full' && (
              <div className="hidden md:flex items-center gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-primary shadow-[0_0_12px_0px_hsl(var(--primary)/0.3)] animate-pulse">
                <Shield className="size-4" />
                <span className="text-xs font-bold tracking-wider">{t('nav_sentry_active')}</span>
              </div>
            )}
          </div>
          <div className="flex-1"></div>
          <UserNav />
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 md:pb-16">
          {children}
        </main>
        {/* Banner Ad — sticky bottom, only for free users, never blocks scan buttons */}
        <AISecurityAssistant />
        <div className="sticky bottom-0 z-20 w-full flex justify-center py-2 border-t border-border/30 bg-background/95 backdrop-blur-sm">
          <BannerAd />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default function DashboardLayout({ children }: PropsWithChildren) {
  return (
    <AuthProvider>
      <DashboardLayoutContent>{children}</DashboardLayoutContent>
    </AuthProvider>
  );
}
