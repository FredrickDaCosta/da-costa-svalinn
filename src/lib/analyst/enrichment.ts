/**
 * WHOIS & SSL Enrichment Service
 *
 * Uses free APIs to enrich domain-based IOCs:
 * - RDAP (rdap.org) for domain WHOIS (free, no key)
 * - RDAP (rdap.org) for IP WHOIS (free, no key)
 * - SSL certificate check via fetch
 * - Domain reputation heuristic
 */

import type { DomainEnrichment } from './types';

/**
 * Check if input is an IPv4 address.
 */
function isIpAddress(input: string): boolean {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(input);
}

/**
 * Extract domain from a URL or return as-is if already a domain.
 */
function extractDomain(input: string): string {
  try {
    if (input.startsWith('http')) {
      return new URL(input).hostname;
    }
    return input.replace(/^www\./, '');
  } catch {
    return input;
  }
}

/**
 * Fetch WHOIS data via RDAP (free, no API key needed).
 * Uses rdap.org/domain/{domain} for domains, rdap.org/ip/{ip} for IPs.
 */
async function fetchWhois(input: string): Promise<Partial<DomainEnrichment>> {
  const domain = extractDomain(input);
  const isIp = isIpAddress(domain);
  
  try {
    const url = isIp
      ? `https://rdap.org/ip/${domain}`
      : `https://rdap.org/domain/${domain}`;
    
    const res = await fetch(url, { 
      signal: AbortSignal.timeout(8000),
      headers: { Accept: 'application/json' }
    }).catch(() => null);

    if (res?.ok) {
      const data = await res.json() as Record<string, unknown>;
      const events = (data.events as Array<{ eventDate: string; eventAction: string }>) || [];
      const created = events.find(e => e.eventAction === 'registration');
      const expires = events.find(e => e.eventAction === 'expiration');
      
      // For domains, also try to get registrar info
      let registrar: string | undefined;
      if (!isIp) {
        const entities = (data.entities as Array<{ roles?: string[]; vcardArray?: unknown[] }>) || [];
        const registrarEntity = entities.find(e => e.roles?.includes('registrar'));
        if (registrarEntity?.vcardArray) {
          const vcard = registrarEntity.vcardArray[1] as Array<[string, string, string, string]>;
          const org = vcard.find(([name]) => name === 'ORG');
          if (org) registrar = org[3];
        }
      }

      return {
        registrar,
        createdDate: created?.eventDate,
        expiresDate: expires?.eventDate,
        whoisAvailable: true,
      };
    }

    return { whoisAvailable: false };
  } catch {
    return { whoisAvailable: false };
  }
}

/**
 * Check SSL certificate validity via a lightweight HEAD request.
 */
async function checkSSL(domain: string): Promise<{ sslValid?: boolean; sslIssuer?: string; sslExpiry?: string }> {
  // Skip SSL check for IP addresses
  if (isIpAddress(domain)) {
    return { sslValid: undefined };
  }
  
  try {
    const res = await fetch(`https://${domain}`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(8000),
      redirect: 'follow',
    }).catch(() => null);

    if (res?.ok) {
      return { sslValid: true };
    }
    return { sslValid: false };
  } catch {
    return { sslValid: false };
  }
}

/**
 * Heuristic domain reputation scoring.
 */
function assessReputation(enrichment: DomainEnrichment): 'clean' | 'suspicious' | 'malicious' {
  let suspiciousScore = 0;

  // Very new domain (< 30 days) is suspicious
  if (enrichment.domainAge !== undefined && enrichment.domainAge < 30) {
    suspiciousScore += 3;
  } else if (enrichment.domainAge !== undefined && enrichment.domainAge < 90) {
    suspiciousScore += 1;
  }

  // No SSL is suspicious (only for domains, not IPs)
  if (enrichment.sslValid === false) {
    suspiciousScore += 2;
  }

  // Free/privacy registrar can be suspicious
  const suspiciousRegistrars = ['whoisguard', 'privacy', 'redacted', 'data protected'];
  if (enrichment.registrar?.toLowerCase().includes('privacy') ||
      enrichment.registrar?.toLowerCase().includes('whoisguard')) {
    suspiciousScore += 1;
  }

  if (suspiciousScore >= 4) return 'malicious';
  if (suspiciousScore >= 2) return 'suspicious';
  return 'clean';
}

/**
 * Full domain enrichment: WHOIS + SSL + reputation.
 */
export async function enrichDomain(input: string): Promise<DomainEnrichment> {
  const domain = extractDomain(input);
  const isIp = isIpAddress(domain);

  const [whoisData, sslData] = await Promise.all([
    fetchWhois(domain),
    checkSSL(domain),
  ]);

  // Calculate domain age (only for domains, not IPs)
  let domainAge: number | undefined;
  if (!isIp && whoisData.createdDate) {
    const created = new Date(whoisData.createdDate);
    if (!isNaN(created.getTime())) {
      domainAge = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  const enrichment: DomainEnrichment = {
    domain,
    registrar: whoisData.registrar,
    createdDate: whoisData.createdDate,
    expiresDate: whoisData.expiresDate,
    domainAge,
    ...sslData,
    whoisAvailable: whoisData.whoisAvailable ?? false,
  };

  enrichment.reputation = assessReputation(enrichment);

  return enrichment;
}