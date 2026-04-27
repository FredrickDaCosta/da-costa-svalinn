'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Shield, Loader2, KeyRound, UserPlus, ChevronDown, Mail, Fingerprint, CheckCircle2, ScanFace } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useLocalization } from '@/hooks/use-localization';
import { useFirebase } from '@/firebase';
import { registerPasskey, registerBiometric, authenticatePasskey } from '@/auth/passkey';
import { sendMagicLink } from '@/auth/magic-link';
import { type Locale, supportedLanguages } from '@/context/language-provider';

const LANGUAGE_FLAGS: Record<Locale, string> = {
  en: '🇬🇧',
  yo: '🇳🇬', 
  ig: '🇳🇬', 
  ha: '🇳🇬', 
  pidgin: '🇳🇬',
  sw: '🇹🇿', 
  zu: '🇿🇦', 
  fr: '🇫🇷', 
  ar: '🇸🇦',
  'en-US': '🇺🇸',
  am: '🇪🇹',
  af: '🇿🇦',
  pt: '🇧🇷',
  es: '🇪🇸',
  zh: '🇨🇳',
  hi: '🇮🇳',
  de: '🇩🇪',
  tr: '🇹🇷',
  id: '🇮🇩',
  no: '🇳🇴',
  sv: '🇸🇪',
  fi: '🇫🇮',
  it: '🇮🇹',
  ga: '🇮🇪',
  xh: '🇿🇦',
  rw: '🇷🇼',
  so: '🇸🇴',
  ti: '🇪🇷',
  sn: '🇿🇼',
  st: '🇱🇸',
  tn: '🇧🇼',
  lg: '🇺🇬',
  ny: '🇲🇼',
  wo: '🇸🇳',
  bm: '🇲🇱',
};

type AuthMode = 'choice' | 'passkey-register' | 'fingerprint-register' | 'faceid-register' | 'passkey-login' | 'magic-link' | 'magic-sent';

