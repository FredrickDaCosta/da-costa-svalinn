# Tech debt: Turbopack + Firebase Hosting's Next.js auto-build is unreliable

**Status: CLOSED (2026-09-19).** The permanent fix described below is implemented,
deployed, and verified with real production evidence. `dacosta-svalinn.com` now
serves from `svalinn-ssr`, a self-managed Cloud Run service built with
`next build --webpack` via a real Dockerfile -- no Firebase Hosting
`frameworksBackend`, no Turbopack, no `IS_WEBPACK_TEST`. The old
`frameworksBackend`-managed service (`ssrdacostaunisoc23v1638`) has been deleted.
See "Migration closure" at the bottom for the full real-evidence record,
including a real incident that happened during the cutover itself.

## Root cause (confirmed 2026-09-18/19 incident)

`firebase-admin` (and any dual CJS/ESM package with subpath exports, e.g.
`firebase-admin/auth`, `firebase-admin/app`) breaks under Turbopack in production
builds. Marking it `serverExternalPackages` in `next.config.ts` makes Turbopack
treat it as external, but Turbopack's runtime `externalImport` wrapper resolves
the externalized module through a **synthetic, content-hashed module id**
(e.g. `firebase-admin-a14c8a5423a75469/auth`) that does not correspond to
anything actually emitted into the deployed `.next/server` output. The result is
`Error [ERR_MODULE_NOT_FOUND]: Cannot find package 'firebase-admin-<hash>'`
at runtime, on every call.

This is **not fixed by lazy dynamic `import()`** — that was tried first
(`src/lib/api-helpers.ts`, matching the pattern already used in
`src/lib/firebase-admin.ts` and `src/lib/actions/index.ts`) and initially
appeared to work, then silently regressed after an unrelated code edit shifted
Turbopack's chunk-splitting for that file. During the same incident,
`src/lib/firebase-admin.ts`'s lazy import — the pattern everything else copied —
was independently confirmed broken too (degrading gracefully instead of
crashing, which is why it went unnoticed). The hash is stable per *package*,
not per call site or per import style, so this is a **Turbopack bundler bug**,
not something fixable by changing how or where the import happens.

Confirmed via direct build inspection: a `next build --webpack` build of the
identical source produces a plain, uncorrupted `a.exports = import("firebase-admin/auth")`
in the compiled route chunk — grepping the entire webpack `.next/server/` output
for the hashed pattern returns zero matches. Webpack's externals handling for
this class of package does not have this bug.

## Why the stopgap is a stopgap, not a fix

Changing `package.json`'s `build` script to `next build --webpack` has **no
effect on the actual deployed code**. Firebase Hosting's Next.js framework
auto-detection (`hosting.frameworksBackend` in `firebase.json`) does not run
`npm run build` — `firebase-tools`' Next.js adapter
(`lib/frameworks/next/index.js`) explicitly warns that a custom `package.json`
build script is ignored, and always spawns the bare `next` binary with just
`build`, with no way to pass `--webpack` through `firebase deploy`. Confirmed
by pulling the actual "Deploy to Firebase Hosting" CI step logs, which show
Firebase's own internal rebuild: `▲ Next.js 16.2.3 (Turbopack)`.

The only mechanism found that forces webpack through this path is the
`IS_WEBPACK_TEST=1` environment variable, which Next.js's CLI bundler-arg
parser (`next/dist/lib/bundler.js`) checks in the same code path as `--webpack`
— but it exists for Next's own internal test suite, is not documented public
API, and carries no semver guarantee. `firebase-tools`' spawn call forwards
`env`, so setting it in the workflow step's `env:` block does reach Next's
build process. This is what's currently deployed. It works today. It is not
guaranteed to keep working across a Next.js upgrade.

## Permanent fix: bypass Firebase's Next.js framework auto-build entirely

Replace the `frameworksBackend`-driven deploy with a direct Cloud Run
deployment we fully control:

1. **Dockerfile** that runs `npm run build` (using webpack via the documented
   `--webpack` flag, no undocumented env var) and starts the app with
   `next start`.
2. **`gcloud run deploy`** (or `gcloud builds submit` + `gcloud run deploy`)
   replacing the "Deploy to Firebase Hosting" step for the SSR backend.
   Firebase Hosting can still be kept for static asset serving / custom-domain
   rewrites if desired, pointed at the Cloud Run service — or dropped in favor
   of Cloud Run serving the domain directly.
3. **Env var injection**: Firebase's frameworksBackend currently writes a
   `.env` file into the serving revision automatically ("Create Firebase
   project env file" step) and threads secrets (`OPENROUTER_API_KEY`, Firebase
   config, etc.) through its own mechanism. A direct Cloud Run deploy needs to
   replicate this explicitly — via `gcloud run deploy --set-env-vars` /
   `--set-secrets`, or a build-time `.env` file baked into the image.
4. **Custom domain routing**: `dacosta-svalinn.com` currently resolves through
   Firebase Hosting's rewrite to whichever revision the frameworksBackend
   pinned (a tagged revision distinct from the one `gcloud run services
   describe` reports as receiving 100% Cloud Run traffic — see the incident
   notes below). This needs to be re-verified end-to-end after the switch:
   confirm the custom domain actually serves the Cloud Run revision from the
   new deploy path, not a stale one.
