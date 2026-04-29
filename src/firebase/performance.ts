'use client';
import { getPerformance, trace } from 'firebase/performance';
import app from '@/firebase/config';

let perf: any = null;

function getPerf() {
  if (typeof window === 'undefined') return null;
  if (!perf) {
    try {
      perf = getPerformance(app);
    } catch (e) {
      console.warn('Firebase Performance init failed:', e);
    }
  }
  return perf;
}

export async function measureTrace(traceName: string, fn: () => Promise<any>) {
  const perfInstance = getPerf();
  if (!perfInstance) return fn();
  const t = trace(perfInstance, traceName);
  t.start();
  try {
    const result = await fn();
    t.stop();
    return result;
  } catch (error) {
    t.stop();
    throw error;
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
