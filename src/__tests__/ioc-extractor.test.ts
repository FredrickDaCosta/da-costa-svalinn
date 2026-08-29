import { describe, it, expect } from 'vitest';
import { extractIOCs } from '@/lib/analyst/ioc-extractor';

describe('IOC Extractor', () => {
  const now = expect.getState().testPath ? new Date().toISOString() : '';

  describe('extractIOCs', () => {
    it('should extract URLs from data', () => {
      const result = extractIOCs('link', {
        url: 'https://malicious-site.com/phish',
        reason: 'Phishing detected',
      }, 'https://malicious-site.com/phish');

      const urlIocs = result.filter(i => i.type === 'url');
      expect(urlIocs.length).toBeGreaterThanOrEqual(1);
      expect(urlIocs.some(i => i.value.includes('malicious-site.com'))).toBe(true);
    });

    it('should extract domains from data', () => {
      const result = extractIOCs('link', {
        url: 'https://evil-domain.xyz/login',
      }, 'https://evil-domain.xyz/login');

      const domainIocs = result.filter(i => i.type === 'domain');
      expect(domainIocs.some(i => i.value === 'evil-domain.xyz')).toBe(true);
    });

    it('should extract email addresses from data', () => {
      const result = extractIOCs('email', {
        senderEmail: 'phisher@fake-corp.com',
        replyTo: 'legit@real-corp.com',
        summary: 'Impersonation detected',
      });

      const emailIocs = result.filter(i => i.type === 'email_address');
      expect(emailIocs.some(i => i.value === 'phisher@fake-corp.com')).toBe(true);
      expect(emailIocs.some(i => i.value === 'legit@real-corp.com')).toBe(true);
    });

    it('should extract phone numbers from SMS data', () => {
      const result = extractIOCs('sms', {
        senderNumber: '+2348012345678',
        shortcode: 'BANK911',
        text: 'Your account has been compromised. Call +2348099999999',
      });

      const phoneIocs = result.filter(i => i.type === 'phone_number');
      expect(phoneIocs.some(i => i.value.includes('2348012345678'))).toBe(true);

      const senderIocs = result.filter(i => i.type === 'sender_id');
      expect(senderIocs.some(i => i.value === 'BANK911')).toBe(true);
    });

    it('should extract sender IDs from data', () => {
      const result = extractIOCs('sms', {
        sender: 'MTNNiger',
        shortcode: '7726',
      });

      const senderIocs = result.filter(i => i.type === 'sender_id');
      expect(senderIocs.some(i => i.value === 'MTNNiger')).toBe(true);
      expect(senderIocs.some(i => i.value === '7726')).toBe(true);
    });

    it('should set source module correctly', () => {
      const result = extractIOCs('email', {
        senderEmail: 'test@example.com',
      });

      result.forEach(ioc => {
        expect(ioc.source).toBe('email');
      });
    });

    it('should set confidence values per IOC type', () => {
      const result = extractIOCs('link', {
        url: 'https://test.com',
      }, 'https://test.com');

      const urlIocs = result.filter(i => i.type === 'url');
      // Subject URL should have confidence 1.0
      expect(urlIocs.some(i => i.confidence === 1.0)).toBe(true);
    });

    it('should handle empty data gracefully', () => {
      const result = extractIOCs('link', {});
      expect(Array.isArray(result)).toBe(true);
    });

    it('should deduplicate identical IOC values', () => {
      const result = extractIOCs('link', {
        url: 'https://same.com/path',
      });

      const urlValues = result.filter(i => i.type === 'url').map(i => i.value);
      const uniqueUrls = new Set(urlValues);
      // When only data.url is provided (no subject), no duplicates
      expect(urlValues.length).toBe(uniqueUrls.size);
    });

    it('should produce separate IOCs for subject vs data.url when both provided', () => {
      const result = extractIOCs('link', {
        url: 'https://same.com/path',
      }, 'https://same.com/path');

      const urlIocs = result.filter(i => i.type === 'url');
      // Subject gets confidence 1.0, data.url gets confidence 0.9
      expect(urlIocs.length).toBe(2);
      expect(urlIocs.some(i => i.confidence === 1.0)).toBe(true);
      expect(urlIocs.some(i => i.confidence === 0.9)).toBe(true);
    });
  });
});