export function FirstScreenDisclosure() {
  const { t, setLocale, locale } = useLocalization();
  const router = useRouter();
  const { auth } = useFirebase();
  const [isProcessing, setIsProcessing] = useState(false);
  const [authMode, setAuthMode] = useState<AuthMode>('choice');
  const [userId, setUserId] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [showLangMenu, setShowLangMenu] = useState(false);
  const { toast } = useToast();

  const currentFlag = LANGUAGE_FLAGS[locale] || '🌐';
  const currentLangName = supportedLanguages.find(l => l.code === locale)?.name || 'English';
  const isRTL = locale === 'ar';

  const handleRegister = async () => {
    const uid = userId.trim(), dn = displayName.trim();
    if (!uid || !dn) { toast({ variant:'destructive', title:t('firstscreen_missing_info_title'), description:t('firstscreen_missing_info_desc') }); return; }
    if (uid.length > 20) { toast({ variant:'destructive', title:t('auth_userid_too_long_title'), description:t('auth_userid_too_long_desc') }); return; }
    if (!/^[a-zA-Z0-9-]+$/.test(uid)) { toast({ variant:'destructive', title:t('auth_userid_invalid_title'), description:t('auth_userid_invalid_desc') }); return; }
    setIsProcessing(true);
    const r = await registerPasskey(auth, uid, dn);
    if (r.success) { localStorage.setItem('da-costa-display-name', dn); toast({ title:t('firstscreen_passkey_registered_title'), description:t('firstscreen_passkey_registered_desc') }); setAuthMode('passkey-login'); }
    else toast({ variant:'destructive', title:t('firstscreen_registration_failed'), description:r.errorKey ? t(r.errorKey as any) : (r.error||t('firstscreen_could_not_register')) });
    setIsProcessing(false);
  };

  const handleFingerprintRegister = async () => {
    const uid = userId.trim(), dn = displayName.trim();
    if (!uid || !dn) { toast({ variant:'destructive', title:t('firstscreen_missing_info_title'), description:t('firstscreen_missing_info_desc') }); return; }
    if (uid.length > 20) { toast({ variant:'destructive', title:t('auth_userid_too_long_title'), description:t('auth_userid_too_long_desc') }); return; }
    if (!/^[a-zA-Z0-9-]+$/.test(uid)) { toast({ variant:'destructive', title:t('auth_userid_invalid_title'), description:t('auth_userid_invalid_desc') }); return; }
    setIsProcessing(true);
    const r = await registerBiometric(auth, uid, dn);
    if (r.success) { localStorage.setItem('da-costa-display-name', dn); toast({ title:t('firstscreen_fingerprint_registered_title'), description:t('firstscreen_fingerprint_registered_desc') }); setAuthMode('passkey-login'); }
    else toast({ variant:'destructive', title:t('firstscreen_registration_failed'), description:r.errorKey ? t(r.errorKey as any) : (r.error||t('firstscreen_could_not_register')) });
    setIsProcessing(false);
  };

  const handleFaceIdRegister = async () => {
    const uid = userId.trim(), dn = displayName.trim();
    if (!uid || !dn) { toast({ variant:'destructive', title:t('firstscreen_missing_info_title'), description:t('firstscreen_missing_info_desc') }); return; }
    if (uid.length > 20) { toast({ variant:'destructive', title:t('auth_userid_too_long_title'), description:t('auth_userid_too_long_desc') }); return; }
    if (!/^[a-zA-Z0-9-]+$/.test(uid)) { toast({ variant:'destructive', title:t('auth_userid_invalid_title'), description:t('auth_userid_invalid_desc') }); return; }
    setIsProcessing(true);
    const r = await registerBiometric(auth, uid, dn);
    if (r.success) { localStorage.setItem('da-costa-display-name', dn); toast({ title:t('firstscreen_faceid_registered_title'), description:t('firstscreen_faceid_registered_desc') }); setAuthMode('passkey-login'); }
    else {
      // Face ID specific error — show helpful message
      const errKey = r.errorKey === 'auth_error_not_allowed' ? 'firstscreen_faceid_not_supported' : r.errorKey;
      const errDesc = r.errorKey === 'auth_error_not_allowed' ? t('firstscreen_faceid_not_supported_desc') : (r.errorKey ? t(r.errorKey as any) : (r.error||t('firstscreen_could_not_register')));
      toast({ variant:'destructive', title:t((errKey || 'firstscreen_registration_failed') as any), description:errDesc });
    }
    setIsProcessing(false);
  };

  const handleLogin = async () => {
    const uid = userId.trim();
    if (!uid) { toast({ variant:'destructive', title:t('firstscreen_missing_userid_title'), description:t('firstscreen_missing_userid_desc') }); return; }
    setIsProcessing(true);
    const r = await authenticatePasskey(auth, uid);
    if (r.success) { toast({ title:t('firstscreen_welcome_title'), description:t('firstscreen_welcome_desc') }); router.replace('/'); }
    else toast({ variant:'destructive', title:t('firstscreen_auth_failed'), description:r.errorKey ? t(r.errorKey as any) : (r.error||t('firstscreen_could_not_auth')) });
    setIsProcessing(false);
  };

  const handleMagicLink = async () => {
    const e = email.trim(), dn = displayName.trim();
    if (!e || !dn) { toast({ variant:'destructive', title:t('firstscreen_missing_info_title'), description:t('firstscreen_magic_missing_desc') }); return; }
    setIsProcessing(true);
    const r = await sendMagicLink(auth, e, dn, dn);
    if (r.success) setAuthMode('magic-sent');
    else toast({ variant:'destructive', title:t('firstscreen_magic_failed_title'), description:r.error||t('firstscreen_magic_failed_desc') });
    setIsProcessing(false);
  };

  const resetForm = () => { setUserId(''); setDisplayName(''); setEmail(''); setAuthMode('choice'); };

  const UserIdField = (
    <div className='space-y-1.5'>
      <Label htmlFor='userId' className='text-xs font-semibold uppercase tracking-widest text-muted-foreground'>{t('firstscreen_userid_label')}</Label>
      <Input id='userId' placeholder='e.g. fredrick-dacosta' value={userId} onChange={e=>setUserId(e.target.value)} disabled={isProcessing} className='border-primary/20 bg-background/50 h-11' dir='ltr' />
    </div>
  );
  const DisplayNameField = (
    <div className='space-y-1.5'>
      <Label htmlFor='displayName' className='text-xs font-semibold uppercase tracking-widest text-muted-foreground'>{t('firstscreen_displayname_label')}</Label>
      <Input id='displayName' placeholder='e.g. Fredrick Adewale Da-Costa' value={displayName} onChange={e=>setDisplayName(e.target.value)} disabled={isProcessing} className='border-primary/20 bg-background/50 h-11' dir='ltr' />
    </div>
  );
  const EmailField = (
    <div className='space-y-1.5'>
      <Label htmlFor='email' className='text-xs font-semibold uppercase tracking-widest text-muted-foreground'>{t('firstscreen_email_label')}</Label>
      <Input id='email' type='email' placeholder='e.g. fredrick@example.com' value={email} onChange={e=>setEmail(e.target.value)} disabled={isProcessing} className='border-primary/20 bg-background/50 h-11' dir='ltr' />
    </div>
  );
  const BackBtn = <Button onClick={resetForm} variant='ghost' className='w-full text-muted-foreground text-xs uppercase tracking-widest' disabled={isProcessing}>{t('firstscreen_back_btn')}</Button>;

  const getTitle = () => {
    switch(authMode) {
      case 'fingerprint-register': return t('firstscreen_fingerprint_title');
      case 'faceid-register': return t('firstscreen_faceid_title');
      case 'biometric-register' as any: return t('firstscreen_biometric_register_title');
      case 'passkey-register': return t('firstscreen_register_title');
      case 'passkey-login': return t('firstscreen_perimeter_title');
      case 'magic-link': return t('firstscreen_magic_title');
      case 'magic-sent': return t('firstscreen_magic_sent_title');
      default: return t('firstscreen_header');
    }
  };

  const getSubtitle = () => {
    switch(authMode) {
      case 'fingerprint-register': return t('firstscreen_fingerprint_subtitle');
      case 'faceid-register': return t('firstscreen_faceid_subtitle');
      case 'passkey-register': return t('firstscreen_register_subtitle');
      case 'passkey-login': return t('firstscreen_perimeter_subtitle');
      case 'magic-link': return t('firstscreen_magic_subtitle');
      case 'magic-sent': return t('firstscreen_magic_sent_subtitle');
      default: return null;
    }
  };

  return (
    <main dir={isRTL?'rtl':'ltr'} className='relative flex min-h-screen w-full flex-col items-center justify-center p-4 py-12 overflow-y-auto bg-gradient-to-br from-[#0B1426] to-[#111C33]'>
      <div className='absolute inset-0 z-0 opacity-5 pointer-events-none'><div className='absolute inset-0 bg-primary/40 blur-3xl'/></div>

      {/* Language Switcher */}
      <div className='absolute top-4 right-4 z-20'>
        <div className='relative'>
          <button onClick={()=>setShowLangMenu(p=>!p)} className='flex items-center gap-1.5 rounded-lg border border-primary/30 bg-card/80 px-3 py-2 text-xs font-medium text-foreground backdrop-blur-sm hover:border-primary/60 hover:bg-card transition-all'>
            <span className='text-base leading-none'>{currentFlag}</span>
            <span className='hidden sm:inline'>{currentLangName}</span>
            <ChevronDown className='size-3 text-muted-foreground'/>
          </button>
          {showLangMenu && (
            <div className='absolute right-0 top-full mt-1 z-30 w-44 rounded-xl border border-primary/20 bg-card shadow-2xl shadow-black/40 overflow-hidden'>
              {supportedLanguages.map(lang=>(
                <button key={lang.code} onClick={()=>{setLocale(lang.code as Locale);setShowLangMenu(false);}} className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-sm transition-colors hover:bg-primary/10 ${lang.code===locale?'bg-primary/15 text-primary font-semibold':'text-foreground'}`}>
                  <span className='text-base'>{LANGUAGE_FLAGS[lang.code as Locale]}</span>
                  <span>{lang.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <Card className='z-10 w-full max-w-md border-primary/20 bg-card/95 shadow-2xl shadow-primary/20'>
        <CardHeader className='items-center text-center space-y-3 pt-8 pb-2'>
          <div className='flex items-center justify-center gap-2'>
            <Shield className='size-10 text-primary drop-shadow-[0_0_12px_hsl(var(--primary))]'/>
            <span className='font-headline text-xl font-bold text-primary tracking-tight'>{t('firstscreen_brand')}</span>
          </div>
          <h1 className='font-headline text-2xl font-bold text-foreground tracking-tight leading-snug'>
            {getTitle()}
          </h1>
          {authMode === 'choice' ? (
            <div className="text-center text-xs text-muted-foreground/80 font-medium leading-relaxed px-1 pt-1">
              <p>{t('firstscreen_description_line1' as any)}</p>
              <p>{t('firstscreen_description_line2' as any)}</p>
            </div>
          ) : (
            <p className='text-sm text-muted-foreground px-2 leading-relaxed'>{getSubtitle()}</p>
          )}
        </CardHeader>

        <CardContent className='space-y-4 px-6 pb-8 pt-3'>

          {/* CHOICE SCREEN */}
          {authMode==='choice' && (
            <div className='flex flex-col gap-3'>
              <p className='text-center text-xs text-muted-foreground/80 font-medium leading-relaxed px-1 pt-1'>{t('firstscreen_consent')}</p>

              {/* Biometric Section */}
              <div className='flex items-center gap-2 py-1'>
                <div className='h-px flex-1 bg-border/40'/>
                <span className='text-[10px] uppercase tracking-widest text-muted-foreground font-semibold'>{t('firstscreen_biometric_section')}</span>
                <div className='h-px flex-1 bg-border/40'/>
              </div>
              <div className='flex justify-center py-1'>
                <Fingerprint className='size-12 text-primary drop-shadow-[0_0_16px_hsl(var(--primary))]'/>
              </div>
              <p className='text-center text-xs text-muted-foreground italic leading-relaxed'>{t('firstscreen_biometric_tagline')}</p>

              {/* TWO BIOMETRIC BUTTONS SIDE BY SIDE */}
              <div className='grid grid-cols-2 gap-3'>
                <Button
                  onClick={()=>setAuthMode('fingerprint-register')}
                  className='w-full font-bold bg-primary text-primary-foreground py-6 text-xs uppercase tracking-tighter flex flex-col items-center gap-1.5 h-auto'
                  size='lg'
                >
                  <Fingerprint className='size-7 shrink-0'/>
                  <span>{t('firstscreen_fingerprint_btn')}</span>
                </Button>
                <Button
                  onClick={()=>setAuthMode('faceid-register')}
                  className='w-full font-bold bg-primary/80 text-primary-foreground py-6 text-xs uppercase tracking-tighter flex flex-col items-center gap-1.5 h-auto hover:bg-primary'
                  size='lg'
                >
                  <ScanFace className='size-7 shrink-0'/>
                  <span>{t('firstscreen_faceid_btn')}</span>
                </Button>
              </div>

              {/* Passkey & Auth buttons */}
              <Button onClick={()=>setAuthMode('passkey-register')} variant='outline' className='w-full font-bold py-6 text-sm uppercase tracking-tighter border-primary/30' size='lg'>
                <UserPlus className='mr-2 size-4 shrink-0'/>{t('firstscreen_register_btn')}
              </Button>
              <Button onClick={()=>setAuthMode('passkey-login')} variant='outline' className='w-full font-bold py-7 text-base uppercase tracking-tighter border-primary/30' size='lg'>
                <KeyRound className='mr-2 size-5 shrink-0'/>{t('firstscreen_perimeter_btn')}
              </Button>

              {/* Email Section */}
              <div className='flex items-center gap-2 pt-1'>
                <div className='h-px flex-1 bg-border/40'/>
                <span className='text-[10px] uppercase tracking-widest text-muted-foreground font-semibold'>{t('firstscreen_email_section')}</span>
                <div className='h-px flex-1 bg-border/40'/>
              </div>
              <Button onClick={()=>setAuthMode('magic-link')} variant='ghost' className='w-full font-semibold py-6 text-sm border border-dashed border-primary/25 hover:border-primary/50 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-all' size='lg'>
                <Mail className='mr-2 size-4 shrink-0 text-primary'/>{t('firstscreen_magic_btn')}
              </Button>
              <p className='text-center text-[10px] text-muted-foreground/70 leading-relaxed px-2 pt-1'>{t('firstscreen_fido2_reassurance')}</p>
            </div>
          )}

          {/* FINGERPRINT REGISTER */}
          {authMode==='fingerprint-register' && (
            <div className='space-y-4'>
              <div className='flex justify-center pb-1'>
                <Fingerprint className='size-10 text-primary drop-shadow-[0_0_14px_hsl(var(--primary))]'/>
              </div>
              {UserIdField}{DisplayNameField}
              <Button onClick={handleFingerprintRegister} disabled={isProcessing} className='w-full font-bold bg-primary py-7 text-base uppercase tracking-tighter' size='lg'>
                {isProcessing?<Loader2 className='mr-2 animate-spin'/>:<Fingerprint className='mr-2 size-5 shrink-0'/>}{t('firstscreen_fingerprint_btn')}
              </Button>
              {BackBtn}
            </div>
          )}

          {/* FACE ID REGISTER */}
          {authMode==='faceid-register' && (
            <div className='space-y-4'>
              <div className='flex justify-center pb-1'>
                <ScanFace className='size-10 text-primary drop-shadow-[0_0_14px_hsl(var(--primary))]'/>
              </div>
              {UserIdField}{DisplayNameField}
              <Button onClick={handleFaceIdRegister} disabled={isProcessing} className='w-full font-bold bg-primary py-7 text-base uppercase tracking-tighter' size='lg'>
                {isProcessing?<Loader2 className='mr-2 animate-spin'/>:<ScanFace className='mr-2 size-5 shrink-0'/>}{t('firstscreen_faceid_btn')}
              </Button>
              {BackBtn}
            </div>
          )}

          {/* PASSKEY REGISTER */}
          {authMode==='passkey-register' && (
            <div className='space-y-4'>
              <div className='flex justify-center pb-1'><Fingerprint className='size-10 text-primary drop-shadow-[0_0_14px_hsl(var(--primary))]'/></div>
              {UserIdField}{DisplayNameField}
              <Button onClick={handleRegister} disabled={isProcessing} className='w-full font-bold bg-primary py-7 text-base uppercase tracking-tighter' size='lg'>
                {isProcessing?<Loader2 className='mr-2 animate-spin'/>:<UserPlus className='mr-2 size-5 shrink-0'/>}{t('firstscreen_create_passkey_btn')}
              </Button>
              {BackBtn}
            </div>
          )}

          {/* PASSKEY LOGIN */}
          {authMode==='passkey-login' && (
            <div className='space-y-4'>
              <div className='flex justify-center pb-1'><Fingerprint className='size-10 text-primary drop-shadow-[0_0_14px_hsl(var(--primary))]'/></div>
              {UserIdField}
              <Button onClick={handleLogin} disabled={isProcessing} className='w-full font-bold bg-primary py-7 text-base uppercase tracking-tighter' size='lg'>
                {isProcessing?<Loader2 className='mr-2 animate-spin'/>:<Shield className='mr-2 size-5 shrink-0'/>}{t('firstscreen_authenticate_btn')}
              </Button>
              {BackBtn}
            </div>
          )}

          {/* MAGIC LINK */}
          {authMode==='magic-link' && (
            <div className='space-y-4'>
              <div className='flex justify-center pb-1'><Mail className='size-10 text-primary drop-shadow-[0_0_14px_hsl(var(--primary))]'/></div>
              {DisplayNameField}{EmailField}
              <Button onClick={handleMagicLink} disabled={isProcessing} className='w-full font-bold bg-primary py-7 text-base uppercase tracking-tighter' size='lg'>
                {isProcessing?<Loader2 className='mr-2 animate-spin'/>:<Mail className='mr-2 size-5 shrink-0'/>}{t('firstscreen_magic_send_btn')}
              </Button>
              {BackBtn}
            </div>
          )}

          {/* MAGIC SENT */}
          {authMode==='magic-sent' && (
            <div className='flex flex-col items-center gap-4 py-4 text-center'>
              <CheckCircle2 className='size-14 text-primary drop-shadow-[0_0_16px_hsl(var(--primary))]'/>
              <p className='text-sm text-muted-foreground leading-relaxed px-2'>{t('firstscreen_magic_sent_body')} <span className='text-foreground font-semibold'>{email}</span></p>
              <p className='text-xs text-muted-foreground/70 italic'>{t('firstscreen_magic_sent_note')}</p>
              <Button onClick={resetForm} variant='ghost' className='text-xs text-muted-foreground uppercase tracking-widest'>{t('firstscreen_back_btn')}</Button>
            </div>
          )}

          <div className='flex justify-center pt-1 border-t border-border/20'>
            <Link href='/privacy-policy?from=onboarding' className='text-xs text-muted-foreground underline hover:text-primary transition-colors'>{t('firstscreen_privacy_link')}</Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
