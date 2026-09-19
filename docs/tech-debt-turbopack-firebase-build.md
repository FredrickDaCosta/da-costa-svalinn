# Tech debt: Turbopack + Firebase Hosting's Next.js auto-build is unreliable

**Status:** Stopgap in place (`IS_WEBPACK_TEST=1` in `.github/workflows/deploy.yml`,
"Deploy to Firebase Hosting" step). Permanent fix below is **not implemented** —
scoped as its own dedicated session, not a blocker for day-to-day work.

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
change, not a cosmetic one — out of scope for this cleanup pass. It's also
very likely moot once the permanent fix above (bypassing Firebase Hosting's
`frameworksBackend` auto-build entirely in favor of a direct Cloud Run deploy)
lands: a direct Cloud Run deployment has no Firebase Hosting proxy layer in
the request path at all (or Hosting could be kept for static assets only,
with dynamic routes going straight to Cloud Run), which would remove this 60s
ceiling as a side effect. Revisit this specifically once that migration is
underway, rather than solving it twice.

## Why this is scoped separately, not fixed today

This is an infrastructure change (new Dockerfile, new deploy steps, secret
injection, domain routing, scheduler target), not an app-code fix. It deserves
a dedicated, unhurried session with its own verification pass, not something
bolted on at the end of a long incident-response day.
