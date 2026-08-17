'use client';
// v1.1.0 — 6 scan modules including SMS & Deepfake

import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useLocalization } from '@/hooks/use-localization';
import { useAuth } from '@/hooks/use-auth';
import type {
  SmartLinkScrutinizerAnalysisOutput,
  StatusLureDetectorOutput,
  VideoMetadataRiskAssessmentOutput,
  EmailToneAnalysisOutput,
  SmsCallShieldOutput,
  DeepfakeAudioOutput,
} from '@/lib/actions';
import { preprocessImage, extractFileHeader } from '@/lib/utils';
import { measureTrace, PerfTraces } from '@/firebase/performance';
import { Link as LinkIcon, Loader2, MailWarning, ScanText, ShieldCheck, Video, Upload, X, ImagePlus, Film, Phone, Mic } from 'lucide-react';
import { ResultCard } from './result-card';
import { ScanModuleCard, type ScanCardState, type ScanModuleType } from './scan-module-card';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { RewardedAd } from '@/components/dashboard/rewarded-ad';
import { CreditsStatusBar } from '@/components/dashboard/credits-status-bar';

async function callApi(endpoint: string, body: any) {
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Scan failed.');
  }
  return res.json();
}

async function analyzeUrl(values: { url: string }) { return callApi('/api/scan/analyze-url', values); }
async function detectLure(values: { text?: string; imageDataUri?: string }) { return callApi('/api/scan/detect-lure', values); }
async function assessVideo(values: { mp4HeaderDataUri: string }) { return callApi('/api/scan/assess-video', values); }
async function analyzeEmail(values: { emailContent: string; senderHistory?: string[] }) { return callApi('/api/scan/analyze-email', values); }
async function analyzeSmsCalls(values: { phoneNumber?: string; messageText?: string; contactMethod?: string }) { return callApi('/api/scan/analyze-sms', values); }
async function analyzeDeepfakeAudio(values: { audioDataUri: string; context?: string }) { return callApi('/api/scan/analyze-audio', values); }

const LinkSchema = z.object({ url: z.string().url('Please enter a valid URL.') });
const TextSchema = z.object({ text: z.string().optional() });
const EmailSchema = z.object({ content: z.string().min(20, 'Please enter at least 20 characters of email content.') });
const SmsSchema = z.object({
  phoneNumber: z.string().optional(),
  messageText: z.string().optional(),
  contactMethod: z.enum(['sms', 'whatsapp', 'call', 'other']).optional(),
});

export type ManualScanResult =
  | { type: 'link'; data: SmartLinkScrutinizerAnalysisOutput }
  | { type: 'lure'; data: StatusLureDetectorOutput }
  | { type: 'video'; data: VideoMetadataRiskAssessmentOutput }
  | { type: 'email'; data: EmailToneAnalysisOutput }
  | { type: 'sms'; data: SmsCallShieldOutput }
  | { type: 'deepfake'; data: DeepfakeAudioOutput };

type ManualScanCenterProps = {
  result: ManualScanResult | null;
  setResult: (result: ManualScanResult | null) => void;
};

