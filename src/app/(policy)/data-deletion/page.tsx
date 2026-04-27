'use client';

import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Trash2, ShieldCheck, Mail } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { useAuth as useFirebaseService } from '@/firebase';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger
} from '@/components/ui/alert-dialog';
import { useLocalization } from '@/hooks/use-localization';

export default function DataDeletionPage() {
  const router = useRouter();
  const { toast } = useToast();
  const { logout } = useAuth();
  const auth = useFirebaseService();
  const { t } = useLocalization();

  const handleDeleteAccount = async () => {
    toast({
      variant: "destructive",
      title: t('deletion_initiated_title' as any),
      description: t('deletion_initiated_desc' as any),
    });
    try { await auth.signOut(); } catch(e) { console.error("Sign out failed", e); }
    finally { logout(); router.push('/'); }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-3xl font-bold">{t('deletion_page_title' as any)}</h1>
        <p className="text-muted-foreground">{t('deletion_page_desc' as any)}</p>
      </div>

      <div className="grid gap-6">
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trash2 className="text-destructive" />
              {t('deletion_request_title' as any)}
            </CardTitle>
            <CardDescription>{t('deletion_request_desc' as any)}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('deletion_local_note' as any)}</p>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="w-full">{t('deletion_initiate_button' as any)}</Button>
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
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck />
              {t('deletion_stateless_title' as any)}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {t('deletion_stateless_body' as any)}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 font-headline">
              <Mail />
              {t('deletion_contact_title' as any)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{t('deletion_contact_email' as any)}</p>
            <p className="text-xs text-muted-foreground mt-2">{t('deletion_contact_response' as any)}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
