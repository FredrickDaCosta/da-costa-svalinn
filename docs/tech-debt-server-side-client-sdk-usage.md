# Tech debt: server-only code using the client Firebase SDK

**Status:** 4 of 23 confirmed call sites fixed (the ones on the paths exercised
by today's incident: `blocklist-check.ts`, `run-scan/route.ts`,
`decide-action/route.ts`, `api-helpers.ts`'s `rateLimitFirestore`). The
remaining ~18 files below are **not fixed** — each will throw the identical
crash on its first real invocation, exactly like the four above did.

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
| `src/lib/analyst/correlator.ts` | 3 | Cross-module IOC correlation into incidents |
| `src/lib/notifications/index.ts` | 3 | Push/alert notifications |
| `src/lib/ioc/pipeline.ts` | 4 | IOC extraction/enrichment pipeline, backs `/api/ioc/process` |
| `src/lib/assets/registry.ts` | 2 | Asset CRUD, backs `/api/assets` |
| `src/lib/analyst/orchestrator.ts` | 1 | `processScan()` — called by **every** scan route after a successful AI call. Analyze-url's blocklist-miss path (the real scan we're about to test) reaches this. **High priority** — likely the very next crash if a scan gets past the blocklist check with a miss. |
| `src/app/api/threat-intel/ingest/route.ts` | 1 | Admin-triggered threat intel ingestion route |
| `src/lib/threat-intel/orchestrator.ts` | 1 | Coordinates the 4 ingest modules below |
| `src/lib/threat-intel/ingest/otx.ts` | 1 | AlienVault OTX ingestion |
| `src/lib/threat-intel/ingest/urlhaus.ts` | 1 | URLhaus ingestion |
| `src/lib/threat-intel/ingest/abuseipdb.ts` | 1 | AbuseIPDB ingestion |
| `src/lib/threat-intel/ingest/nvd.ts` | 1 | NVD/CVE ingestion |
| `src/lib/threat-intel/ingest/phishtank.ts` | 1 | PhishTank ingestion |

**Not actually bugs — dead imports only, confirmed no call site:**
`src/lib/assets/discovery/azure.ts`, `dns.ts`, `gcp.ts`, `github.ts` each
import `initializeFirebase` but never call it. Safe to leave, or clean up
as a trivial unused-import removal whenever convenient.

## Immediate risk flag

`src/lib/analyst/orchestrator.ts`'s `processScan()` is the most likely
**next** crash: it's called after every scan module's AI call, on the exact
path a real Link Scrutinizer scan takes once it passes the (now-fixed)
blocklist check. If today's real end-to-end test gets further than the
blocklist stage, this is where to look first.

## Why this wasn't fixed in one pass

The Admin SDK's API shape is genuinely different from the client SDK's
(see table above) — this is a real per-call-site rewrite, not a mechanical
import swap, and getting each one wrong risks introducing subtle data bugs
(wrong path segments, `.exists` vs `.exists()`, batch semantics) rather than
an obvious crash. Scoped as a deliberate, unhurried follow-up rather than
rushed alongside the rest of today's incident response.
