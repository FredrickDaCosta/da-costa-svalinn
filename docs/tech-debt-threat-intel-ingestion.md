# Threat-intel ingestion: wiring and verification

## Status: NVD ingestion wired and verified. URLhaus blocked externally. IOC pipeline deliberately unwired.

`/api/threat-intel/ingest` and `/api/ioc/process` were Admin-SDK-correct but had zero
real callers -- no UI button, no cron job, the same "built but unreachable" pattern
found and fixed for `run-scan` earlier the same night. This closes that gap for
threat-intel ingestion (NVD specifically) and documents why IOC processing stays
unwired.

## What's wired

`infrastructure/cloudscheduler-setup.sh` creates `daily-threat-intel-ingest`
(04:00 UTC daily, offset from `daily-full-scan` at 02:00 so they don't compete),
targeting `/api/threat-intel/ingest` with `{"source":"all","options":{"nvdDaysBack":1}}`.
Deployed via the same CI step ("Configure Cloud Scheduler") that already manages the
three scan jobs.

## Five real bugs found and fixed via actual production triggers

Every one of these was invisible from a clean typecheck/build -- each was only found
by triggering the real endpoint against real Firestore and reading the actual error.

1. **NVD date-pairing bug** (`src/lib/threat-intel/ingest/nvd.ts`,
   `incrementalNVDSync`): was setting `pubStartDate` without `pubEndDate`. NVD's API
   404s unless both are set together as full ISO 8601 datetimes (confirmed via direct
   `curl` against the real endpoint -- date-only strings 404 too, even paired). Fixed
   to pass both, `pubEndDate` = now.

2. **Missing composite index on `cves(cveId, updatedAt)`**: the ingest de-dup check
   (`adminWhere('cveId','==',cveId).adminWhere('updatedAt','>',...)`) had no supporting
   index. Every single write failed `FAILED_PRECONDITION` the first time this ran for
   real (478/478 CVEs errored). Added the index to `firestore.indexes.json` and wired
   CI to deploy `firestore:indexes` on every push (previously only `firestore:rules`
   was deployed -- why this was never caught before reaching production).

3. **Unguarded optional NVD fields**: ~5% of real NVD API responses omit
   `weaknesses` and sometimes `references` entirely (unanalyzed/rejected CVEs).
   Unguarded `.flatMap`/`.map` calls on these crashed 23/478 CVEs with
   `Cannot read properties of undefined`. Guarded both with `|| []`.

4. **Missing Cloud Scheduler auth on the route**: `/api/threat-intel/ingest` only
   accepted `withAdminAuth` (Firebase ID token + admin claim) -- Cloud Scheduler
   authenticates with the shared `SCHEDULER_SECRET` header instead, which
   `withAdminAuth` rejects. Every scheduled invocation would have 401'd forever,
   exactly like `run-scan` did before its own fix earlier the same night. Applied the
   identical dual-caller pattern (try `withSchedulerAuth` first, fall back to
   `withAdminAuth`).

5. **7-day default NVD window exceeded the Cloud Run timeout on a daily job**: the
   route defaults `nvdDaysBack` to 7 when no `options` are passed -- sized for a manual
   backfill, not a job that already runs every 24h. A 7-day window returns thousands
   of CVEs, and `ingestNVDCVE`'s per-CVE de-dup query is a sequential Firestore
   round-trip inside a `for` loop; the real scheduled trigger silently hung past the
   Cloud Run request timeout twice with no completion or error logged. Pinned the
   scheduler job's own body to `nvdDaysBack:1`, matching the daily cadence (and the
   window the already-written but unused `runScheduledTIIngestion()` helper always
   intended). Re-triggered for real: completed in ~67s, `NVD: 11 CVEs, 0 errors`.

## Bonus: correlator.ts's findCVEMatches() was silently broken in production

Not part of the ingestion trigger itself, but directly exercised while verifying the
ingestion's downstream effect (per the original verification ask): `findCVEMatches()`
in `src/lib/analyst/correlator.ts` filters on `description` (range) and `cvss` (range)
in the same query. Firestore requires an explicit composite index for range filters on
multiple fields, which never existed -- every call has been failing
`FAILED_PRECONDITION` and silently returning zero matches via its own try/catch, since
the function was written. Added the `cves(cvss, description)` composite index. Verified
against real data: given a real ingested CVE, the equivalent query now returns a real
match (`CVE-2026-93741`, cvss=10).

Note independent of correctness: this matcher does a literal prefix match on the full
English `description` string, so in practice a real IOC value (hostname, hash, IP)
will essentially never be a prefix of a CVE description -- the matcher is reachable
now, but its real-world hit rate is a separate, pre-existing design question, out of
scope here.

## Verified end-to-end (real Firestore/log evidence)

- `gcloud scheduler jobs run daily-threat-intel-ingest` triggered a real Cloud Run
  request. Logs: `[TI Ingestion] NVD: 11 CVEs, 0 errors` /
  `[TI Ingestion] Completed.` (~67s elapsed).
- Direct Firestore read after that run showed fresh `cves` and `threatIntel` docs
  (e.g. `CVE-2026-9858`, `CVE-2026-9766`, `CVE-2026-9613`) with real
  severity/cvss/cwe/source data.
- `findCVEMatches()`'s query, re-run against the same live data, returned a real
  match once its index existed.
- URLhaus: real `401: {"error": "Unauthorized"}` from abuse.ch in production logs on
  every attempt. **External blocker, not code debt** -- abuse.ch now requires a real
  `Auth-Key` per their API policy change. Not something to provision here (creating a
  third-party account is out of scope); needs a real key from abuse.ch before this
  source can produce data.
- OTX / AbuseIPDB / PhishTank: no log lines at all for any of them in every real
  run -- confirmed graceful no-op, since `runThreatIntelIngestion`'s
  `if (apiKeys.otx)` / `if (apiKeys.abuseipdb)` / `if (apiKeys.phishtank)` guards skip
  them entirely when the corresponding env var isn't set (none are configured).

## What's deliberately still unwired

`src/lib/ioc/pipeline.ts` remains correct but has no real consumer: nothing reads the
`iocs` collection it writes to (`correlator.ts` reads directly from `threatIntel`/`cves`,
not from `iocs`). Scheduling it now would recreate the exact "built but unreachable"
pattern this doc closes for ingestion. Revisit when a real consumer (e.g. an admin
search UI over IOCs) gets built.
