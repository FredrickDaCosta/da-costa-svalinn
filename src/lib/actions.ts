'use server';

export interface SmartLinkScrutinizerAnalysisInput { url: string; }
export interface SmartLinkScrutinizerAnalysisOutput { status: "safe" | "unsafe"; risk_score: number; reason: string; recommended_action: "block" | "warn" | "allow"; }
export interface StatusLureDetectorInput { text?: string; imageDataUri?: string; }
export interface StatusLureDetectorOutput { is_lure: boolean; scam_type: "phishing" | "giveaway" | "investment" | "romance" | "impersonation" | "other"; confidence: number; trigger_phrase: string; }
export interface VideoMetadataRiskAssessmentInput { mp4HeaderDataUri: string; }
export interface VideoMetadataRiskAssessmentOutput { match: boolean; suspicious_elements: string[]; risk: number; malware_indicator: boolean; }
export interface EmailToneAnalysisInput { emailContent: string; senderHistory?: string[]; }
export interface EmailToneAnalysisOutput { status: "safe" | "suspicious" | "high_risk"; sender_match: boolean; tone_deviation_score: number; impersonation_risk: "low" | "medium" | "high"; suspicious_request: boolean; risk_factors: string[]; summary: string; recommended_action: "verify_sender" | "block" | "report" | "proceed"; confidence: number; }
export interface SmsCallShieldInput { phoneNumber?: string; messageText?: string; contactMethod?: "sms" | "whatsapp" | "call" | "other"; }
export interface SmsCallShieldOutput { risk_score: number; verdict: "safe" | "suspicious" | "high_risk" | "critical"; scam_type: string; phone_analysis?: { country_code: string; format_suspicious: boolean; known_pattern: string; }; message_analysis?: { urgency_detected: boolean; impersonation_detected: boolean; personal_info_request: boolean; trigger_phrase: string; }; summary: string; recommended_action: string; }
export interface DeepfakeAudioInput { audioDataUri: string; context?: string; }
export interface DeepfakeAudioOutput { verdict: "authentic" | "suspicious" | "likely_deepfake" | "confirmed_deepfake"; confidence: number; risk_score: number; indicators: string[]; voice_analysis: { naturalness_score: number; cadence_anomalies: boolean; background_noise_consistent: boolean; emotional_authenticity: string; }; summary: string; recommended_action: string; }
export interface DacostaChatInput { prompt: string; history?: any[]; }
export interface AIChatOutput { reply: string; }

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || "https://dacosta-svalinn.com";

async function callScanApi(endpoint: string, body: any) {
  const res = await fetch(BASE_URL + endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Scan failed.");
  }
  return res.json();
}

export async function analyzeUrl(values: SmartLinkScrutinizerAnalysisInput): Promise<SmartLinkScrutinizerAnalysisOutput> {
  try { return await callScanApi("/api/scan/analyze-url", values); }
  catch (error: any) { console.error("Error in analyzeUrl:", error); throw new Error("Failed to analyze URL."); }
}

export async function detectLure(values: StatusLureDetectorInput): Promise<StatusLureDetectorOutput> {
  try { return await callScanApi("/api/scan/detect-lure", values); }
  catch (error: any) { console.error("Error in detectLure:", error); throw new Error("Failed to detect lure."); }
}

export async function assessVideo(values: VideoMetadataRiskAssessmentInput): Promise<VideoMetadataRiskAssessmentOutput> {
  try { return await callScanApi("/api/scan/assess-video", values); }
  catch (error: any) { console.error("Error in assessVideo:", error); throw new Error("Failed to assess video."); }
}

export async function analyzeEmail(values: EmailToneAnalysisInput): Promise<EmailToneAnalysisOutput> {
  try { return await callScanApi("/api/scan/analyze-email", values); }
  catch (error: any) { console.error("Error in analyzeEmail:", error); throw new Error("Failed to analyze email."); }
}

export async function analyzeSmsCalls(values: SmsCallShieldInput): Promise<SmsCallShieldOutput> {
  try { return await callScanApi("/api/scan/analyze-sms", values); }
  catch (error: any) { console.error("Error in analyzeSmsCalls:", error); throw new Error("Failed to analyze SMS/Call."); }
}

export async function analyzeDeepfakeAudio(values: DeepfakeAudioInput): Promise<DeepfakeAudioOutput> {
  try { return await callScanApi("/api/scan/analyze-audio", values); }
  catch (error: any) { console.error("Error in analyzeDeepfakeAudio:", error); throw new Error("Failed to analyze audio."); }
}

export async function dacostaChatAction(values: DacostaChatInput): Promise<AIChatOutput> {
  try { const res = await callScanApi("/api/dacosta-chat", { messages: [{ role: "user", content: values.prompt }], userContext: {} }); return { reply: res.reply || "I am here to help." }; }
  catch (error: any) { console.error("[dacostaChatAction] error:", error?.message); throw new Error("Da-Costa AI error: " + (error?.message || "unknown")); }
}
