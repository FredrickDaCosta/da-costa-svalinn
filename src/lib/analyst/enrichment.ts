/**
 * WHOIS & SSL Enrichment Service
 *
 * Uses free APIs to enrich domain-based IOCs:
 * - whois.arin.net REST API (free, no key)
 * - SSL certificate check via fetch
 * - Domain reputation heuristic
 */

import type { DomainEnrichment } from './types';

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
 * Fetch WHOIS data from arin.net (free, no API key needed).
 */
async function fetchWhois(domain: string): Promise<Partial<DomainEnrichment>> {
  try {
    const res = await fetch(
      `https://whois.arin.net/rest/ip/${domain}.json`,
      { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(8000) }
    ).catch(() => null);

    // Fallback: try rdap.org (free, no key)
    const rdapRes = await fetch(
      `https://rdap.org/domain/${domain}`,
      { signal: AbortSignal.timeout(8000) }
    ).catch(() => null);

    if (rdapRes?.ok) {
      const data = await rdapRes.json() as Record<string, unknown>;
      const events = (data.events as Array<{ eventDate: string; eventAction: string }>) || [];
      const created = events.find(e => e.eventAction === 'registration');
      const expires = events.find(e => e.eventAction === 'expiration');

      const nameservers = (data.nameservers as Array<{ ldhName: string }>) || [];

      return {
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

  // No SSL is suspicious
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

  const [whoisData, sslData] = await Promise.all([
    fetchWhois(domain),
    checkSSL(domain),
  ]);

  // Calculate domain age
  let domainAge: number | undefined;
  if (whoisData.createdDate) {
    const created = new Date(whoisData.createdDate);
    if (!isNaN(created.getTime())) {
      domainAge = Math.floor((Date.now() - created.getTime()) / (1000 * 60 * 60 * 24));
    }
  }

  const enrichment: DomainEnrichment = {
    domain,
    createdDate: whoisData.createdDate,
    expiresDate: whoisData.expiresDate,
    domainAge,
    ...sslData,
    whoisAvailable: whoisData.whoisAvailable ?? false,
  };

  enrichment.reputation = assessReputation(enrichment);

  return enrichment;
}
