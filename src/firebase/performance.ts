'use client';
import { getPerformance, trace } from 'firebase/performance';
import app from '@/firebase/config';

let perf: any = null;
let perfInitAttempted = false;

async function getPerf() {
  if (typeof window === 'undefined') return null;
  
  if (perfInitAttempted) return perf;

  perfInitAttempted = true;
  try {
    perf = getPerformance(app);
  } catch (e) {
    console.warn('Firebase Performance init failed:', e);
  }

  return perf;
}

export async function measureTrace(traceName: string, fn: () => Promise<any>) {
  const perfInstance = await getPerf();
  if (!perfInstance) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Perf Debug] Trace '${traceName}' skipped (Perf not supported or SSR)`);
    }
    return fn();
  }

  const t = trace(perfInstance, traceName);
  if (process.env.NODE_ENV === 'development') {
    console.log(`[Perf Debug] Trace '${traceName}' started`);
  }
  
  t.start();
  try {
    const result = await fn();
    return result;
  } finally {
    t.stop();
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Perf Debug] Trace '${traceName}' stopped`);
    }
  }
}

export const PerfTraces = {
  AI_ASSISTANT_RESPONSE: 'ai_assistant_response',
  SCAN_LINK: 'scan_link_scrutinizer',
  SCAN_LURE: 'scan_lure_detector',
  SCAN_EMAIL: 'scan_email_analyzer',
  SCAN_SMS: 'scan_sms_shield',
  SCAN_VIDEO: 'scan_video_auditor',
  SCAN_DEEPFAKE: 'scan_deepfake_audio',
  USER_LOGIN: 'user_login',
  DASHBOARD_LOAD: 'dashboard_load',
};
