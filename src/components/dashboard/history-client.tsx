'use client';

import { useUser, useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { History, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';

export default function HistoryClient() {
  const { user } = useUser();
  const firestore = useFirestore();
  const [filter, setFilter] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Support both hash (#link) and query param (?filter=link)
    const hash = window.location.hash.replace('#', '').trim();
    const params = new URLSearchParams(window.location.search);
    const qFilter = params.get('filter');
    setFilter(hash || qFilter || null);
    setReady(true);
  }, []);

  const historyQuery = useMemoFirebase(() => {
    if (!firestore || !user || !ready) return null;
    const colRef = collection(firestore, 'users', user.uid, 'securityScanResults');
    if (filter) {
      return query(colRef, where('moduleType', '==', filter), orderBy('scanTimestamp', 'desc'), limit(50));
    }
    return query(colRef, orderBy('scanTimestamp', 'desc'), limit(50));
  }, [firestore, user, filter, ready]);

  const { data: history, isLoading } = useCollection(historyQuery);

  const getModuleLabel = (type: string) => {
    switch (type) {
      case 'link': return 'Link Scrutinizer';
      case 'lure': return 'Lure Detector';
      case 'video': return 'Video Auditor';
      case 'email': return 'Email Analyzer';
      case 'sms': return 'SMS & Call Shield';
      case 'deepfake': return 'Deepfake Audio';
      default: return type.toUpperCase();
    }
  };

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-[50vh]">
        <div style={{color:'#00e5c8'}}>Loading security logs...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/dashboard"><ArrowLeft /></Link>
        </Button>
        <div>
          <h1 className="font-headline text-3xl md:text-4xl">Security History</h1>
          <p className="text-muted-foreground">Comprehensive logs from all perimeter monitoring modules.</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <History className="text-primary" />
            {filter ? `${getModuleLabel(filter)} Logs` : 'Unified Perimeter Audit'}
          </CardTitle>
          <CardDescription>Historical record of all autonomous background sentry events.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : history && history.length > 0 ? (
            <div className="space-y-4">
              {history.map(item => (
                <div key={item.id} className="flex flex-col md:flex-row md:items-start justify-start p-4 border rounded-lg bg-muted/20 gap-4 text-left">
                  <div className="flex flex-col gap-1 flex-1 items-start">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                        {getModuleLabel(item.moduleType)}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {format(new Date(item.scanTimestamp), 'MMM d, HH:mm')}
                      </span>
                    </div>
                    <span className="font-semibold text-sm">{item.summary}</span>
                    {item.recommendation && (
                      <span className="text-xs text-primary font-medium mt-1">{item.recommendation}</span>
                    )}
                  </div>
                  <div className="shrink-0">
                    <Badge variant={item.alertLevel === 'critical' || item.alertLevel === 'high' ? 'destructive' : 'outline'} className="text-[10px] uppercase">
                      {item.alertLevel}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',padding:'40px 20px',textAlign:'center',border:'2px dashed #1a3545',borderRadius:12,background:'#060e1880'}}>
              <svg width="120" height="120" viewBox="0 0 120 120" style={{marginBottom:16}}>
                <defs>
                  <radialGradient id="eg2" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#00e5c8" stopOpacity="0.15"/>
                    <stop offset="100%" stopColor="#00e5c8" stopOpacity="0"/>
                  </radialGradient>
                </defs>
                <circle cx="60" cy="60" r="20" fill="none" stroke="#00e5c8" strokeWidth="0.8" opacity="0">
                  <animate attributeName="r" values="20;55;20" dur="4s" repeatCount="indefinite"/>
                  <animate attributeName="opacity" values="0.6;0;0.6" dur="4s" repeatCount="indefinite"/>
                </circle>
                <circle cx="60" cy="60" r="30" fill="url(#eg2)"/>
                <circle cx="60" cy="60" r="40" fill="none" stroke="#00e5c8" strokeWidth="0.6" strokeDasharray="4 6" opacity="0.2">
                  <animateTransform attributeName="transform" type="rotate" from="0 60 60" to="360 60 60" dur="12s" repeatCount="indefinite"/>
                </circle>
                <g style={{animation:'floatShield 3s ease-in-out infinite'}}>
                  <path d="M60 38L46 44L46 58C46 68 52 76 60 79C68 76 74 68 74 58L74 44Z" fill="none" stroke="#00e5c8" strokeWidth="2.5"/>
                  <path d="M53 58L57 62L67 52" stroke="#00e5c8" strokeWidth="2.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                </g>
                <style>{'@keyframes floatShield{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}'}</style>
              </svg>
              <h3 style={{fontSize:18,fontWeight:700,color:'#fff',marginBottom:8}}>
                {filter ? `No ${getModuleLabel(filter)} history yet` : 'Perimeter Clear'}
              </h3>
              <p style={{fontSize:13,color:'#2a5568',maxWidth:320,lineHeight:1.5,marginBottom:16}}>
                {filter
                  ? `No scan results from ${getModuleLabel(filter)} have been recorded yet. Run a scan to build your history.`
                  : 'Your perimeter is currently clear. All scan results will appear here.'}
              </p>
              <Link href="/dashboard" style={{padding:'8px 20px',borderRadius:8,border:'1px solid #00e5c844',color:'#00e5c8',fontSize:12,fontWeight:600,textDecoration:'none'}}>
                Return to Dashboard
              </Link>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
