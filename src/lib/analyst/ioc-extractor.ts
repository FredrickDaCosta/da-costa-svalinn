/**
 * IOC (Indicator of Compromise) Extractor
 *
 * Extracts IOCs from scan results across all 6 modules.
 * IOCs are the raw evidence: URLs, IPs, emails, phone numbers, etc.
 */

import type { IOC, IOCType, ModuleType } from './types';

/**
 * Extract URLs from text using regex.
 */
function extractUrls(text: string): string[] {
  const urlRegex = /https?:\/\/[^\s<>"{}|\\^`\[\]]+/gi;
  return [...new Set((text.match(urlRegex) || []).map(u => u.replace(/[.,;:!?)]+$/, '')))];
}

/**
 * Extract domains from URLs or raw text.
 */
function extractDomains(text: string): string[] {
  const urls = extractUrls(text);
  const domains = urls.map(u => {
    try { return new URL(u).hostname; } catch { return null; }
  }).filter(Boolean) as string[];

  // Also match bare domains
  const domainRegex = /\b([a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}\b/g;
  const bare = (text.match(domainRegex) || []).filter(d =>
    !d.endsWith('.com') || d.split('.').length > 2 // filter false positives
  );

  return [...new Set([...domains, ...bare])];
}

/**
 * Extract IP addresses from text.
 */
function extractIPs(text: string): string[] {
  const ipRegex = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
  return [...new Set(text.match(ipRegex) || [])];
}

/**
 * Extract email addresses from text.
 */
function extractEmails(text: string): string[] {
  const emailRegex = /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g;
  return [...new Set(text.match(emailRegex) || [])];
}

/**
 * Extract phone numbers from text (international format).
 */
function extractPhoneNumbers(text: string): string[] {
  const phoneRegex = /(?:\+?[1-9]\d{0,2}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;
  return [...new Set((text.match(phoneRegex) || []).map(p => p.trim()))];
}

/**
 * Extract sender IDs from SMS/email metadata.
 */
function extractSenderIds(data: Record<string, unknown>): string[] {
  const ids: string[] = [];
  if (typeof data.sender === 'string') ids.push(data.sender);
  if (typeof data.from === 'string') ids.push(data.from);
  if (typeof data.sender_id === 'string') ids.push(data.sender_id);
  if (typeof data.shortcode === 'string') ids.push(data.shortcode);
  return [...new Set(ids)];
}

/**
 * Build IOCs from a specific module's scan result.
 */
export function extractIOCs(
  moduleType: ModuleType,
  data: Record<string, unknown>,
  subject?: string,
): IOC[] {
  const iocs: IOC[] = [];
  const now = new Date().toISOString();

  const addIOC = (type: IOCType, value: string, confidence: number) => {
    if (value && value.length > 1) {
      iocs.push({ type, value: value.trim(), confidence, source: moduleType, firstSeen: now });
    }
  };

  // Collect all text for extraction
  const allText = [
    subject || '',
    typeof data.url === 'string' ? data.url : '',
    typeof data.reason === 'string' ? data.reason : '',
    typeof data.summary === 'string' ? data.summary : '',
    typeof data.text === 'string' ? data.text : '',
    typeof data.content === 'string' ? data.content : '',
    typeof data.emailContent === 'string' ? data.emailContent : '',
    typeof data.trigger_phrase === 'string' ? data.trigger_phrase : '',
    JSON.stringify(data.suspicious_elements || []),
  ].join(' ');

  // Extract by type
  for (const url of extractUrls(allText)) {
    addIOC('url', url, 0.9);
  }

  for (const domain of extractDomains(allText)) {
    addIOC('domain', domain, 0.85);
  }

  for (const ip of extractIPs(allText)) {
    addIOC('ip', ip, 0.8);
  }

  for (const email of extractEmails(allText)) {
    addIOC('email_address', email, 0.9);
  }

  for (const phone of extractPhoneNumbers(allText)) {
    addIOC('phone_number', phone, 0.7);
  }

  for (const senderId of extractSenderIds(data)) {
    addIOC('sender_id', senderId, 0.75);
  }

  // Module-specific IOC extraction
  if (moduleType === 'link' && subject) {
    addIOC('url', subject, 1.0);
    const domain = extractDomain(subject);
    if (domain) addIOC('domain', domain, 1.0);
  }

  if (moduleType === 'email') {
    if (typeof data.senderEmail === 'string') addIOC('email_address', data.senderEmail, 1.0);
    if (typeof data.replyTo === 'string') addIOC('email_address', data.replyTo, 0.9);
  }

  if (moduleType === 'sms') {
    if (typeof data.senderNumber === 'string') addIOC('phone_number', data.senderNumber, 1.0);
    if (typeof data.shortcode === 'string') addIOC('sender_id', data.shortcode, 0.95);
  }

  return iocs;
}

function extractDomain(input: string): string {
  try {
    if (input.startsWith('http')) return new URL(input).hostname;
    return input.replace(/^www\./, '');
  } catch {
    return '';
  }
}
