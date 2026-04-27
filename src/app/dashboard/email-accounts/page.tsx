'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Mail, ShieldCheck, RefreshCw, PlusCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLocalization } from '@/hooks/use-localization';

const mockAccounts = [
  { id: '1', email: 'work.email@corporate.com', provider: 'Gmail', status: 'Active', isEnabled: true },
  { id: '2', email: 'personal.fred@outlook.com', provider: 'Outlook', status: 'Re-auth Required', isEnabled: false },
];

export default function EmailAccountsPage() {
  const [accounts, setAccounts] = useState(mockAccounts);
  const { toast } = useToast();
  const { t } = useLocalization();

  const getStatusKey = (status: string) => {
    const key = status.replace(' ', '-').toLowerCase();
    return `email_accounts_status_${key}` as any;
  }

  const toggleMonitoring = (id: string) => {
    setAccounts(prev => prev.map(acc => 
      acc.id === id ? { ...acc, isEnabled: !acc.isEnabled, status: acc.isEnabled ? 'Paused' : 'Active' } : acc
    ));
    toast({
      title: "Settings Updated",
      description: "Background monitoring status changed.",
    });
  };

  const handleLinkNew = () => {
    toast({
      title: "OAuth2 Portal Opening",
      description: "Redirecting to secure login for account verification...",
    });
  };

  const handleResync = (id: string) => {
    const account = accounts.find(a => a.id === id);
    if (!account) return;

    toast({
      title: "Syncing Account",
      description: `Refreshing connection for ${account.email}...`,
    });

    setAccounts(prev => prev.map(acc => 
      acc.id === id ? { ...acc, status: 'Syncing' } : acc
    ));

    // Simulate async sync process (refreshing OAuth tokens and IMAP connection)
    setTimeout(() => {
      setAccounts(prev => prev.map(acc => 
        acc.id === id ? { ...acc, status: 'Active', isEnabled: true } : acc
      ));
      toast({
        title: "Sync Complete",
        description: "Secure connection re-established.",
      });
    }, 1500);
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-3xl md:text-4xl">{t('email_accounts_page_title')}</h1>
          <p className="text-muted-foreground">{t('email_accounts_page_desc')}</p>
        </div>
        <Button onClick={handleLinkNew}>
          <PlusCircle className="mr-2 h-4 w-4" /> {t('email_accounts_link_new_button')}
        </Button>
      </div>

      <div className="grid gap-6">
        {accounts.map((acc) => (
          <Card key={acc.id} className={acc.status === 'Re-auth Required' ? 'border-destructive/50' : ''}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <CardTitle className="text-xl">{acc.email}</CardTitle>
                  <CardDescription>{acc.provider} (IMAP IDLE Push Enabled)</CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-4">
                 <div className="text-right mr-4">
                    <p className="text-sm font-medium">{t('email_accounts_monitoring_status')}</p>
                    <Badge variant={acc.status === 'Active' ? 'default' : acc.status === 'Paused' ? 'secondary' : acc.status === 'Syncing' ? 'outline' : 'destructive'}>
                      {t(getStatusKey(acc.status))}
                    </Badge>
                 </div>
                 <Switch 
                    checked={acc.isEnabled} 
                    onCheckedChange={() => toggleMonitoring(acc.id)}
                    disabled={acc.status === 'Syncing'}
                 />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mt-4 rounded-lg bg-muted/50 p-4">
                <div className="flex items-center gap-2 text-sm">
                  {acc.status === 'Active' ? (
                    <ShieldCheck className="text-primary size-4" />
                  ) : acc.status === 'Syncing' ? (
                    <Loader2 className="text-primary size-4 animate-spin" />
                  ) : (
                    <AlertCircle className="text-destructive size-4" />
                  )}
                  <span>
                    {acc.status === 'Active' && t('email_accounts_scanning_desc')}
                    {acc.status === 'Syncing' && t('email_accounts_reauth_desc')}
                    {acc.status === 'Paused' && t('email_accounts_paused_desc')}
                    {acc.status === 'Re-auth Required' && t('email_accounts_expired_desc')}
                  </span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleResync(acc.id)}
                  disabled={acc.status === 'Syncing'}
                >
                  <RefreshCw className={`mr-2 h-4 w-4 ${acc.status === 'Syncing' ? 'animate-spin' : ''}`} /> 
                  {acc.status === 'Syncing' ? t('email_accounts_syncing_button_text') : t('email_accounts_resync_button')}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-primary/5 border-primary/20">
        <CardHeader>
          <CardTitle className="font-headline text-lg flex items-center gap-2">
            <ShieldCheck className="text-primary" /> {t('email_accounts_why_link_title')}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-2">
          <p dangerouslySetInnerHTML={{ __html: t('email_accounts_why_link_desc') }} />
          <ul className="list-disc list-inside text-muted-foreground space-y-1">
            <li>{t('email_accounts_why_link_li1')}</li>
            <li>{t('email_accounts_why_link_li2')}</li>
            <li>{t('email_accounts_why_link_li3')}</li>
            <li>{t('email_accounts_why_link_li4')}</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
