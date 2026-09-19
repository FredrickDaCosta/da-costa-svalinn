# Tech debt: server-only code using the client Firebase SDK

**Status: 17 of 19 real files fixed.** Only 2 confirmed-orphaned files
remain unconverted, deliberately (see "The 2 remaining files" below) —
this is effectively closed as an active bug class, though the guardrail
stays in place permanently (see "Guardrail" below).

Fixed: `blocklist-check.ts`, `run-scan/route.ts`, `decide-action/route.ts`,
`api-helpers.ts`'s `rateLimitFirestore`, `analyst/orchestrator.ts`'s
`processScan()`, `actions/index.ts` (all 12 call sites), `analyst/correlator.ts`
(all 3), `assets/registry.ts` (all 8 exported functions), and — via the new
shared adapter (`src/lib/admin-firestore.ts`, see below) —
`threat-intel/orchestrator.ts`, all 5 `threat-intel/ingest/*.ts` modules,
`threat-intel/ingest/route.ts`, `ioc/pipeline.ts`, and `playbooks/engine.ts`'s
5 Firestore-touching functions.

`assets/registry.ts` was fixed specifically because verifying scheduled
scanning required actually creating a test asset via the real
`/api/assets` POST route (not a Firestore-bypass script) — it was fully
blocked by this exact bug beforehand.

## The shared Admin Firestore adapter

`src/lib/admin-firestore.ts` — built and independently verified (see
`scripts/test-admin-firestore-adapter.ts`) before converting any of the
remaining files — wraps `firebase-admin/firestore`'s class-based API behind
function signatures mirroring the client SDK's modular API
(`adminDoc`/`adminGetDoc`/`adminSetDoc`/`adminUpdateDoc`/`adminAddDoc`/
`adminCollection`/`adminQuery`+`adminWhere`/`adminOrderBy`/`adminLimit`/
`adminBatch`/`adminRunTransaction`/`adminServerTimestamp`/`adminDeleteDoc`),
so converting a file off the client SDK is a close-to-mechanical rename,
not a bespoke rewrite each time. Routes through the same shared
`getAdminFirestore()` instance as everything else, so
`ignoreUndefinedProperties` and any future global config stay centralized.

**This is now the standard for all future server-only Firestore access in
this codebase** — see README.md's "Server-only Firestore access" section.
The pre-adapter files fixed earlier tonight (`blocklist-check.ts`,
`orchestrator.ts`, `actions/index.ts`, `correlator.ts`, `registry.ts`) were
converted directly against the raw Admin SDK, before the adapter existed —
not retroactively migrated to the adapter as part of this pass, since they
were already correct and working; migrating them is optional future
cleanup, not a correctness fix.

## Phase 2 audit findings (precise import-path checks, not assumptions)

- `threat-intel/orchestrator.ts` + all 5 ingest modules + `ioc/pipeline.ts`:
  genuinely wired to real, actively-correct code — but reachable only via
  `/api/threat-intel/ingest` and `/api/ioc/process`, admin routes with **no
  UI button or cron caller anywhere in the app today**. Fixed anyway, since
  the code itself is real and would run the moment anything calls those
  routes.
- `playbooks/engine.ts`: the file itself is critical and actively used
  (`registerAction`/`getAction`, verified working in tonight's Approve/Deny
  test) — but its 5 Firestore-touching functions (`savePlaybook`/
  `getPlaybook`/`listPlaybooks`/`executePlaybook`/`getExecutionHistory`)
  are never called by anything, anywhere. Fixed anyway, same reasoning.
- `cases/manager.ts` and `notifications/index.ts`: **zero importers
  anywhere in the codebase**, confirmed by precise import-path search
  (not filename substring matching, which produced false positives earlier
  tonight). Genuinely orphaned — see below.

## The 2 remaining files — deliberately not converted

`cases/manager.ts` (13 call sites) and `notifications/index.ts` (3 call
sites) are not fixed. Both now carry an explicit `UNUSED` comment at the
top of the file rather than being silently "fixed" as dead code. Per the
task that drove this pass: don't convert unreachable code without saying
so, and flag whether it should be deleted (matching the precedent of an
earlier `threat-orchestrator` prototype removed as dead code) or kept as
scaffolding for a feature that hasn't been wired up yet. **This needs a
decision from Fredrick, not an assumption** — the client/server SDK bug in
each is real and will bite the moment either file gets a real caller, but
neither is a safety-critical gap today since nothing reaches them.

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

## Remaining files (NOT fixed — genuinely orphaned, see above)

| File | Call sites | Status |
|---|---|---|
| `src/lib/cases/manager.ts` | 13 | Zero importers anywhere. Flagged with an `UNUSED` comment, needs a decide-vs-delete call from Fredrick. |
| `src/lib/notifications/index.ts` | 3 | Zero importers anywhere. Same. |

**Fixed:** `src/lib/analyst/orchestrator.ts`, `src/lib/actions/index.ts`,
`src/lib/analyst/correlator.ts`, `src/lib/assets/registry.ts` (direct Admin
SDK, pre-adapter), and — via `src/lib/admin-firestore.ts` —
`src/lib/threat-intel/orchestrator.ts`, all 5
`src/lib/threat-intel/ingest/*.ts` modules, `src/app/api/threat-intel/ingest/route.ts`,
`src/lib/ioc/pipeline.ts`, and `src/lib/playbooks/engine.ts`'s 5
Firestore-touching functions. Each verified directly against real
Firestore (and, where possible, real external APIs) via
`scripts/test-phase4-*.ts` — see each script for exact evidence; summary:
`orchestrator.ts`'s `tiIngestionLogs` write confirmed with real docs;
`ioc/pipeline.ts`'s full read→normalize→write→search→enrich→update chain
confirmed end-to-end with a seeded real doc (external threat-intel feeds
URLhaus/NVD returned real 401/404 errors unrelated to the Firestore fix —
their own auth/availability, not Admin SDK usage); `playbooks/engine.ts`'s
`savePlaybook`/`getPlaybook`/`listPlaybooks` confirmed with real
create/update/read/list — its tag-filtered list variant hit a genuine
Firestore composite-index requirement, a pre-existing property of that
query shape (existed in the original client-SDK code too), not a
regression from this conversion.

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
`'firebase/firestore'`. It's a ratchet, not a full enforcement: the 2
files still listed above as debt (`cases/manager.ts`,
`notifications/index.ts`) are in its `ACCEPTED_EXISTING_DEBT` set and don't
fail the build — but any **new** file introducing this bug from now on
does, and all 17 previously-fixed files are now fully enforced (removed
from both lists as each was fixed). If either remaining file gets wired
up to a real caller, fixing it via `src/lib/admin-firestore.ts` and
removing it from both lists in the script makes the guardrail catch any
future regression.

The script can't do real import-graph analysis (only path/directive
heuristics + a hand-maintained list), so it won't catch a brand-new file
that's server-only-reachable but doesn't match an API route path, a
`'use server'` directive, or the explicit list — add it to
`KNOWN_SERVER_ONLY_LIB_FILES` when discovered, the same way this pass added
the lib files above.
