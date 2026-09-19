# Threat-intel ingestion: wiring and verification

## Status: NVD, OpenPhish, OTX, and URLhaus fully wired and verified with real data. AbuseIPDB's fix is evidence-confirmed but pending its first clean write (real rate limit from testing, not a code issue). PhishTank blocked externally (registration closed). IOC pipeline wired.

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
- URLhaus: originally blocked on a real `401: {"error": "Unauthorized"}` -- abuse.ch
  required a real `Auth-Key`. **Resolved** once `URLHAUS_API_KEY` was added as a GitHub
  secret and wired through (see the "URLhaus, OTX, AbuseIPDB" section below).
- OTX / AbuseIPDB / PhishTank: no log lines at all in every early real run -- confirmed
  graceful no-op, since `runThreatIntelIngestion`'s `if (apiKeys.x)` guards skip them
  entirely when the corresponding env var isn't set. OTX and AbuseIPDB were later
  resolved the same way as URLhaus; PhishTank remains genuinely blocked (see below).

## URLhaus, OTX, AbuseIPDB: real credentials wired, three more real bugs found

`URLHAUS_API_KEY`, `OTX_API_KEY`, and `ABUSEIPDB_API_KEY` were added as GitHub Actions
secrets and wired through `deploy.yml`'s `.env.<project-id>` pass-through (the same
mechanism `OPENROUTER_API_KEY`/`VIRUSTOTAL_API_KEY` already use). As with every other
source tonight, wiring the real key immediately surfaced real bugs that a clean
typecheck/build could never catch:

- **OTX: a confirmed, literal request timeout.** The first real trigger with a live key
  hung, and Cloud Run's own log said outright: *"The request has been terminated
  because it has reached the maximum request timeout"* -- twice (the original call and
  Cloud Scheduler's automatic retry), both stuck at `"Ingesting OTX..."`. Root cause was
  two compounding bugs: `orchestrator.ts` never bounded `ingestOTX`'s fetch window, so
  every call re-fetched OTX's *entire* subscribed-pulse history from page 1 -- and the
  code's existing `since` param name was wrong anyway (OTX's real API parameter is
  `modified_since`, confirmed against their published docs) so it was always silently
  ignored. A hard 40-second sleep between every page meant even 4-5 pages of real data
  alone exceeded the 180s Cloud Run timeout before any indicator processing finished.
  Fixed: corrected the param name, bounded the fetch to a 2-day window, removed the
  blocking sleep entirely, hard-capped `maxPages` at 4 as a safety ceiling, and batched
  `processPulse`'s per-indicator existence check with `adminGetAll()` (same fix pattern
  as `ioc/pipeline.ts`'s `processIOCBatch`). Re-triggered for real: `OTX: 938 IOCs,
  0 errors`, ~22s, no timeout, reproduced consistently across three separate real
  triggers.

- **URLhaus: the API moved from POST to GET.** After adding the `Auth-Key` header
  (fixing the original 401), the next real trigger got a real
  `405 {"query_status":"http_get_expected"}`. Confirmed via WebSearch against abuse.ch's
  current docs and a direct unauthenticated GET curl test (401, not 405, proving GET is
  the accepted method) -- their `urls/recent/` endpoint no longer accepts POST. Fixed:
  switched to a plain GET with just the header; their community feed takes no request
  params (up to 1000 entries from the last 3 days unconditionally), so `options.limit`
  is now a client-side slice. That same real trigger then surfaced a second bug: 54/385
  URLs crashed with `TypeError: a.tags is not iterable` -- some real URLhaus entries
  have `tags: null` despite the type declaring `string[]`. Guarded with `|| []`. Final
  real trigger: `URLhaus: 377 URLs, 0 errors`.

- **AbuseIPDB: this key's `/blacklist` endpoint ignores `plaintext=false`.** The first
  real trigger threw `SyntaxError: Unexpected non-whitespace character after JSON at
  position 6` with `response.ok === true` -- a 200 whose body wasn't the expected
  `{data:[...]}` shape. Rather than guess, raw-body capture/logging was added, and the
  next real trigger showed the actual bytes: a bare newline-delimited IP list (e.g.
  `186.64.123.124\n104.28.214.112\n...`), no per-IP metadata at all. AbuseIPDB's
  JSON-with-metadata output for this endpoint appears to be a subscriber-tier feature
  that a free key's request params can't override -- **a free-tier limitation, not a
  bug**. The IP list itself is still real, usable data (every returned IP already meets
  `confidenceMinimum`, enforced server-side by AbuseIPDB), so the fix parses that
  plaintext format directly instead of treating it as blocked; per-IP score/country/ISP
  aren't available in this mode, so confidence is floored at the confirmed
  `confidenceMinimum` instead of the (unavailable) real score.

  **Honest caveat**: this fix is confirmed correct against the real captured raw-body
  evidence, but has not yet completed a clean successful write to Firestore. Every real
  trigger during tonight's testing either hit the pre-fix parsing bug or, immediately
  after the fix, a genuine AbuseIPDB `429` rate limit -- an artifact of manually
  triggering the job roughly six times within an hour for testing, not a flaw in the
  fix itself. It will get its first real clean confirmation on the next scheduled run
  (04:00 UTC) or whenever it's next manually triggered after the rate-limit window
  resets. `threatIntel` docs with `sources` containing `ABUSEIPDB` do not exist yet as
  of this writing; `OTX` and `URLHAUS` do (verified via
  `scripts/test-phase4-otx-urlhaus-abuseipdb.ts`, e.g. `CVE-2007-3010` from OTX,
  `http://103.160.130.109:52338/bin.sh` from URLhaus).

This brings every planned threat-intel source except PhishTank to fully working,
credentialed, real-data status -- OTX and URLhaus fully confirmed end-to-end, AbuseIPDB
code-correct and evidence-backed, pending only its first clean run.

## Update: PhishTank replaced by OpenPhish

PhishTank closed new user registration, so no API key can be obtained for it --
**external platform restriction, not code or credential debt on our end**. OpenPhish's
free community feed (`https://openphish.com/feed.txt`, plain text, no account/key/
registration needed) now covers phishing URLs in its place. Added
`src/lib/threat-intel/ingest/openphish.ts`, wired into `runThreatIntelIngestion()`
unconditionally (no key gate) alongside the still-present-but-dormant PhishTank module
(kept, not deleted, behind its `apiKeys.phishtank` gate -- resumes automatically with
zero code changes if PhishTank ever reopens registration and a key gets configured). No
separate Cloud Scheduler job needed: it runs as part of `daily-threat-intel-ingest`'s
existing `source:'all'` call.

Verified twice against real data: a direct call (`ingestOpenPhish({limit:200})` -> 200
ingested, 0 errors, real domains) and, more importantly, a real production trigger of
`daily-threat-intel-ingest` itself -- Cloud Run logs showed
`[TI Ingestion] OpenPhish: 300 URLs, 0 errors` running as part of the actual scheduled
job, not just the harness.

## IOC pipeline: now wired (update from this doc's original version)

`src/lib/ioc/pipeline.ts` was originally left deliberately unwired here pending a real
consumer. It now has one: the Admin > IOC Search panel (`/dashboard/admin`), and
`daily-ioc-pipeline` (05:00 UTC, `source:'both'`, after `daily-threat-intel-ingest`) is
live. See the IOC Search panel's own history for the `processIOCBatch` N+1 fix
(281s -> ~52s via a batched `adminGetAll()` read) that made scheduling it safe. This
section is left here only as a pointer forward -- the original "deliberately unwired"
reasoning no longer applies.