5. **Cloud Scheduler target**: `infrastructure/cloudscheduler-setup.sh` targets
   `https://${PROJECT_ID}.web.app/api/orchestrator/run-scan` (Firebase's
   default hosting domain). Confirm this still resolves correctly if Firebase
   Hosting's role changes, or repoint it at the Cloud Run URL directly.

## Related incident note: two revision-naming schemes

During this incident it became clear the deploy produces **two different
Cloud Run revisions per push**: one from `firebase deploy --only hosting`
(tagged, e.g. `ssrdacostaunisoc23v1638-00390-yuz`) which actually serves
`dacosta-svalinn.com` via Firebase Hosting's rewrite, and one from the
"Set Cloud Run timeout" step's `gcloud run services update` (e.g.
`ssrdacostaunisoc23v1638-00240-j6s`) which is what `gcloud run services
describe --format="value(status.latestReadyRevisionName)"` reports and what
receives 100% *Cloud Run* traffic — a signal that turned out to be checking
the wrong revision for verifying what the custom domain actually serves. Any
future verification script should pull the revision name from a live request's
`resource.labels.revision_name` in Cloud Logging, not from `gcloud run
services describe`, until/unless the permanent fix collapses this to a single
deploy path.

**Concrete, now-fixed consequence (2026-09-19):** the "Set Cloud Run timeout"
step's `gcloud run services update --timeout=120` was updating the *wrong*
revision series the entire time -- confirmed via `scripts/verify-scan-pipeline.js`
hitting a genuine `504`/timeout on a real, slower AI-call scan in production.
`gcloud run revisions list --format="table(metadata.name,spec.timeoutSeconds)"`
showed the Firebase-Hosting-created series stuck at Cloud Run's untouched 60s
default while the `gcloud`-updated series correctly showed 120s -- proof the
step never affected real traffic. Root cause: `firebase.json`'s
`hosting.frameworksBackend` object is passed directly as the options to a
Cloud Functions v2 `onRequest()` call (`lib/frameworks/index.js` in
firebase-tools), so it's deployed as a 2nd-gen Cloud Function (Cloud Run under
the hood) configured by *that* options object, entirely independent of
anything a post-deploy `gcloud run services update` touches. Fixed by adding
`"timeoutSeconds": 180` directly to `frameworksBackend` in `firebase.json` --
the correct, native lever -- and removing the now-redundant "Set Cloud Run
timeout" step from `deploy.yml` entirely. This resolves the *timeout*
symptom specifically; the underlying two-revision structure (and everything
else in this doc) is unchanged and still applies.

## Related, separate limitation: Firebase Hosting's proxy layer has its own hard 60s timeout

Discovered during the BEC-email harness test that verified `quarantine_email`
gating: a slow request to `/api/scan/log-result` (and potentially other scan
routes) can receive a `502` with an empty body client-side, even though the
request was entirely legitimate. Confirmed via Cloud Run logs that the server
itself completed the same request successfully — a real `200` at 62.57s
latency, well inside the `180s` `timeoutSeconds` configured in `firebase.json`'s
`hosting.frameworksBackend` (see above). A direct Firestore query confirmed
the real write landed correctly regardless of what the client saw. **Not a
correctness or data-loss issue** — purely a response-delivery UX problem on
slow requests.

Root cause, confirmed against Firebase's own docs: Firebase Hosting's
rewrite/proxy layer enforces its own **hard 60-second request timeout**,
completely independent of and unconfigurable relative to the Cloud Run
service's own `timeoutSeconds`. This is documented Firebase Hosting behavior,
not a bug — there's a long-standing public Firebase feature request asking
for it to be made configurable, which as of this writing remains open and
unimplemented. No `firebase.json` setting, `frameworksBackend` option, or
Cloud Run config can raise this ceiling; it applies to every request proxied
through Hosting's rewrite, regardless of how the backend itself is configured.

**Not fixed here, deliberately.** A real mitigation (e.g. converting slow scan
routes to an immediate `202`-style "processing" response with client-side
polling for the result) would be a genuine API-contract and client-behavior
change, not a cosmetic one — out of scope for this cleanup pass.