export function ManualScanCenter({ result, setResult }: ManualScanCenterProps) {
  const { t } = useLocalization();
  const { user, decrementCredits } = useAuth();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [activeContactMethod, setActiveContactMethod] = useState<'sms'|'whatsapp'|'call'|'other'>('sms');
  const [scanCardStates, setScanCardStates] = useState<Record<string, ScanCardState>>({
    link: 'idle', lure: 'idle', video: 'idle', email: 'idle', sms: 'idle', deepfake: 'idle',
  });
  const [activeTab, setActiveTab] = useState('link');
  const searchParams = useSearchParams();
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState('');
  const lureInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const deepfakeInputRef = useRef<HTMLInputElement>(null);

  const { register: registerLink, handleSubmit: handleLinkSubmit, formState: { errors: linkErrors }, reset: resetLink } = useForm<{ url: string }>({ resolver: zodResolver(LinkSchema) });
  const { register: registerLure, handleSubmit: handleLureSubmit, formState: { errors: lureErrors }, reset: resetLure } = useForm<{ text?: string }>({ resolver: zodResolver(TextSchema) });
  const { register: registerEmail, handleSubmit: handleEmailSubmit, formState: { errors: emailErrors }, reset: resetEmail } = useForm<{ content: string }>({ resolver: zodResolver(EmailSchema) });
  const { register: registerSms, handleSubmit: handleSmsSubmit, formState: { errors: smsErrors }, reset: resetSms } = useForm<{ phoneNumber?: string; messageText?: string }>({ resolver: zodResolver(SmsSchema) });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
    }
  };

  const clearFile = () => {
    setFile(null);
    setFileName('');
    if (lureInputRef.current) lureInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
    if (deepfakeInputRef.current) deepfakeInputRef.current.value = '';
  };

  const checkCreditsAndScan = (scanFn: () => Promise<void>) => {
    if (user.credits <= 0 && !user.isPremium) {
      toast({
        variant: 'destructive',
        title: t('manual_scan_no_credits_title'),
        description: t('manual_scan_no_credits_desc'),
      });
      return;
    }
    scanFn();
  };

  const onScanStart = (tab?: string) => {
    if (!user.isPremium && user.credits > 0) {
      decrementCredits();
    }
    setIsLoading(true);
    setResult(null);
    if (tab) {
      setScanCardStates(prev => ({ ...prev, [tab]: 'manual' }));
    }
  };

  const onScanEnd = (tab?: string, hasThreat?: boolean) => {
    setIsLoading(false);
    resetLink();
    resetLure();
    resetEmail();
    resetSms();
    clearFile();
    if (tab) {
      setScanCardStates(prev => ({ ...prev, [tab]: hasThreat ? 'threat' : 'clear' }));
      // Reset back to idle after 5 seconds
      setTimeout(() => {
        setScanCardStates(prev => ({ ...prev, [tab]: 'idle' }));
      }, 5000);
    }
  };

  const onLinkScan: SubmitHandler<{ url: string }> = async (data) => {
    checkCreditsAndScan(async () => {
      onScanStart('link');
      try {
        const res = await measureTrace(PerfTraces.SCAN_LINK, () => analyzeUrl({ url: data.url }));
        setResult({ type: 'link', data: res });
        onScanEnd('link', res.status !== 'safe');
      } catch (e: any) {
        toast({ variant: 'destructive', title: t('manual_scan_failed_title'), description: e.message });
        onScanEnd('link', false);
      }
    });
  };

  const onLureScan: SubmitHandler<{ text?: string }> = async (data) => {
    if (!data.text && !file) {
      toast({ variant: 'destructive', title: t('manual_scan_input_required_title'), description: t('manual_scan_input_required_desc_lure') });
      return;
    }
    checkCreditsAndScan(async () => {
      onScanStart('lure');
      try {
        let imageDataUri: string | undefined;
        if (file) {
          imageDataUri = await preprocessImage(file, 512);
        }
        const res = await measureTrace(PerfTraces.SCAN_LURE, () => detectLure({ text: data.text, imageDataUri }));
        setResult({ type: 'lure', data: res });
        onScanEnd('lure', res.is_lure);
      } catch (e: any) {
        toast({ variant: 'destructive', title: t('manual_scan_failed_title'), description: e.message });
        onScanEnd('lure', false);
      }
    });
  };

  const onVideoScan = async () => {
    if (!file) {
      toast({ variant: 'destructive', title: t('manual_scan_input_required_title'), description: t('manual_scan_input_required_desc_video') });
      return;
    }
    checkCreditsAndScan(async () => {
      onScanStart('video');
      try {
        const mp4HeaderDataUri = await extractFileHeader(file);
        const res = await measureTrace(PerfTraces.SCAN_VIDEO, () => assessVideo({ mp4HeaderDataUri }));
        setResult({ type: 'video', data: res });
        onScanEnd('video', res.malware_indicator || res.risk > 5);
      } catch (e: any) {
        toast({ variant: 'destructive', title: t('manual_scan_failed_title'), description: e.message });
        onScanEnd('video', false);
      }
    });
  };

  const onEmailScan: SubmitHandler<{ content: string }> = async (data) => {
    checkCreditsAndScan(async () => {
      onScanStart('email');
      try {
        const res = await measureTrace(PerfTraces.SCAN_EMAIL, () => analyzeEmail({ emailContent: data.content }));
        setResult({ type: 'email', data: res });
        onScanEnd('email', res.status !== 'safe');
      } catch (e: any) {
        toast({ variant: 'destructive', title: t('manual_scan_failed_title'), description: e.message });
        onScanEnd('email', false);
      }
    });
  };


  // Clean translated upload area — replaces native "Choose File / No file chosen"
  const UploadArea = ({ inputRef, accept, icon, labelKey }: {
    inputRef: React.RefObject<HTMLInputElement | null>;
    accept: string;
    icon: React.ReactNode;
    labelKey: string;
  }) => (
    <div>
      <input type="file" accept={accept} ref={inputRef} onChange={handleFileChange} className="hidden" aria-hidden="true" />
      {fileName ? (
        <div className="flex items-center gap-3 rounded-lg border border-primary/40 bg-primary/5 px-4 py-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">{t(labelKey as any)}</p>
            <p className="text-sm font-semibold truncate text-foreground mt-0.5">{fileName}</p>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={clearFile} className="shrink-0 h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
            <X className="size-4" />
          </Button>
        </div>
      ) : (
        <button type="button" onClick={() => inputRef.current?.click()}
          className="w-full flex items-center gap-3 rounded-lg border border-dashed border-primary/30 bg-background/50 px-4 py-3.5 text-left hover:border-primary/60 hover:bg-primary/5 transition-all group cursor-pointer">
          <div className="flex items-center justify-center size-9 rounded-md bg-primary/10 group-hover:bg-primary/20 transition-colors shrink-0">
            {icon}
          </div>
          <span className="text-sm font-medium text-foreground">{t(labelKey as any)}</span>
          <Upload className="size-4 text-muted-foreground ml-auto shrink-0 group-hover:text-primary transition-colors" />
        </button>
      )}
    </div>
  );

  const onSmsScan: SubmitHandler<{ phoneNumber?: string; messageText?: string }> = async (data) => {
    if (!data.phoneNumber && !data.messageText) {
      toast({ variant: 'destructive', title: t('manual_scan_input_required_title'), description: 'Please enter a phone number or message text.' });
      return;
    }
    checkCreditsAndScan(async () => {
      onScanStart('sms');
      try {
        const res = await measureTrace(PerfTraces.SCAN_SMS, () => analyzeSmsCalls({
          phoneNumber: data.phoneNumber,
          messageText: data.messageText,
          contactMethod: activeContactMethod,
        }));
        setResult({ type: 'sms', data: res });
        onScanEnd('sms', res.verdict === 'high_risk' || res.verdict === 'critical');
      } catch (e: any) {
        toast({ variant: 'destructive', title: t('manual_scan_failed_title'), description: e.message });
        onScanEnd('sms', false);
      }
    });
  };

  const onDeepfakeScan = async () => {
    if (!file) {
      toast({ variant: 'destructive', title: t('manual_scan_input_required_title'), description: 'Please upload a voice note or audio recording.' });
      return;
    }
    checkCreditsAndScan(async () => {
      onScanStart('deepfake');
      try {
        const reader = new FileReader();
        const audioDataUri = await new Promise<string>((resolve, reject) => {
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const res = await measureTrace(PerfTraces.SCAN_DEEPFAKE, () => analyzeDeepfakeAudio({ audioDataUri, context: 'User uploaded voice note or call recording for deepfake analysis' }));
        setResult({ type: 'deepfake', data: res });
        onScanEnd('deepfake', res.verdict === 'likely_deepfake' || res.verdict === 'confirmed_deepfake');
      } catch (e: any) {
        toast({ variant: 'destructive', title: t('manual_scan_failed_title'), description: e.message });
        onScanEnd('deepfake', false);
      }
    });
  };

  useEffect(() => {
    const scan = searchParams.get('scan');
    const validTabs = ['link', 'lure', 'video', 'email', 'sms', 'deepfake'];
    if (scan && validTabs.includes(scan)) {
      setActiveTab(scan);
      setTimeout(() => {
        document.getElementById('scan-tabs')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  }, [searchParams]);

  const clearResult = () => {
    setResult(null);
  };

  const renderResult = () => {
    if (!result) return null;

    switch (result.type) {
      case 'link': {
        const { data } = result;
        const isUnsafe = data.status !== 'safe';
      
  return (
          <ResultCard title={t('manual_scan_result_link_title')} icon={<LinkIcon className={isUnsafe ? 'text-destructive' : 'text-primary'} />} clearResult={clearResult}>
            <div className="space-y-4 text-center">
              <div className={`p-4 rounded-lg ${isUnsafe ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-500'}`}>
                <h3 className="font-bold text-xl uppercase">{data.status}</h3>
              </div>
              <p className="text-sm italic">{data.reason}</p>
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">{t('manual_scan_risk_score')}</p>
                  <p className="text-3xl font-bold">{data.risk_score}/10</p>
                </div>
                <Progress value={data.risk_score * 10} className="w-1/2" />
              </div>
              <Badge variant="outline" className="w-full justify-center">{t('manual_scan_recommended_action')}: {data.recommended_action}</Badge>
            </div>
          </ResultCard>
        );
      }
      case 'lure': {
        const { data } = result;
        return (
          <ResultCard title={t('manual_scan_result_lure_title')} icon={<ScanText className={data.is_lure ? 'text-destructive' : 'text-primary'} />} clearResult={clearResult}>
            <div className="space-y-4 text-center">
              <div className={`p-4 rounded-lg ${data.is_lure ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-500'}`}>
                <h3 className="font-bold text-xl uppercase">{data.is_lure ? t('manual_scan_lure_detected') : t('manual_scan_lure_not_detected')}</h3>
              </div>
              {data.is_lure && (
                <>
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground">{t('manual_scan_confidence')}</p>
                    <p className="text-3xl font-bold">{(data.confidence * 100).toFixed(0)}%</p>
                  </div>
                  <p className="text-sm">{t('manual_scan_scam_type')}: <Badge variant="secondary">{data.scam_type}</Badge></p>
                  <p className="text-sm text-muted-foreground italic">{t('manual_scan_trigger_phrase')}: "{data.trigger_phrase}"</p>
                </>
              )}
            </div>
          </ResultCard>
        );
      }
      case 'video': {
        const { data } = result;
        const isUnsafe = data.malware_indicator || data.risk > 5;
        return (
          <ResultCard title={t('manual_scan_result_video_title')} icon={<Video className={isUnsafe ? 'text-destructive' : 'text-primary'} />} clearResult={clearResult}>
            <div className="space-y-4 text-center">
              <div className={`p-4 rounded-lg ${isUnsafe ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-500'}`}>
                <h3 className="font-bold text-xl uppercase">{isUnsafe ? t('manual_scan_video_suspicious') : t('manual_scan_video_safe')}</h3>
              </div>
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">{t('manual_scan_risk_score')}</p>
                  <p className="text-3xl font-bold">{data.risk}/10</p>
                </div>
                <Progress value={data.risk * 10} className="w-1/2" />
              </div>
              {data.suspicious_elements.length > 0 && (
                <div>
                  <p className="text-sm font-bold">{t('manual_scan_video_issues')}:</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-2">
                    {data.suspicious_elements.map(e => <Badge key={e} variant="secondary">{e.replace(/_/g, ' ')}</Badge>)}
                  </div>
                </div>
              )}
            </div>
          </ResultCard>
        );
      }
      case 'email': {
        const { data } = result;
        const isUnsafe = data.status !== 'safe';
        return (
          <ResultCard title={t('manual_scan_result_email_title')} icon={<MailWarning className={isUnsafe ? 'text-destructive' : 'text-primary'} />} clearResult={clearResult}>
            <div className="space-y-4 text-center">
              <div className={`p-4 rounded-lg ${isUnsafe ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-500'}`}>
                <h3 className="font-bold text-xl uppercase">{data.status.replace(/_/g, ' ')}</h3>
              </div>
              <p className="text-sm italic">{data.summary}</p>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="border p-2 rounded-md">
                  <p className="text-xs text-muted-foreground">{t('manual_scan_email_bec_risk')}</p>
                  <p className="font-bold uppercase">{data.impersonation_risk}</p>
                </div>
                <div className="border p-2 rounded-md">
                  <p className="text-xs text-muted-foreground">{t('manual_scan_email_sender_match')}</p>
                  <p className="font-bold uppercase">{data.sender_match ? t('yes') : t('no')}</p>
                </div>
              </div>
              {data.risk_factors.length > 0 && (
                <div>
                  <p className="text-sm font-bold">{t('manual_scan_email_risk_factors')}:</p>
                  <div className="flex flex-wrap justify-center gap-2 mt-2">
                    {data.risk_factors.map(e => <Badge key={e} variant="secondary">{e.replace(/_/g, ' ')}</Badge>)}
                  </div>
                </div>
              )}
              <Badge variant="outline" className="w-full justify-center">{t('manual_scan_recommended_action')}: {data.recommended_action.replace(/_/g, ' ')}</Badge>
            </div>
          </ResultCard>
        );
      }
      case 'sms': {
        const { data } = result;
        const isUnsafe = data.verdict !== 'safe';
        const verdictColor = data.verdict === 'critical' ? 'text-destructive' :
          data.verdict === 'high_risk' ? 'text-orange-400' :
          data.verdict === 'suspicious' ? 'text-yellow-400' : 'text-green-500';
        return (
          <ResultCard title="SMS & Call Shield Result" icon={<Phone className={isUnsafe ? 'text-destructive' : 'text-primary'} />} clearResult={clearResult}>
            <div className="space-y-4 text-center">
              <div className={`p-4 rounded-lg ${isUnsafe ? 'bg-destructive/10 text-destructive' : 'bg-green-500/10 text-green-500'}`}>
                <h3 className="font-bold text-xl uppercase">{data.verdict.replace(/_/g, ' ')}</h3>
              </div>
              <p className="text-sm italic">{data.summary}</p>
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Risk Score</p>
                  <p className="text-3xl font-bold">{data.risk_score}/10</p>
                </div>
                <Progress value={data.risk_score * 10} className="w-1/2" />
              </div>
              {data.scam_type !== 'none' && (
                <Badge variant="secondary" className="w-full justify-center">{data.scam_type.replace(/_/g, ' ').toUpperCase()}</Badge>
              )}
              {data.message_analysis && (
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="border p-2 rounded-md">
                    <p className="text-xs text-muted-foreground">Urgency</p>
                    <p className="font-bold">{data.message_analysis.urgency_detected ? 'DETECTED' : 'None'}</p>
                  </div>
                  <div className="border p-2 rounded-md">
                    <p className="text-xs text-muted-foreground">Impersonation</p>
                    <p className="font-bold">{data.message_analysis.impersonation_detected ? 'DETECTED' : 'None'}</p>
                  </div>
                </div>
              )}
              <Badge variant="outline" className="w-full justify-center">Action: {data.recommended_action}</Badge>
            </div>
          </ResultCard>
        );
      }
      case 'deepfake': {
        const { data } = result;
        const isUnsafe = data.verdict !== 'authentic';
        const verdictColors: Record<string, string> = {
          authentic: 'bg-green-500/10 text-green-500',
          suspicious: 'bg-yellow-500/10 text-yellow-400',
          likely_deepfake: 'bg-orange-500/10 text-orange-400',
          confirmed_deepfake: 'bg-destructive/10 text-destructive',
        };
        return (
          <ResultCard title="Deepfake Audio Analysis" icon={<Mic className={isUnsafe ? 'text-destructive' : 'text-primary'} />} clearResult={clearResult}>
            <div className="space-y-4 text-center">
              <div className={`p-4 rounded-lg ${verdictColors[data.verdict] || 'bg-muted'}`}>
                <h3 className="font-bold text-xl uppercase">{data.verdict.replace(/_/g, ' ')}</h3>
              </div>
              <p className="text-sm italic">{data.summary}</p>
              <div className="flex items-center justify-center gap-4">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Risk Score</p>
                  <p className="text-3xl font-bold">{data.risk_score}/10</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Confidence</p>
                  <p className="text-3xl font-bold">{Math.round(data.confidence * 100)}%</p>
                </div>
              </div>
              {data.indicators.length > 0 && (
                <div>
                  <p className="text-sm font-bold mb-2">Indicators Detected:</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {data.indicators.map((ind, i) => <Badge key={i} variant="secondary">{ind}</Badge>)}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="border p-2 rounded-md">
                  <p className="text-xs text-muted-foreground">Cadence Anomalies</p>
                  <p className="font-bold">{data.voice_analysis.cadence_anomalies ? 'DETECTED' : 'None'}</p>
                </div>
                <div className="border p-2 rounded-md">
                  <p className="text-xs text-muted-foreground">Background Noise</p>
                  <p className="font-bold">{data.voice_analysis.background_noise_consistent ? 'Consistent' : 'INCONSISTENT'}</p>
                </div>
              </div>
              <Badge variant="outline" className="w-full justify-center">Action: {data.recommended_action}</Badge>
            </div>
          </ResultCard>
        );
      }
      default:
        return null;
    }
  };

  // FIX: Determine whether to show RewardedAd — only for free users with 0 credits
  const showRewardedAd = !user.isPremium && user.credits <= 0;

  const MODULE_ICONS: Record<ScanModuleType, React.ReactNode> = {
    link: <LinkIcon className="size-5 text-primary" />,
    lure: <ScanText className="size-5 text-primary" />,
    video: <Video className="size-5 text-primary" />,
    email: <MailWarning className="size-5 text-primary" />,
    sms: <Phone className="size-5 text-primary" />,
    deepfake: <Mic className="size-5 text-primary" />,
  };

  const LoadingBlock = () => (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <Loader2 className="size-10 animate-spin text-primary" />
      <h3 className="font-semibold text-base">{t('manual_scan_in_progress_title')}</h3>
      <p className="text-xs text-muted-foreground max-w-xs">{t('manual_scan_in_progress_desc')}</p>
    </div>
  );

  // Two-column layout per scanner: input LEFT, animation RIGHT (stacks input-top/animation-bottom on mobile)
  const ScanPanel = ({ mod, children }: { mod: ScanModuleType; children: React.ReactNode }) => (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
      <div className="space-y-4">
        <div className="flex items-center gap-2.5">
          {MODULE_ICONS[mod]}
          <div>
            <h3 className="font-bold text-base leading-tight">{t(`scan_card_title_${mod}` as any)}</h3>
            <p className="text-xs text-muted-foreground">{t(`scan_card_desc_${mod}` as any)}</p>
          </div>
        </div>
        {result?.type === mod ? renderResult() : isLoading && activeTab === mod ? <LoadingBlock /> : children}
      </div>
      <div>
        <ScanModuleCard module={mod} state={scanCardStates[mod]} />
      </div>
    </div>
  );

  return (
    <Card className="border-primary/20 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 font-headline text-2xl">
          <ShieldCheck className="text-primary" />
          {t('manual_scan_center_title')}
        </CardTitle>
        <CardDescription>{t('manual_scan_center_desc')}</CardDescription>
        <div className="mt-2">
          <CreditsStatusBar />
        </div>
      </CardHeader>
      <CardContent>
        {/* FIX: RewardedAd only appears when free user has 0 credits */}
        {!isLoading && !result && showRewardedAd && (
          <div className="mb-4">
            <RewardedAd />
          </div>
        )}
        <Tabs id="scan-tabs" value={activeTab} onValueChange={(v) => { clearFile(); setActiveTab(v); }} className="w-full">
          <TabsList className="grid w-full grid-cols-3 md:grid-cols-6 h-auto">
            <TabsTrigger value="link" className="py-2"><LinkIcon className="mr-2" />{t('manual_scan_tab_link')}</TabsTrigger>
            <TabsTrigger value="lure" className="py-2"><ScanText className="mr-2" />{t('manual_scan_tab_lure')}</TabsTrigger>
            <TabsTrigger value="video" className="py-2"><Video className="mr-2" />{t('manual_scan_tab_video')}</TabsTrigger>
            <TabsTrigger value="email" className="py-2"><MailWarning className="mr-2" />{t('manual_scan_tab_email')}</TabsTrigger>
            <TabsTrigger value="sms" className="py-2"><Phone className="mr-2" />SMS & Call</TabsTrigger>
            <TabsTrigger value="deepfake" className="py-2"><Mic className="mr-2" />Deepfake</TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="mt-4">
            <ScanPanel mod="link">
              <form onSubmit={handleLinkSubmit(onLinkScan)} className="space-y-4">
                <Textarea {...registerLink('url')} placeholder={t('manual_scan_link_placeholder')} className="min-h-[100px]" />
                {linkErrors.url && <p className="text-sm text-destructive">{linkErrors.url.message}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? <><Loader2 className="mr-2 size-4 animate-spin" />{t('manual_scan_in_progress_title')}</> : t('manual_scan_link_button')}</Button>
              </form>
            </ScanPanel>
          </TabsContent>

          <TabsContent value="lure" className="mt-4">
            <ScanPanel mod="lure">
              <form onSubmit={handleLureSubmit(onLureScan)} className="space-y-4">
                <Textarea {...registerLure('text')} placeholder={t('manual_scan_lure_placeholder')} className="min-h-[100px]" />
                {lureErrors.text && <p className="text-sm text-destructive">{lureErrors.text.message}</p>}
                <div className="space-y-2">
                  <UploadArea inputRef={lureInputRef} accept="image/*" icon={<ImagePlus className="size-4 text-primary" />} labelKey="manual_scan_lure_file_label" />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? <><Loader2 className="mr-2 size-4 animate-spin" />{t('manual_scan_in_progress_title')}</> : t('manual_scan_lure_button')}</Button>
              </form>
            </ScanPanel>
          </TabsContent>

          <TabsContent value="video" className="mt-4">
            <ScanPanel mod="video">
              <div className="space-y-4">
                <div className="space-y-2">
                  <UploadArea inputRef={videoInputRef} accept="video/mp4" icon={<Film className="size-4 text-primary" />} labelKey="manual_scan_video_file_label" />
                </div>
                <Button onClick={onVideoScan} className="w-full" disabled={isLoading}>{isLoading ? <><Loader2 className="mr-2 size-4 animate-spin" />{t('manual_scan_in_progress_title')}</> : t('manual_scan_video_button')}</Button>
              </div>
            </ScanPanel>
          </TabsContent>

          <TabsContent value="email" className="mt-4">
            <ScanPanel mod="email">
              <form onSubmit={handleEmailSubmit(onEmailScan)} className="space-y-4">
                <Textarea {...registerEmail('content')} placeholder={t('manual_scan_email_placeholder')} className="min-h-[200px]" />
                {emailErrors.content && <p className="text-sm text-destructive">{emailErrors.content.message}</p>}
                <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? <><Loader2 className="mr-2 size-4 animate-spin" />{t('manual_scan_in_progress_title')}</> : t('manual_scan_email_button')}</Button>
              </form>
            </ScanPanel>
          </TabsContent>
          <TabsContent value="sms" className="mt-4">
            <ScanPanel mod="sms">
              <form onSubmit={handleSmsSubmit(onSmsScan)} className="space-y-4">
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide">How were you contacted?</p>
                  <div className="flex gap-2 flex-wrap">
                    {(['sms','whatsapp','call','other'] as const).map(m => (
                      <button key={m} type="button"
                        onClick={() => setActiveContactMethod(m)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${activeContactMethod===m ? 'bg-primary/20 text-primary border-primary' : 'border-border text-muted-foreground'}`}>
                        {m.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1.5">Phone Number (optional)</p>
                  <input {...registerSms('phoneNumber')} placeholder="+234 800 000 0000" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"/>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-semibold uppercase tracking-wide mb-1.5">Message Text (optional)</p>
                  <Textarea {...registerSms('messageText')} placeholder="Paste the suspicious SMS or call script here..." className="min-h-[120px]" />
                </div>
                <p className="text-xs text-muted-foreground italic">Tip: For best results, provide both the phone number and the message you received.</p>
                <Button type="submit" className="w-full" disabled={isLoading}>{isLoading ? <><Loader2 className="mr-2 size-4 animate-spin" />Analysing...</> : 'Analyse SMS / Call'}</Button>
              </form>
            </ScanPanel>
          </TabsContent>
          <TabsContent value="deepfake" className="mt-4">
            <ScanPanel mod="deepfake">
              <div className="space-y-4">
                <div className="p-4 rounded-lg border border-primary/20 bg-primary/5">
                  <p className="text-sm font-semibold text-primary mb-1">🎙 Deepfake Audio Analyzer</p>
                  <p className="text-xs text-muted-foreground">Upload a voice note or call recording to detect AI-generated or cloned voices. Supports MP3, WAV, M4A, OGG and WebM formats.</p>
                </div>
                <UploadArea inputRef={deepfakeInputRef} accept="audio/*" icon={<Mic className="size-4 text-primary" />} labelKey="manual_scan_deepfake_file_label" />
                <p className="text-xs text-muted-foreground italic">Tip: Upload WhatsApp voice notes, call recordings or any suspicious audio for forensic analysis.</p>
                <Button onClick={onDeepfakeScan} className="w-full" disabled={isLoading}>{isLoading ? <><Loader2 className="mr-2 size-4 animate-spin" />Analysing...</> : 'Analyse for Deepfake'}</Button>
              </div>
            </ScanPanel>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
