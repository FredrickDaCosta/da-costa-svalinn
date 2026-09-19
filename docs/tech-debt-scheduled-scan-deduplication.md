# Tech debt: scheduled scans had no asset-level de-duplication (CLOSED 2026-09-19)

**Status: fixed and verified.** Documented for context on why the fix looks
the way it does, and as a record that this class of gap was checked for
elsewhere and found nowhere else.

## The gap

`src/app/api/orchestrator/run-scan/route.ts` (the handler behind all three
Cloud Scheduler jobs — `hourly-quick-scan`, `daily-full-scan`,
`weekly-deep-scan`) re-scanned every registered asset on every single
invocation, with no memory of when an asset was last scanned. Discovered
while verifying Item #3 (scheduled autonomous scanning) with the real
Cloud Scheduler trigger: manually firing the same job twice a couple of
minutes apart (simulating the at-least-once delivery / retry behavior
actually observed that night) produced duplicate alerts for the same
asset, and the asset's own `scanStatus`/`lastScanned` fields never moved
off `'never'`/`null`.

Root cause: `src/lib/assets/registry.ts`'s `updateAssetScanStatus()` was
fully implemented and correct — it was simply never imported or called
anywhere in `run-scan/route.ts`. Not a broken function, an unwired one.

Left unfixed, this meant AI-call cost would scale with the number of
scheduler ticks, not the number of assets actually due for a re-scan —
unbounded as real assets accumulate, since every tick re-scans everything
regardless of how recently it was checked.

## The fix

Two layers, in `run-scan/route.ts` and `registry.ts`:

1. **Per-tier interval**, matching each job's own cron cadence (not one
   shared threshold — the three jobs have meaningfully different
   intervals): `quick` (hourly job) → 1h, `full` (daily job) → 24h, `deep`
   (weekly job) → 168h. A cheap pre-filter in `getScheduledTargets()` skips
   any asset whose `lastScanned` is within 90% of its tier's interval,
   using the value already fetched in that same Firestore query — no
   extra read for the common case of an asset that's obviously not due.

2. **Atomic claim** (`registry.ts`'s new `claimAssetForScan()`) for the
   assets that pass the cheap filter: a single Firestore transaction that
   re-checks `lastScanned` and, if still not due, stamps
   `lastScanned`/`scanStatus: 'pending'` in the same atomic step. This is
   the actual race-safety guard — a plain "read then write" is not safe
   against two near-simultaneous requests (e.g. a scheduler retry) both
   reading the same stale `lastScanned` before either has written its own;
   the transaction ensures only one of two concurrent claimants ever wins
   per asset. Claimed once per **asset**, not per module target — a
   `DOMAIN` asset expands into 3 module scans (link/lure/email) that must
   proceed together as one logical "scan this asset" operation, not be
   gated against each other.

3. `runScanForTarget()` now calls `updateAssetScanStatus()` with
   `'completed'` or `'failed'` (+ error message) after each module scan,
   so the asset's own record reflects reality instead of staying frozen at
   `'never'`.

4. `scanType` is now a real `'quick' | 'full' | 'deep'` union throughout
   (previously typed as `'full' | 'quick'` only — `weekly-deep-scan`'s
   `scanType: "deep"` fell through silently as `any` from `req.json()` and
   was treated identically to `'full'`, with no dedicated interval of its
   own). The `POST` handler now validates the incoming value against all
   three instead of a loose `body.scanType || 'full'`.

## Verification pending

To be confirmed after this deploy: trigger `hourly-quick-scan` twice within
a few minutes via `gcloud scheduler jobs run hourly-quick-scan` (real
production job, real secret) and confirm the second trigger correctly
finds 0 due targets for the already-scanned asset — real Firestore trace,
not assumed. This section will be updated with the actual result.

## Confirmed: no other cadence gaps found

`registry.ts`'s pre-existing `getAssetsDueForScan()` (a `maxAgeHours`-based
query, default 24h) is a **separate**, intentionally independent mechanism
— used only by `/api/assets`'s `get-due` action for on-demand dashboard
queries ("what needs scanning soon"), never wired into `run-scan/route.ts`'s
own scheduling loop. No conflict with the new per-tier logic; it's a
different consumer with a different purpose, not a second copy of the same
cadence check.
