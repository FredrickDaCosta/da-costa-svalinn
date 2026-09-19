/**
 * Blocklist Enforcement
 *
 * Looks up a scan target against the analyst's existing blocklist
 * collections (written by the actions registered in
 * src/lib/actions/index.ts — quarantine_email/block_url/block_number/
 * flag_deepfake) BEFORE the per-module AI call runs, so a previously
 * blocked target short-circuits with a synthetic result instead of
 * spending another AI call to re-confirm what's already known.
 *
 * Only 4 of the 6 scan modules have a corresponding blocklist
 * collection today — 'lure' and 'video' have no analogous "block"
 * action, so checkBlocklist() is a guaranteed no-op (returns null) for
 * those two. link, sms, email, and deepfake all now derive their key
 * from the same source the write side uses — see the per-module notes
 * in deriveLookup() below for the email case's one remaining caveat
 * (best-effort sender extraction, a UI limitation, not a derivation
 * mismatch).
 */

import { createHash } from 'crypto';
import { NextResponse } from 'next/server';
import { getAdminFirestore } from '@/lib/firebase-admin';

export type BlocklistCheckModuleType = 'link' | 'lure' | 'video' | 'email' | 'sms' | 'deepfake';

export interface BlocklistHit {
  collection: string;
  docId: string;
  originalBlock: Record<string, unknown>;
}

/**
 * Identical djb2 hash to src/lib/actions/index.ts's stableHashId.
 * Kept as a literal copy (not a shared import) because actions/index.ts
 * isn't meant to be imported from route handlers for this purpose —
 * duplicating a 6-line pure function is cheaper than adding a new
 * cross-cutting dependency. If it ever drifts from actions/index.ts's
 * copy, blocklist checks silently stop matching — see step 4 re-grep.
 */
function stableHashId(input: string): string {
  let hash = 5381;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) + hash + input.charCodeAt(i)) | 0; // djb2
  }
  return 'h' + Math.abs(hash).toString(36) + input.length.toString(36);
}

/**
 * Derive the same {collection, docId} a write-side action in
 * actions/index.ts would use, from a pre-AI-call request target.
 * Returns null when no blocklist collection exists for the module, or
 * the request doesn't carry enough to derive a trustworthy key.
 */
function deriveLookup(
  moduleType: BlocklistCheckModuleType,
  target: Record<string, unknown>,
): { collection: string; docId: string } | null {
  switch (moduleType) {
    case 'link': {
      // Matches blockUrlFirestore exactly: (params.url || '').toLowerCase().trim()
      const url = ((target.url as string) || '').toLowerCase().trim();
      if (!url) return null;
      return { collection: 'blockedUrls', docId: stableHashId(url) };
    }
    case 'sms': {
      // Matches blockNumberFirestore exactly: trimmed number, not hashed.
      // (Previously this comment's claim was false in practice: the
      // auto-response write path was fed AnalyzeSmsOutput, which has no
      // phoneNumber field, so every auto-block collapsed onto a
      // constant 'unknown' key. Fixed by threading the real number
      // through as OrchestratorInput.subject for 'block_number', the
      // same way 'block_url' already did for URLs — see orchestrator.ts.
      // Both sides now derive from the same real phoneNumber field with
      // identical normalization, so this now genuinely holds.)
      const number = ((target.phoneNumber as string) || '').trim();
      if (!number) return null;
      return { collection: 'blockedNumbers', docId: number };
    }
    case 'email': {
      // Fixed: quarantineEmailFirestore now reads params.sender_address
      // (populated in analyze-email.ts from a regex match against
      // emailContent — the same extraction used for the SPF/DMARC
      // lookup) ahead of the old always-empty sender/from fields. This
      // read path parses the sender out of the raw request's
      // emailContent with the same regex, so both sides now derive
      // from the same source text and agree on a hit. Neither side is
      // authoritative, though — a user pasting an email body with no
      // visible header line, or with an unrelated address elsewhere in
      // the text (a signature, a link), can still produce a sender
      // that isn't the real one. That's a UI limitation (no structured
      // sender field is ever collected), not a key-derivation mismatch.
      const emailContent = (target.emailContent as string) || '';
      const match = emailContent.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
      const sender = match ? match[0].toLowerCase() : 'unknown';
      const subject = (target.subject as string) || 'No subject';
      return { collection: 'quarantinedItems', docId: stableHashId(`${sender}:${subject}`) };
    }
    case 'deepfake': {
      // Fixed: flagDeepfakeFirestore now prefers params.audio_hash — a
      // SHA-256 of audioDataUri computed server-side in
      // analyze-audio.ts — over the old subject||verdict fallback.
      // audioDataUri is a required field on every deepfake scan
      // request (manual and scheduled alike), so hashing it here with
      // the identical algorithm gives both sides a real, always-present
      // key — unlike the old `subject`-only lookup, which only ever
      // worked on the scheduled path.
      const audioDataUri = target.audioDataUri as string | undefined;
      if (!audioDataUri) return null;
      const audioHash = createHash('sha256').update(audioDataUri).digest('hex');
      return { collection: 'flaggedDeepfakes', docId: audioHash };
    }
    default:
      // 'lure' and 'video' have no corresponding blocklist collection —
      // no auto-response action from commit 3 ever writes one.
      return null;
  }
}

