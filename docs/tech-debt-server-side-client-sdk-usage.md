# Tech debt: server-only code using the client Firebase SDK

**Status:** 8 files fixed: `blocklist-check.ts`, `run-scan/route.ts`,
`decide-action/route.ts`, `api-helpers.ts`'s `rateLimitFirestore`,
`analyst/orchestrator.ts`'s `processScan()`, `actions/index.ts` (all 12 call
sites: the real Gmail/Twilio/FCM/IAM integrations plus the four analyst
auto-response actions `quarantine_email`/`block_url`/`block_number`/
`flag_deepfake`), `analyst/correlator.ts` (all 3 call sites), and — fixed
while verifying Item #3 (scheduled scanning) — `assets/registry.ts` (all
call sites: `createAsset`/`getAsset`/`listAssets`/`updateAsset`/
`deleteAsset`/`bulkCreateAssets`/`getAssetsDueForScan`/`searchAssets`,
backing `/api/assets`). The remaining 10 files below are **not fixed** —
each will throw the identical crash on its first real invocation, exactly
like the eight above did before being fixed.

`assets/registry.ts` was fixed specifically because verifying scheduled
scanning required actually creating a test asset via the real
`/api/assets` POST route (not a Firestore-bypass script) — it was fully
blocked by this exact bug beforehand.

## `actions/index.ts` + `correlator.ts` fixed (2026-09-19) — the "act" stage

These were confirmed via `scripts/verify-scan-pipeline.js`'s high-risk test:
`autoResponse` for `block_url` came back `success: false` with the exact
`initializeFirebase()` client/server error, even though detect → correlate →
explain (risk score, incident creation, forensic report) all worked
correctly. Unlike `orchestrator.ts`, every one of `actions/index.ts`'s 12
call sites was already wrapped in its own try/catch that returns a
structured `{success: false, error}` — so this never crashed silently, it
just never actually executed the block/quarantine/flag action. Re-audited
both files first per the `orchestrator.ts` lesson: neither carries `'use
server'`, and precise import-path checks (not just filename substring
matching) confirmed neither is imported by any `.tsx` file — genuinely
server-only, not dual-context. `correlator.ts`'s 3 sites were re-confirmed
to still degrade gracefully (own internal try/catch, unchanged from the
earlier note below) before converting them, same as `actions/index.ts`'s.

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

Re-confirmed 2026-09-19 (per the `orchestrator.ts` lesson): none of these 10
carry `'use server'`, and a precise import-path check (not filename
substring matching, which produces false positives — e.g. "manager" and
"engine" match unrelated files) confirmed none are imported by any `.tsx`
file. All genuinely server-only, non-dual-context, status unchanged from
before this pass.

| File | Call sites | Notes |
|---|---|---|
| `src/lib/cases/manager.ts` | 13 | Case management — largest remaining file, multiple read/write/query patterns |
| `src/lib/playbooks/engine.ts` | 5 | `getAction()` registry lookup itself is in-memory and fine; the 5 Firestore call sites are in other exported functions in this file |
| `src/lib/notifications/index.ts` | 3 | Push/alert notifications |
| `src/lib/ioc/pipeline.ts` | 4 | IOC extraction/enrichment pipeline, backs `/api/ioc/process` |
| `src/app/api/threat-intel/ingest/route.ts` | 1 | Admin-triggered threat intel ingestion route |
| `src/lib/threat-intel/orchestrator.ts` | 1 | Coordinates the 4 ingest modules below |
| `src/lib/threat-intel/ingest/otx.ts` | 1 | AlienVault OTX ingestion |
| `src/lib/threat-intel/ingest/urlhaus.ts` | 1 | URLhaus ingestion |
| `src/lib/threat-intel/ingest/abuseipdb.ts` | 1 | AbuseIPDB ingestion |
| `src/lib/threat-intel/ingest/nvd.ts` | 1 | NVD/CVE ingestion |
| `src/lib/threat-intel/ingest/phishtank.ts` | 1 | PhishTank ingestion |

**Fixed:** `src/lib/analyst/orchestrator.ts`, `src/lib/actions/index.ts`,
`src/lib/analyst/correlator.ts`, `src/lib/assets/registry.ts` — see the notes above.

**Not actually bugs — dead imports only, confirmed no call site:**
`src/lib/assets/discovery/azure.ts`, `dns.ts`, `gcp.ts`, `github.ts` each
import `initializeFirebase` but never call it. Safe to leave, or clean up
as a trivial unused-import removal whenever convenient.

## Immediate risk flag — resolved

`correlator.ts` is now fixed (see above) — TI enrichment, CVE matching, and
cross-module incident merging now run against the Admin SDK like everything
else. (Domain WHOIS/SSL enrichment — `src/lib/analyst/enrichment.ts`, Step 3
— never touched Firestore at all and was never affected by any of this.)

The `actions/index.ts` fix means the auto-response actions
(`quarantine_email`/`block_url`/`block_number`/`flag_deepfake`) now
genuinely execute rather than returning a structured failure. Verified via
`scripts/verify-scan-pipeline.js`'s high-risk test: `blockedUrls` now gets a
real document when a high-risk scan's triage recommends `block_url`.
`quarantine_email` and `flag_deepfake` are gated (queued to `pendingActions`,
requiring an authenticated Approve via `decide-action`) rather than
auto-executing — not yet separately verified end-to-end with a real Approve
call as of this fix; that's the natural next verification step.

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
`'firebase/firestore'`. It's a ratchet, not a full enforcement: the 10
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
