
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, CheckCircle, Info } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth.tsx';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { useLocalization } from '@/hooks/use-localization';

export type PurchaseableItem = {
  name: string;
  price: string;
  scans?: number;
  isSubscription?: boolean;
};

type PaymentModalProps = {
  item: PurchaseableItem | null;
  isOpen: boolean;
  onClose: () => void;
};

export function PaymentModal({ item, isOpen, onClose }: PaymentModalProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const { addCredits, upgradeToPremium } = useAuth();
  const { toast } = useToast();
  const { t } = useLocalization();

  const handlePayment = async () => {
    if (!item || (item.isSubscription && !termsAccepted)) return;

    setIsProcessing(true);
    // Simulate network delay and logging of consent
    await new Promise(resolve => setTimeout(resolve, 1500));

    let toastTitle = t('payment_modal_success_title');
    let toastDescription = '';

    if (item.isSubscription) {
      upgradeToPremium();
      toastTitle = t('payment_modal_success_title');
      toastDescription = t('payment_modal_success_desc_upgrade');
    } else if (item.scans) {
      addCredits(item.scans);
      toastDescription = t('payment_modal_success_desc_credits', { count: item.scans.toString() });
    }

    setIsProcessing(false);
    setIsSuccess(true);

    // Close modal after a delay and show toast
    setTimeout(() => {
      handleClose();
      toast({
        title: toastTitle,
        description: toastDescription,
      });
    }, 2000);
  };

  const handleClose = () => {
    setIsSuccess(false);
    setIsProcessing(false);
    setTermsAccepted(false);
    onClose();
  };

  if (!item) return null;

  return (
    <Dialog open={isOpen} onOpenChange={!isProcessing ? handleClose : () => {}}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('payment_modal_title')}</DialogTitle>
          <DialogDescription>
            {t('payment_modal_desc', { itemName: item.name, itemPrice: item.price })}
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="flex flex-col items-center justify-center gap-4 py-8 text-center">
            <CheckCircle className="size-16 text-green-500" />
            <h3 className="text-xl font-bold">{t('payment_modal_success_title')}</h3>
            <p className="text-muted-foreground">{item.isSubscription ? t('payment_modal_success_desc_upgrade') : t('payment_modal_success_desc_credits', { count: (item.scans || 0).toString() })}</p>
          </div>
        ) : (
          <>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="card-number">{t('payment_modal_card_number')}</Label>
                <Input id="card-number" placeholder="**** **** **** 1234" defaultValue="4242 4242 4242 4242" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expiry">{t('payment_modal_expiry')}</Label>
                  <Input id="expiry" placeholder="MM/YY" defaultValue="12/28" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvc">{t('payment_modal_cvc')}</Label>
                  <Input id="cvc" placeholder="123" defaultValue="123" />
                </div>
              </div>

              {item.isSubscription && (
                <div className="mt-4 space-y-4 rounded-lg border bg-muted/50 p-4">
                  <div className="flex items-start gap-2 text-[10px] leading-tight text-muted-foreground">
                    <Info className="size-3 shrink-0 text-primary mt-0.5" />
                    <div className="space-y-1">
                      <p><strong>{t('payment_modal_terms_title')}</strong> {t('payment_modal_terms_desc')}</p>
                      <Link href="/terms-of-service" target="_blank" className="text-primary underline">{t('payment_modal_terms_link')}</Link>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="terms" 
                      checked={termsAccepted} 
                      onCheckedChange={(checked) => setTermsAccepted(checked as boolean)} 
                    />
                    <label
                      htmlFor="terms"
                      className="text-[11px] font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {t('payment_modal_terms_checkbox')}
                    </label>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={handleClose} disabled={isProcessing}>
                {t('payment_modal_cancel')}
              </Button>
              <Button 
                onClick={handlePayment} 
                disabled={isProcessing || (item.isSubscription && !termsAccepted)}
              >
                {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isProcessing ? t('payment_modal_processing') : t('payment_modal_pay', { price: item.price })}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