/**
 * Look up whether `target` is already on the analyst's blocklist for
 * `moduleType`. Returns the stored block doc on a hit, or null on a
 * miss (including: no blocklist exists for this module, or the target
 * couldn't be resolved to a trustworthy key — see deriveLookup()).
 */
export async function checkBlocklist(
  userId: string,
  moduleType: BlocklistCheckModuleType,
  target: Record<string, unknown>,
): Promise<BlocklistHit | null> {
  const lookup = deriveLookup(moduleType, target);
  if (!lookup) return null;

  const firestore = await getAdminFirestore();
  if (!firestore) throw new Error('Admin Firestore unavailable');
  const snap = await firestore.collection('users').doc(userId).collection(lookup.collection).doc(lookup.docId).get();
  if (!snap.exists) return null;

  const data = snap.data()!;
  // A doc that's been explicitly unblocked (see twilio.unblockNumber's
  // unblockedAt pattern) should not suppress future scans.
  if (data.unblockedAt) return null;

  return { collection: lookup.collection, docId: lookup.docId, originalBlock: data };
}

/**
 * Build the module-shaped synthetic "already blocked" payload that a
 * scan route can return in place of calling its AI flow. Each shape
 * mirrors that module's real Output interface (src/lib/scans/*.ts) so
 * downstream code — the browser UI, and orchestrator.ts's per-module
 * risk/threat readers when the client's normal post-scan
 * logScanResult() -> processScan() call fires on this payload exactly
 * as it would on a real result — reads it as a high-risk/blocked verdict,
 * not as "safe".
 */
export function buildSyntheticBlockedResult(moduleType: BlocklistCheckModuleType, hit: BlocklistHit): Record<string, unknown> {
  const reason = (hit.originalBlock.reason as string) || 'Blocked by prior analyst action';
  const base = {
    blocklistHit: true,
    originalBlock: hit.originalBlock,
  };

  switch (moduleType) {
    case 'link':
      return { ...base, status: 'unsafe', risk_score: 10, reason: `Blocked by prior analyst action: ${reason}`, recommended_action: 'block' };
    case 'sms':
      return { ...base, risk_score: 10, verdict: 'critical', scam_type: 'previously_blocked', summary: `Blocked by prior analyst action: ${reason}`, recommended_action: 'block' };
    case 'email':
      return { ...base, status: 'high_risk', sender_match: false, tone_deviation_score: 1, impersonation_risk: 'high', suspicious_request: true, risk_factors: ['Sender previously quarantined by analyst'], summary: `Blocked by prior analyst action: ${reason}`, recommended_action: 'block', confidence: 1 };
    case 'deepfake':
      return {
        ...base,
        verdict: 'confirmed_deepfake',
        confidence: 1,
        risk_score: 10,
        indicators: ['Previously flagged by analyst'],
        voice_analysis: { naturalness_score: 0, cadence_anomalies: true, background_noise_consistent: false, emotional_authenticity: 'previously flagged' },
        summary: `Blocked by prior analyst action: ${reason}`,
        recommended_action: 'block',
      };
    default:
      return { ...base, summary: `Blocked by prior analyst action: ${reason}` };
  }
}

/**
 * Route-level wrapper: checks the blocklist and, on a hit, returns a
 * ready-to-send NextResponse carrying the synthetic result — the
 * caller returns this immediately and skips its AI call. On a miss,
 * returns null and the caller proceeds exactly as before.
 *
 * For the 6 manual /api/scan/*\/route.ts call sites, no separate
 * persistence write happens here: the browser client already calls
 * logScanResult() -> processScan() on whatever the route returns,
 * synthetic or real, so returning a module-shaped payload is
 * sufficient for it to reach the incident feed through the existing
 * path. Server-only callers with no such client follow-up (i.e.
 * run-scan/route.ts) must call processScan() themselves on the
 * synthetic result — see that file's per-target loop.
 */
export async function enforceBlocklist(
  _req: unknown,
  userId: string,
  moduleType: BlocklistCheckModuleType,
  target: Record<string, unknown>,
): Promise<NextResponse | null> {
  const hit = await checkBlocklist(userId, moduleType, target);
  if (!hit) return null;

  return NextResponse.json(buildSyntheticBlockedResult(moduleType, hit));
}
