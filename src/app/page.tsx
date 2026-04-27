'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useMemoFirebase } from '@/firebase';
import { doc } from 'firebase/firestore';
import { useDoc } from '@/firebase/firestore/use-doc';
import { FirstScreenDisclosure } from '@/components/first-screen-disclosure';
import { Onboarding } from '@/components/onboarding';
import { SplashScreen } from '@/components/splash-screen';
import { Logo } from "@/components/logo";
import { Skeleton } from "@/components/ui/skeleton";

export default function OnboardingRouterPage() {
    const router = useRouter();
    const { user, isUserLoading } = useUser();
    const firestore = useFirestore();

    // Splash screen: show once per session for unauthenticated users
    const [splashDone, setSplashDone] = useState<boolean>(false);

    const userProfileRef = useMemoFirebase(() => {
        if (!firestore || !user) return null;
        return doc(firestore, 'users', user.uid);
    }, [firestore, user]);

    const { data: userProfile, isLoading: isProfileLoading } = useDoc(userProfileRef);

    const isLoading = isUserLoading || (!!user && isProfileLoading);

    useEffect(() => {
        if (!isLoading && user && !user.isAnonymous && userProfile?.onboardingAccepted) {
            const sessionCleared = sessionStorage.getItem('da-costa-onboarding-done');
            if (sessionCleared === user.uid) {
                router.replace('/dashboard');
            }
        }
    }, [isLoading, user, userProfile, router]);

    // Loading skeleton
    if (isLoading) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
              <Logo />
              <Skeleton className="mt-4 h-4 w-48" />
            </div>
        );
    }

    // Redirect in progress — show skeleton
    if (user && !user.isAnonymous && userProfile?.onboardingAccepted && sessionStorage.getItem('da-costa-onboarding-done') === user.uid) {
        return (
            <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
              <Logo />
              <Skeleton className="mt-4 h-4 w-48" />
            </div>
        );
    }

    // Authenticated but onboarding not done
    if (user && !user.isAnonymous) {
        return <Onboarding />;
    }

    // Unauthenticated: show splash first, then FirstScreenDisclosure
    if (!splashDone) {
        return <SplashScreen onEnter={() => setSplashDone(true)} />;
    }

    return <FirstScreenDisclosure />;
}
