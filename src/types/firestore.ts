/**
 * Firestore Document Types for Da-Costa Svalinn
 *
 * These interfaces model every Firestore collection/sub-collection used by the
 * application. Import them wherever you need to type Firestore reads or writes
 * instead of resorting to `any`.
 */

/* ─── users/{uid} ─── */
export interface UserProfile {
  displayName: string;
  email: string;
  creditBalance: number;
  subscriptionStatus: 'free' | 'premium';
  role: 'user' | 'admin';
  sentryMode: 'full' | 'limited';
  lastLoginDate?: string;
  loginStreak?: number;
  createdAt?: string;
  updatedAt?: string;
}

/* ─── users/{uid}/securityScanResults/{docId} ─── */
export type ScanModuleType = 'link' | 'lure' | 'video' | 'email' | 'sms' | 'deepfake';
export type AlertLevel = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityScanResult {
  userId: string;
  moduleType: ScanModuleType;
  scanTimestamp: string;
  alertLevel: AlertLevel;
  summary: string;
  createdAt: string; // serverTimestamp
}

/* ─── users/{uid}/consentLogs/{docId} ─── */
export interface ConsentLogEntry {
  userId: string;
  consentType: string;
  scopes: string[];
  displayName?: string;
  timestamp: string;
}

/* ─── webAuthnCredentials/{userId}/credentials/{credId} ─── */
export interface WebAuthnCredential {
  credentialID: string;
  credentialPublicKey: number[];
  counter: number;
  transports: string[];
  registeredAt: string; // serverTimestamp
  lastUsedAt?: string;
}

/* ─── webAuthnChallenges/{userId} ─── */
export interface WebAuthnChallenge {
  challenge: string;
  createdAt: string; // serverTimestamp
}

/* ─── authAuditLog/{docId} ─── */
export interface AuditLogEntry {
  userId: string;
  action: string;
  timestamp: string; // serverTimestamp
  ipAddress: string;
  userAgent: string;
  success: boolean;
  failureReason?: string | null;
}

/* ─── aiReports/{docId} ─── */
export interface AIReport {
  userId: string;
  reportType: string;
  content: string;
  createdAt: string;
}

/* ─── translationCache/{cacheKey} ─── */
export interface TranslationCacheEntry {
  locale: string;
  original: string;
  translated: string;
  cachedAt: number; // Date.now()
}

/* ─── Scan result shapes returned by AI modules ─── */
export interface LinkScanResult {
  status: 'safe' | 'unsafe';
  risk_score: number;
  reason: string;
  recommended_action: 'block' | 'warn' | 'allow';
}

export interface LureDetectionResult {
  is_lure: boolean;
  scam_type: 'phishing' | 'giveaway' | 'investment' | 'romance' | 'impersonation' | 'other';
  confidence: number;
  trigger_phrase: string;
}

export interface EmailAnalysisResult {
  status: 'safe' | 'suspicious' | 'high_risk';
  sender_match: boolean;
  tone_deviation_score: number;
  impersonation_risk: 'low' | 'medium' | 'high';
  suspicious_request: boolean;
  risk_factors: string[];
  summary: string;
  recommended_action: 'verify_sender' | 'block' | 'report' | 'proceed';
  confidence: number;
}

export interface SmsAnalysisResult {
  risk_score: number;
  verdict: 'safe' | 'suspicious' | 'high_risk' | 'critical';
  scam_type: string;
  phone_analysis?: {
    country_code: string;
    format_suspicious: boolean;
    known_pattern: string;
  };
  message_analysis?: {
    urgency_detected: boolean;
    impersonation_detected: boolean;
    personal_info_request: boolean;
    trigger_phrase: string;
  };
  summary: string;
  recommended_action: string;
}

export interface VideoAnalysisResult {
  match: boolean;
  suspicious_elements: string[];
  risk: number;
  malware_indicator: boolean;
}

export interface DeepfakeAudioResult {
  verdict: 'authentic' | 'suspicious' | 'likely_deepfake' | 'confirmed_deepfake';
  confidence: number;
  risk_score: number;
  indicators: string[];
  voice_analysis: {
    naturalness_score: number;
    cadence_anomalies: boolean;
    background_noise_consistent: boolean;
    emotional_authenticity: string;
  };
  summary: string;
  recommended_action: string;
}

/* ─── Chat types ─── */
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}
