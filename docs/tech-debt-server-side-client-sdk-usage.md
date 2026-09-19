# Tech debt: server-only code using the client Firebase SDK

**Status:** 5 of 23 confirmed call sites fixed: `blocklist-check.ts`,
`run-scan/route.ts`, `decide-action/route.ts`, `api-helpers.ts`'s
`rateLimitFirestore`, and `analyst/orchestrator.ts`'s `processScan()` (fixed
2026-09-19 after being **confirmed silently failing on every real scan run
today** — not merely unexercised; see "Corrected finding" below). The
remaining ~17 files below are **not fixed** — each will throw the identical
crash on its first real invocation, exactly like these five did.

## Corrected finding: orchestrator.ts was CONFIRMED broken, not just untested

The original audit assumed `processScan()` "likely" crashes on first
invocation. That undersold it: it was traced and confirmed to have crashed
on **every one of Fredrick's real scans today**, silently. The reason it
took a second pass to catch: `analyst/orchestrator.ts` has `'use server'` at
its own file top, making it a **Next.js Server Action** — callable directly
from a client component (`manual-scan-center.tsx` imports `processScan` from
the `@/lib/analyst` barrel), but *always executing on the server* regardless
of the caller. The original 25-file grep found the file and correctly
flagged it as server-only, but the follow-up categorization ("likely next
crash, not yet exercised") didn't check for `'use server'` specifically, so
it didn't register that this file had actually already run — and failed —
on live traffic, invisibly, because the client's `try/catch` around the
`processScan()` call swallows the error into the browser console, never the
server logs.

Confirmed via Firestore trace: after 3 real scans, `analystAlerts`,
`analystIncidents` (both scopes), `pendingActions`, `allScans`, and
`adminEvents` were **all completely empty** — proof the pipeline never got
past its first line (`initializeFirebase()`), for any scan, ever.

**Lesson for the remaining ~17 files below:** don't assume any of them are
purely inert just because no crash has been traced yet. Re-check each for a
`'use server'` directive specifically (not just "is it imported by a `.tsx`
client component directly") before concluding a file's crash is only
theoretical. Re-verified as part of this pass: none of the 17 files below
currently carry `'use server'`, and none are imported (directly or via a
barrel) from a client component — but this check should be repeated before
fixing each one, not trusted from this one snapshot.

Related: [tech-debt-turbopack-firebase-build.md](./tech-debt-turbopack-firebase-build.md)
describes a different bug hit during the same incident (Turbopack's
externalization of `firebase-admin`). This doc is about a separate root
cause: server-only code calling the **client** Firebase SDK, which is
what actually crashes once the Turbopack issue is out of the way.

## Root cause

`src/firebase/index.ts` (source of `initializeFirebase()`) is marked
`'use client'`. Next.js replaces its exports with a runtime proxy when
imported into server-only code (API routes, lib modules never touched by a
client component) — calling it there throws:

```
Error: Attempted to call initializeFirebase() from the server but
initializeFirebase is on the client. It's not possible to invoke a client
function from the server...
```

This was first found and fixed in `src/lib/api-helpers.ts`'s `withAuth`
(2026-09-19 incident). Fixing that surfaced the identical bug one call
downstream, in `blocklist-check.ts` — which is what triggered the full
25-file audit this doc comes from.

## The fix pattern (confirmed correct, used in the 4 files already fixed)

Replace `initializeFirebase()` + the client modular Firestore API
(`doc()`, `getDoc()`, `setDoc()`, `collection()`, `query()`, `getDocs()`,
etc. from `'firebase/firestore'`) with `getAdminFirestore()` (from
`src/lib/firebase-admin.ts`) + the **Admin SDK's class-based chain API**
— these are NOT the same shape:

| Client SDK (modular, wrong for server code) | Admin SDK (correct for server code) |
|---|---|
| `doc(firestore, 'users', uid, 'x', id)` | `firestore.collection('users').doc(uid).collection('x').doc(id)` |
| `getDoc(ref)` | `ref.get()` |
| `snap.exists()` (method) | `snap.exists` (property) |
| `setDoc(ref, data)` | `ref.set(data)` |
| `updateDoc(ref, data)` | `ref.update(data)` |
| `addDoc(collectionRef, data)` | `collectionRef.add(data)` |
| `collection(firestore, 'x')` then `getDocs()` | `firestore.collection('x').get()` |
| `query(collectionRef, where(...), orderBy(...), limit(...))` | `collectionRef.where(...).orderBy(...).limit(...)` |
| `writeBatch(firestore)` | `firestore.batch()` |
| `runTransaction(firestore, fn)` | `firestore.runTransaction(fn)` |
| `serverTimestamp()` | `FieldValue.serverTimestamp()` (import `FieldValue` from `firebase-admin/firestore`) |
| `Timestamp.fromMillis(...)` | Same — `Timestamp` exists on both SDKs with a compatible static API |

`getAdminFirestore()` returns `Firestore | null` (fails closed on Admin SDK
init failure) — every call site must check for `null` and throw (or handle
explicitly), not assume it's always present the way the client SDK's
`initializeFirebase()` did.

## Remaining files (NOT fixed — will crash on first real invocation)

| File | Call sites | Notes |
|---|---|---|
| `src/lib/cases/manager.ts` | 13 | Case management — largest remaining file, multiple read/write/query patterns |
| `src/lib/actions/index.ts` | 12 | Registers `quarantine_email`/`block_url`/`block_number`/`flag_deepfake` — these are invoked by `decide-action`'s `handler(...)` call, which we did NOT fix. **An "approve" decision in the dashboard will still crash** even though `decide-action`'s own pendingActions read/write is now fixed. |
| `src/lib/playbooks/engine.ts` | 5 | `getAction()` registry lookup itself is in-memory and fine; the 5 Firestore call sites are in other exported functions in this file |
| `src/lib/analyst/correlator.ts` | 3 | Cross-module IOC correlation, TI enrichment, CVE matching — called unconditionally by `orchestrator.ts` (now fixed) via `correlateAlerts()`, but does NOT crash the pipeline: all 3 call sites already degrade gracefully on failure (own internal try/catch). Effect of leaving this unfixed: no real TI enrichment, no CVE matching, no cross-module incident merge — silent data gap, not a crash. See "Immediate risk flag" below. |
| `src/lib/notifications/index.ts` | 3 | Push/alert notifications |
| `src/lib/ioc/pipeline.ts` | 4 | IOC extraction/enrichment pipeline, backs `/api/ioc/process` |
| `src/lib/assets/registry.ts` | 2 | Asset CRUD, backs `/api/assets` |
| `src/app/api/threat-intel/ingest/route.ts` | 1 | Admin-triggered threat intel ingestion route |
| `src/lib/threat-intel/orchestrator.ts` | 1 | Coordinates the 4 ingest modules below |
| `src/lib/threat-intel/ingest/otx.ts` | 1 | AlienVault OTX ingestion |
| `src/lib/threat-intel/ingest/urlhaus.ts` | 1 | URLhaus ingestion |
| `src/lib/threat-intel/ingest/abuseipdb.ts` | 1 | AbuseIPDB ingestion |
| `src/lib/threat-intel/ingest/nvd.ts` | 1 | NVD/CVE ingestion |
| `src/lib/threat-intel/ingest/phishtank.ts` | 1 | PhishTank ingestion |

**Fixed:** `src/lib/analyst/orchestrator.ts` — see "Corrected finding" above.

**Not actually bugs — dead imports only, confirmed no call site:**
`src/lib/assets/discovery/azure.ts`, `dns.ts`, `gcp.ts`, `github.ts` each
import `initializeFirebase` but never call it. Safe to leave, or clean up
as a trivial unused-import removal whenever convenient.

## Immediate risk flag — corrected

Initially flagged `correlator.ts` (called unconditionally from
`processScan()`'s Step 6, on every scan) as the next likely crash. On
closer read, it's not: all 3 of its `initializeFirebase()` call sites
(`fetchExistingIncident`, `enrichIOCWithTI`, `findCVEMatches`) are already
wrapped in their own internal `try/catch` that degrades gracefully (returns
`null`/empty on failure) rather than throwing — so `correlateAlerts()` does
not crash `processScan()`, for either a low-risk or high-risk alert. It just
means, **until this file is fixed too**: no real threat-intel enrichment, no
CVE matching, and cross-module incident merging (an existing incident's
correlated alerts) silently no-ops. This does not block the low-risk
re-verification (item 5) or the incident-creation/forensic-report check on a
high-risk test (item 6) — it only means TI enrichment and CVE matching won't
show real data yet even when they'd otherwise apply. (Domain WHOIS/SSL
enrichment — `src/lib/analyst/enrichment.ts`, Step 3, the one the original
"is enrichment running" question was actually about — doesn't touch
Firestore at all and is unaffected by any of this.)

## Why this wasn't fixed in one pass

The Admin SDK's API shape is genuinely different from the client SDK's
(see table above) — this is a real per-call-site rewrite, not a mechanical
import swap, and getting each one wrong risks introducing subtle data bugs
(wrong path segments, `.exists` vs `.exists()`, batch semantics) rather than
an obvious crash. Scoped as a deliberate, unhurried follow-up rather than
rushed alongside the rest of today's incident response.

## Guardrail against this bug class recurring

`scripts/check-server-client-sdk.js` (run via `npm run check:server-sdk`,
wired into `.github/workflows/deploy.yml` before the build step) fails CI
if any server-only file (an API route, a `'use server'` file, or a file
listed in its `KNOWN_SERVER_ONLY_LIB_FILES`) imports `'@/firebase'` or
`'firebase/firestore'`. It's a ratchet, not a full enforcement: the 14
files still listed above as debt are in its `ACCEPTED_EXISTING_DEBT` set
and don't fail the build — but any **new** file introducing this bug from
now on does. When you fix one of the files above, remove it from both
`KNOWN_SERVER_ONLY_LIB_FILES` and `ACCEPTED_EXISTING_DEBT` in that script
so it's fully enforced going forward, not just silently no-longer-violating.

The script can't do real import-graph analysis (only path/directive
heuristics + a hand-maintained list), so it won't catch a brand-new file
that's server-only-reachable but doesn't match an API route path, a
`'use server'` directive, or the explicit list — add it to
`KNOWN_SERVER_ONLY_LIB_FILES` when discovered, the same way this pass added
the 13 lib files above.
