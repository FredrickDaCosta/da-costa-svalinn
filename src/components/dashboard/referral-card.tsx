'use client';
/**
 * Referral Card
 *
 * Shows the user's referral code and allows them to apply a referral code.
 * Both parties earn credits. Part of the reward-based monetization system.
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Users, Copy, Check, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';

export function ReferralCard() {
  const { user, applyReferral } = useAuth();
  const { toast } = useToast();
  const [inputCode, setInputCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [copied, setCopied] = useState(false);

  // Generate a stable referral code from the user's UID
  const referralCode = useMemo(() => {
    if (user.referralCode) return user.referralCode;
    // Generate from UID hash
    const hash = user.uid.slice(0, 8).toUpperCase();
    return `DCS-${hash}`;
  }, [user.uid, user.referralCode]);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(referralCode);
    setCopied(true);
    toast({ title: 'Copied!', description: 'Referral code copied to clipboard.' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApply = async () => {
    if (!inputCode.trim() || applying) return;
    setApplying(true);
    const success = await applyReferral(inputCode.trim());
    if (success) {
      toast({
        title: 'Referral Applied!',
        description: `+3 credits earned! You and your friend both received bonus credits.`,
      });
      setInputCode('');
    } else {
      toast({
        variant: 'destructive',
        title: 'Invalid Code',
        description: 'This referral code is invalid or already used.',
      });
    }
    setApplying(false);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Users className="size-4 text-primary" />
          Referral Program
          <Badge variant="secondary" className="ml-auto">+3 credits each</Badge>
        </CardTitle>
        <CardDescription>Share your code with friends to earn credits</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Your code */}
        <div className="flex items-center gap-2">
          <div className="flex-1 font-mono text-sm bg-muted/50 px-3 py-2 rounded">
            {referralCode}
          </div>
          <Button variant="ghost" size="sm" onClick={handleCopy}>
            {copied ? <Check className="size-4 text-green-500" /> : <Copy className="size-4" />}
          </Button>
        </div>

        {/* Apply a code */}
        {!user.referredBy ? (
          <div className="flex items-center gap-2">
            <Input
              placeholder="Enter referral code"
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              className="text-sm"
            />
            <Button size="sm" onClick={handleApply} disabled={applying || !inputCode.trim()}>
              {applying ? <Loader2 className="animate-spin size-4" /> : 'Apply'}
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Referred by: {user.referredBy}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
