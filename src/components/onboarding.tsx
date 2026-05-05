
"use client";
import { DcBackground } from '@/components/dc-background';

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from 'next/image';
import Link from 'next/link';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { ShieldCheck, Zap, Lock, Loader2, Languages } from "lucide-react";
import { onboardingHero } from "@/lib/placeholder-images";
import { Logo } from "./logo";
import { Skeleton } from "./ui/skeleton";
import { useUser, useFirebase } from "@/firebase";
import { collection, addDoc, doc, setDoc, getDoc, updateDoc } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { useLocalization } from "@/hooks/use-localization";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { supportedLanguages } from '@/context/language-provider';

const POLICY_VERSION = "2026.1.0-GP";

export function Onboarding({ isPreview = false }: { isPreview?: boolean }) {
  const router = useRouter();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [flowStep, setFlowStep] = useState<string | null>(null);
  const { auth, firestore } = useFirebase();
  const { user } = useUser();
  const { t, setLocale, locale } = useLocalization();

  useEffect(() => {
    setIsClient(true);
  }, []);

  const logConsent = async (userId: string, mode: 'full' | 'limited', permissions: string[], displayName: string = '') => {
    if (!firestore || !user) return;
    
    const logData = {
      userId,
      timestamp: new Date().toISOString(),
      permissionsGranted: permissions,
      policyVersion: POLICY_VERSION,
      deviceId: "SHA256-HASH-SIMULATED", // In a real app, this would be a unique device hash
      consentType: mode === 'full' ? 'full_enabled' : 'limited_protection'
    };

    // Log to consent audit collection for Google Play Compliance
    await addDoc(collection(firestore, 'users', userId, 'consentLogs'), logData);
    
    const userDocRef = doc(firestore, 'users', userId);
    const docSnap = await getDoc(userDocRef);

    if (docSnap.exists()) {
        // Document exists, just update it with new consent and mode
        await updateDoc(userDocRef, {
            ...(displayName ? { displayName } : {}),
            sentryMode: mode,
            onboardingAccepted: true,
            updatedAt: new Date().toISOString()
        });
    } else {
        // Document doesn't exist, create it with all required default fields
        await setDoc(userDocRef, {
            id: userId,
            displayName: displayName || userId,
            role: "user",
            creditBalance: 10,
            subscriptionStatus: "free",
            sentryMode: mode,
            onboardingAccepted: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
    }
  };

  const simulatePermissionFlow = async () => {
    // Sequential triggers as per Google Play Store guidelines (no bundling)
    const steps = [
      t('onboarding_step1'),
      t('onboarding_step2'),
      t('onboarding_step3'),
      t('onboarding_step4'),
    ];
    
    for (const step of steps) {
      setFlowStep(step);
      await new Promise(resolve => setTimeout(resolve, 1200));
    }
  };

  const handleEnableFullSentry = async () => {
    setIsProcessing(true);
    if (!user) {
        toast({
            variant: "destructive",
            title: "Authentication Error",
            description: "User not found. Please wait a moment and try again."
        });
        setIsProcessing(false);
        return;
    }

    try {
      await simulatePermissionFlow();
      const storedDisplayName = localStorage.getItem('da-costa-display-name') || '';
      logConsent(user.uid, 'full', ['notifications', 'storage', 'foreground_service', 'email'], storedDisplayName).catch(console.error);
      sessionStorage.setItem('da-costa-onboarding-done', user.uid);
      localStorage.removeItem('da-costa-display-name');

      if (!isPreview) {
        router.push("/perimeter-initialized");
      } else {
        toast({
          title: "Sentry Mode Active",
          description: "Background monitoring has been successfully re-validated.",
        });
        router.push("/dashboard/sovereignty");
      }
    } catch (error) {
      console.error("Onboarding error:", error);
      toast({
          variant: "destructive",
          title: "Onboarding Failed",
          description: "Could not complete the setup process. Please try again."
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleContinueLimited = async () => {
    if (isPreview) {
      router.push('/dashboard/sovereignty');
      return;
    }

    setIsProcessing(true);
    if (!user) {
        toast({
            variant: "destructive",
            title: "Authentication Error",
            description: "User not found. Please wait a moment and try again."
        });
        setIsProcessing(false);
        return;
    }
    
    try {
      const storedDisplayName = localStorage.getItem('da-costa-display-name') || '';
      await logConsent(user.uid, 'limited', [], storedDisplayName);
      sessionStorage.setItem('da-costa-onboarding-done', user.uid);
      localStorage.removeItem('da-costa-display-name');
      router.push("/dashboard");
    } catch (error) {
      console.error("Onboarding error:", error);
      toast({
          variant: "destructive",
          title: "Onboarding Failed",
          description: "Could not complete the setup process. Please try again."
      });
    } finally {
      setIsProcessing(false);
    }
  };

  if (!isClient) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-[#060b12]">
        <Logo />
        <Skeleton className="mt-4 h-4 w-48" />
      </div>
    );
  }

    <main className="relative flex min-h-screen w-full flex-col items-center justify-center p-4 py-12 overflow-y-auto bg-[#060b12]">
      <DcBackground />
      <Card className="z-10 w-full max-w-lg animate-in fade-in-50 slide-in-from-bottom-5 duration-500 border-primary/20 bg-[#0a1520]/80 backdrop-blur-md shadow-2xl shadow-primary/10">
        <CardHeader className="items-center text-center space-y-4 pt-8">
          <Logo />
          <div className="space-y-2">
            <CardTitle className="font-headline text-3xl font-bold text-primary tracking-tight">{t('background_header')}</CardTitle>
            <p className="text-sm font-semibold text-accent uppercase tracking-widest">{t('background_subheader')}</p>
          </div>
        </CardHeader>
        <CardContent className="space-y-8 px-8 pb-8">
          <div className="text-sm text-muted-foreground leading-relaxed text-center space-y-4">
            <p>{t('background_description')}</p>
          </div>

          <div className="space-y-6">
            <h3 className="font-bold text-xs text-primary/80 uppercase tracking-widest border-b border-primary/10 pb-2">{t('background_how_we_use_this')}</h3>
            
            <div className="space-y-6">
              <div className="flex items-start gap-4 group">
                <div className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 group-hover:bg-primary/20 transition-colors">
                  <Zap className="size-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-foreground">{t('background_point1_title')}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{t('background_point1_desc')}</p>
                </div>
              </div>

              <div className="flex items-start gap-4 group">
                <div className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 group-hover:bg-primary/20 transition-colors">
                  <ShieldCheck className="size-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-foreground">{t('background_point2_title')}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{t('background_point2_desc')}</p>
                </div>
              </div>

              <div className="flex items-start gap-4 group">
                <div className="mt-1 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 group-hover:bg-primary/20 transition-colors">
                  <Lock className="size-5 text-primary" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-foreground">{t('background_point3_title')}</h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">{t('background_point3_desc')}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center">
            <p className="text-xs text-muted-foreground italic font-medium leading-relaxed">{t('background_disclaimer')}</p>
          </div>

          <div className="flex flex-col gap-4">
             <div className="flex justify-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex items-center gap-2">
                        <Languages className="size-4" />
                        <span>{supportedLanguages.find(l => l.code === locale)?.name || 'Language'}</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center">
                    {supportedLanguages.map((lang) => (
                      <DropdownMenuItem key={lang.code} onSelect={() => setLocale(lang.code)}>
                        {lang.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
            </div>
            {isProcessing && flowStep ? (
              <div className="flex flex-col items-center gap-3 py-4 animate-pulse">
                <Loader2 className="size-6 text-primary animate-spin" />
                <span className="text-xs font-bold text-primary uppercase">{flowStep}</span>
              </div>
            ) : (
              <>
                <Button
                  onClick={handleEnableFullSentry}
                  className="w-full font-bold bg-primary text-primary-foreground hover:bg-primary/90 py-7 text-lg shadow-lg shadow-primary/20 uppercase tracking-tighter"
                  size="lg"
                  disabled={isProcessing}
                >
                  {t('background_button_primary')}
                </Button>
                
                <Button
                  onClick={handleContinueLimited}
                  variant="ghost"
                  className="w-full text-muted-foreground hover:text-foreground text-xs font-bold uppercase tracking-widest"
                  disabled={isProcessing}
                >
                  {t('background_button_secondary')}
                </Button>
              </>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex flex-col gap-4 border-t border-primary/5 bg-muted/20 py-6">
          <div className="flex justify-center gap-8 text-[10px] text-muted-foreground font-bold uppercase tracking-widest">
            <Link href="/privacy-policy?from=onboarding" className="hover:text-primary transition-colors underline decoration-primary/30 underline-offset-4">{t('onboarding_footer_privacy')}</Link>
            <Link href="/terms-of-service?from=onboarding" className="hover:text-primary transition-colors underline decoration-primary/30 underline-offset-4">{t('onboarding_footer_terms')}</Link>
          </div>
          <p className="text-[9px] text-muted-foreground/60 text-center max-w-[80%] mx-auto">
            {t('onboarding_footer_compliance', { policyVersion: POLICY_VERSION, date: new Date().toLocaleDateString(), node: 'NG-SSE-LGS' })}
          </p>
        </CardFooter>
      </Card>
    </main>
  );
}