**Correction (2026-09-19, during Phase 0 of the Turbopack/Cloud Run migration
below):** the paragraph above originally assumed this would be resolved as a
side effect of the migration. That assumption was wrong and has been
verified against Firebase's own docs before the migration was scoped: the
hard 60s timeout is **not specific to the `frameworksBackend`/Cloud-Functions
path** — it applies to *any* Firebase Hosting rewrite, including the
documented `"run": {serviceId, region}` rewrite used to point Hosting at an
existing, self-managed Cloud Run service (which is exactly what the migration
below does). Google's docs state it plainly: even a correctly-configured
longer backend timeout still gets a `504` from Hosting past 60s. The
migration below was explicitly scoped to keep Firebase Hosting in front as
the custom-domain/CDN layer, so **this 502/60s limitation is confirmed to
remain, unchanged, after that migration lands** — it fixes the
Turbopack/`ERR_MODULE_NOT_FOUND` bug only. Fixing the timeout for real would
require dropping Firebase Hosting from the dynamic request path entirely
(e.g. Cloud Run's own custom domain mapping), a materially bigger change,
explicitly out of scope here, deferred to its own future decision if ever
prioritized.

## Migration closure (2026-09-19)

Implemented in six phases, each verified with real production evidence before
proceeding to the next, per the standing discipline of this whole session:

- **Phase 0 (audit):** catalogued the frameworksBackend service's real config
  (1 CPU/256Mi, `timeoutSeconds:180`, the full env var set, plus
  Functions-framework-injected vars like `FIREBASE_CONFIG`/`GCLOUD_PROJECT`
  a plain Cloud Run deploy wouldn't get automatically) and confirmed via
  Firebase's own docs that the 60s Hosting-proxy limit (see above) is
  unaffected by this migration either way -- corrected an earlier wrong
  assumption to the contrary before any code changed.
- **Phase 1 (Dockerfile + smoke test):** built a multi-stage Dockerfile
  (`next build --webpack`, the documented public flag). Deployed to a
  throwaway Cloud Run service and confirmed the actual bug this migration
  exists to fix is gone: a route touching `firebase-admin/auth` returned a
  clean `401`, not `ERR_MODULE_NOT_FOUND`.
- **Phase 2 (permanent service, manual deploy):** deployed `svalinn-ssr`
  with full real secrets (via a manually-triggered CI job, since secret
  values are only ever available inside GitHub Actions' own execution
  context). Verified a real scheduler-authenticated Firestore write
  succeeded and was independently confirmed fresh -- proving
  `applicationDefault()` credential resolution works with **zero** of the
  Functions-framework-injected vars present.
- **Phase 3 (automated CI):** promoted the same workflow to push-triggered,
  running side by side with the old `deploy.yml` with zero interference.
  Confirmed via the automated run's own build log:
  `▲ Next.js 16.2.3 (webpack)`.
- **Phase 4/5 (the cutover):** repointed `firebase.json`'s Hosting rewrite
  from `frameworksBackend` to a plain `"run"` rewrite targeting `svalinn-ssr`.
  **Two real problems surfaced during the cutover itself and were caught
  before/shortly after reaching production, not assumed away:**
  1. Removing `frameworksBackend` alone did **not** stop Firebase's Next.js
     auto-detection -- a real deploy attempt still ran Firebase's own
     Turbopack build. Caught before it reached production. Root cause:
     framework detection is driven by `hosting.source` pointing at a
     directory with `package.json`/`next.config`, independent of
     `frameworksBackend`. Fixed by switching to `hosting.public` (which
     doesn't trigger framework detection) pointed at a dedicated,
     otherwise-empty `hosting-placeholder/` directory.
  2. The first version of that fix used the existing `public/` directory,
     which contains an unrelated leftover static `index.html` (an old
     account-deletion page). Firebase Hosting matches static files
     *before* falling through to rewrites, so **this served the wrong
     page to real production traffic for ~2m23s** (19:20:21-19:22:44 UTC)
     before being caught by checking the actual response body and fixed
     via the dedicated placeholder directory.

     After the fix: root page, auth rejection, and all 5 real Cloud
     Scheduler jobs (daily-full-scan, hourly-quick-scan, weekly-deep-scan,
     daily-threat-intel-ingest, daily-ioc-pipeline) verified working
     against the live custom domain, with a real Firestore write
     independently confirmed fresh. SSL certificate unaffected.
     Two full subsequent automated deploy cycles (one from each pipeline)
     landed cleanly on top of the manual cutover with no regression --
     confirmed `deploy.yml`'s own Hosting step dropped from ~6-8 minutes to
     ~2m32s total, with its log showing `found 1 files in hosting-placeholder`
     and no trace of Next.js/Turbopack.
- **Phase 6 (decommissioning):** deleted `ssrdacostaunisoc23v1638` (confirmed
  vestigial and unreferenced except in comments/docs first) and the
  throwaway Phase 1 smoke-test service. Removed `IS_WEBPACK_TEST` and the
  now-dead "Build Next.js app" / "Create Firebase project env file" steps
  from `deploy.yml` (neither fed into anything once `frameworksBackend`
  was gone). Renamed `deploy-cloudrun-direct.yml` to `deploy-app.yml` (the
  app's canonical deploy pipeline) and re-scoped `deploy.yml` to what it
  actually still owns: WebAuthn Cloud Functions, Firestore rules/indexes,
  the Hosting rewrite config, and Cloud Scheduler.

**The 502/60s Hosting-proxy limitation (above) was not re-tested with a
live slow request during closure** -- the fix would require dropping
Firebase Hosting from the dynamic request path entirely, which this
migration deliberately did not do (Hosting was kept as the custom-domain/CDN
layer throughout, per an explicit scope decision at Phase 0). It remains
open, unchanged, exactly as documented above, and deferred to its own future
decision if ever prioritized.
