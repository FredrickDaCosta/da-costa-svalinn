'use server';
/**
 * @fileOverview UnifiedThreatEngine - Aggregates results from all modules and persists to Firestore.
 * Implements Pillar 3 of the Background Sentry architecture with full app integration.
 */

import { smartLinkScrutinizerAnalysis } from '@/ai/flows/smart-link-scrutinizer-analysis';
import { statusLureDetection } from '@/ai/flows/status-lure-detection';
import { videoMetadataRiskAssessment } from '@/ai/flows/video-metadata-risk-assessment';
import { emailToneAnalysis } from '@/ai/flows/email-tone-analyzer';
import { initializeFirebase } from '@/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

export type UnifiedThreatResult = {
  threat_level: 'low' | 'medium' | 'high' | 'critical';
  affected_modules: string[];
  recommended_action: string;
  auto_block: boolean;
  correlation_id: string;
};

/**
 * Orchestrates cross-module analysis to detect complex attack patterns.
 * Persists results to Firestore to integrate with History, Account, and Admin modules.
 */
export async function runUnifiedThreatScan(
  userId: string,
  input: {
    url?: string;
    text?: string;
    imageDataUri?: string;
    mp4HeaderDataUri?: string;
    emailContent?: string;
    senderHistory?: string[];
  }
): Promise<UnifiedThreatResult> {
  const { firestore } = initializeFirebase();
  const modules: string[] = [];
  let maxRisk = 0;
  
  // Parallel execution of all enabled modules
  const results = await Promise.all([
    input.url ? smartLinkScrutinizerAnalysis({ url: input.url }) : null,
    input.text || input.imageDataUri ? statusLureDetection({ text: input.text, imageDataUri: input.imageDataUri }) : null,
    input.mp4HeaderDataUri ? videoMetadataRiskAssessment({ mp4HeaderDataUri: input.mp4HeaderDataUri }) : null,
    input.emailContent ? emailToneAnalysis({ emailContent: input.emailContent, senderHistory: input.senderHistory }) : null,
  ]);

  const [link, lure, video, email] = results;

  if (link) {
    modules.push('link');
    maxRisk = Math.max(maxRisk, link.risk_score);
    await logScanResult(userId, 'link', link.risk_score >= 7 ? 'high' : 'low', `URL Analysis: ${link.status}`, link.reason);
  }
  if (lure && lure.is_lure) {
    modules.push('lure');
    maxRisk = Math.max(maxRisk, lure.confidence * 10);
    await logScanResult(userId, 'lure', 'high', 'Social Engineering Detected', lure.trigger_phrase);
  }
  if (video) {
    modules.push('video');
    maxRisk = Math.max(maxRisk, video.risk);
    await logScanResult(userId, 'video', video.risk >= 9 ? 'critical' : video.risk >= 6 ? 'high' : 'low', 'Media Header Audit', video.suspicious_elements.join(', '));
  }
  if (email && email.status !== 'safe') {
    modules.push('email');
    const emailRisk = email.impersonation_risk === 'high' ? 9.5 : email.impersonation_risk === 'medium' ? 6 : 2;
    maxRisk = Math.max(maxRisk, emailRisk);
    await logScanResult(userId, 'email', email.impersonation_risk, 'Linguistic Style Mismatch', email.summary);
  }

  // Global threat level
  let level: 'low' | 'medium' | 'high' | 'critical' = 'low';
  if (maxRisk >= 9) level = 'critical';
  else if (maxRisk >= 7) level = 'high';
  else if (maxRisk >= 4) level = 'medium';

  return {
    threat_level: level,
    affected_modules: modules,
    recommended_action: level === 'critical' 
      ? 'CRITICAL THREAT: Automatic quarantine engaged.' 
      : level === 'high' 
        ? 'HIGH RISK: Impersonation or malicious payload detected.' 
        : 'Sentry Audit: Status Normal.',
    auto_block: level === 'critical' || level === 'high',
    correlation_id: `SENTRY-SOC-${Date.now()}`,
  };
}

async function logScanResult(userId: string, module: string, level: string, summary: string, detail: string) {
  const { firestore } = initializeFirebase();
  const colRef = collection(firestore, 'users', userId, 'securityScanResults');
  
  await addDoc(colRef, {
    userId,
    moduleType: module,
    scanTimestamp: new Date().toISOString(),
    alertLevel: level,
    summary,
    detailsJson: JSON.stringify({ detail }),
    recommendation: level === 'high' || level === 'critical' ? 'Avoid interacting with this item.' : 'Verified as safe.',
    createdAt: serverTimestamp()
  });
}
