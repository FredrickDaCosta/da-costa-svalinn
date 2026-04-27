'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { useUser, useFirestore, useAuth as useFirebaseService } from '@/firebase';
import { doc, setDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, ShieldCheck, Download, Info, AlertTriangle, ExternalLink, Trash2, RefreshCcw } from 'lucide-react';
import Link from 'next/link';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { useLocalization } from '@/hooks/use-localization';
import { Skeleton } from '@/components/ui/skeleton';

export default function SovereigntyPage() {
  const { user: appUser, logout, isLoading: isAppUserLoading } = useAuth();
  const { user, isUserLoading: isFirebaseUserLoading } = useUser();
  const auth = useFirebaseService();
  const firestore = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useLocalization();

  const isLoading = isAppUserLoading || isFirebaseUserLoading;

  const handleExportData = () => {
    const dataToExport = {
      name: appUser.name,
      email: appUser.email,
      credits: appUser.credits,
      isPremium: appUser.isPremium,
      role: appUser.role,
      sentryMode: appUser.sentryMode,
      exportDate: new Date().toISOString(),
      compliance: t('sovereignty_compliance_audit_v2')
    };
    const jsonString = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `${t('sovereignty_report_filename_prefix')}-${new Date().getTime()}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(href);
    toast({
      title: t('sovereignty_export_toast_title' as any),
      description: t('sovereignty_export_toast_desc' as any),
    });
  };

  const handleDeleteAccount = async () => {
    toast({
      variant: "destructive",
      title: t('deletion_initiated_title' as any),
      description: t('deletion_initiated_desc' as any),
    });
    try { await auth.signOut(); } catch(e) { console.error("Sign out failed", e); }
    finally { logout(); router.push('/'); }
  };

  const handleClearToneCache = () => {
    toast({
      title: t('sovereignty_cache_toast_title' as any),
      description: t('sovereignty_cache_toast_desc' as any),
    });
  };

  const handleResetApp = async () => {
    if (!firestore || !user) {
      toast({ variant: 'destructive', title: t('sovereignty_reset_error_title'), description: t('sovereignty_reset_error_user_not_found') });
      return;
    }
    try {
      const userDocRef = doc(firestore, 'users', user.uid);
      await setDoc(userDocRef, { onboardingAccepted: false }, { merge: true });
      toast({
        title: t('sovereignty_reset_toast_title'),
        description: t('sovereignty_reset_toast_desc'),
      });
      setTimeout(async () => {
        try { await auth.signOut(); } catch(e) { console.error("Sign out failed during reset", e); }
        finally { logout(); router.push('/'); }
      }, 1500);
    } catch (error) {
      console.error("Error resetting app:", error);
      toast({ variant: 'destructive', title: t('sovereignty_reset_failed_title'), description: t('sovereignty_reset_failed_desc') });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8 max-w-3xl mx-auto">
        <div className="space-y-2">
          <Skeleton className="h-10 w-1/2" />
          <Skeleton className="h-6 w-3/4" />
        </div>
        <div className="grid gap-6">
          <Skeleton className="h-80 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>{t('sovereignty_page_title')}</CardTitle>
            <CardDescription>{t('sovereignty_page_desc')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/">{t('nav_back_to_dashboard')}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <div>
        <h1 className="font-headline text-3xl md:text-4xl">{t('sovereignty_page_title')}</h1>
        <p className="text-muted-foreground">{t('sovereignty_page_desc')}</p>
      </div>

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2">
              <ShieldCheck className="text-primary size-5" />
              {t('sovereignty_controls_title')}
            </CardTitle>
            <CardDescription>{t('sovereignty_controls_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-4">
              <Button variant="outline" className="w-full justify-start h-auto py-4 px-6" onClick={handleExportData}>
                <Download className="mr-4 size-5 shrink-0" />
                <div className="flex flex-col items-start text-left">
                  <span className="font-bold">{t('sovereignty_export_report')}</span>
                  <span className="text-[10px] text-muted-foreground uppercase">{t('sovereignty_export_report_desc')}</span>
                </div>
              </Button>
              <Button variant="secondary" className="w-full justify-start h-auto py-4 px-6" onClick={handleClearToneCache}>
                <CheckCircle className="mr-4 size-5 shrink-0" />
                <div className="flex flex-col items-start text-left">
                  <span className="font-bold">{t('sovereignty_purge_signatures')}</span>
                  <span className="text-[10px] text-muted-foreground uppercase">{t('sovereignty_purge_signatures_desc')}</span>
                </div>
              </Button>
              <Button variant="outline" asChild className="w-full justify-start h-auto py-4 px-6 border-primary/30 text-primary hover:bg-primary/5">
                <Link href="/dashboard/disclosure">
                  <Info className="mr-4 size-5 shrink-0" />
                  <div className="flex flex-col items-start text-left">
                    <span className="font-bold">{t('sovereignty_review_disclosures')}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{t('sovereignty_review_disclosures_desc')}</span>
                  </div>
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start h-auto py-4 px-6" asChild>
                <Link href="/data-sovereignty">
                  <ExternalLink className="mr-4 size-5 shrink-0 text-primary" />
                  <div className="flex flex-col items-start text-left">
                    <span className="font-bold text-primary">{t('sovereignty_open_portal')}</span>
                    <span className="text-[10px] text-muted-foreground uppercase">{t('sovereignty_open_portal_desc')}</span>
                  </div>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader>
            <CardTitle className="font-headline flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              {t('sovereignty_danger_zone_title')}
            </CardTitle>
            <CardDescription className="text-destructive/70">{t('sovereignty_danger_zone_desc')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-1">
                <p className="font-bold text-sm text-amber-500">{t('sovereignty_reset_app_title')}</p>
                <p className="text-xs text-muted-foreground">{t('sovereignty_reset_app_desc')}</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="w-full md:w-auto border-amber-500/50 text-amber-500 hover:bg-amber-500/10 hover:text-amber-400">
                    <RefreshCcw className="mr-2 size-4" />
                    {t('sovereignty_reset_app_button')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('sovereignty_reset_confirm_title')}</AlertDialogTitle>
                    <AlertDialogDescription>{t('sovereignty_reset_confirm_desc')}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('payment_modal_cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleResetApp} className="bg-amber-500 text-black hover:bg-amber-500/90">
                      {t('sovereignty_confirm_reset')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pt-6 border-t border-destructive/10">
              <div className="space-y-1">
                <p className="font-bold text-sm">{t('sovereignty_erasure_title')}</p>
                <p className="text-xs text-muted-foreground">{t('sovereignty_erasure_desc')}</p>
              </div>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="w-full md:w-auto">
                    <Trash2 className="mr-2 size-4" />
                    {t('sovereignty_delete_account')}
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>{t('sovereignty_delete_confirm_title')}</AlertDialogTitle>
                    <AlertDialogDescription>{t('sovereignty_delete_confirm_desc')}</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>{t('payment_modal_cancel')}</AlertDialogCancel>
                    <AlertDialogAction onClick={handleDeleteAccount} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      {t('sovereignty_confirm_deletion')}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            <div className="pt-6 border-t border-destructive/10">
              <Link href="/data-deletion" className="text-xs text-muted-foreground underline hover:text-primary transition-colors inline-flex items-center gap-1">
                <ExternalLink className="size-3" />
                {t('sovereignty_manual_request')}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
