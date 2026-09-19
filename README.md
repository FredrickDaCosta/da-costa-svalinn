# Da-Costa – Unified Cybersecurity Suite for Africa

This is a Next.js application for Da-Costa, Africa’s first Unified Security Service Edge (SSE) Mobile Cybersecurity Suite.

## Verifying the scan pipeline

Manual click-through testing in a browser cannot reliably verify the
detect → correlate → explain → act pipeline: a client-invoked Server
Action can fail to even dispatch a network request without any visible
error, and Firestore writes have to be traced separately to know whether
anything past the initial AI call actually ran (see
`docs/tech-debt-server-side-client-sdk-usage.md` for the incident that
established this).

The standard way to verify the pipeline is `scripts/verify-scan-pipeline.js`,
which bypasses the browser entirely:

```bash
node scripts/verify-scan-pipeline.js --key-file /path/to/scan-test-harness-key.json
# or set HARNESS_KEY_FILE instead of --key-file, and/or --base-url for a different deployment:
HARNESS_KEY_FILE=/path/to/scan-test-harness-key.json npm run verify:scan-pipeline
node scripts/verify-scan-pipeline.js --key-file /path/to/key.json --base-url http://localhost:9002
```

It mints a real Firebase ID token for a dedicated test user
(`test-harness-user` — never a real account) via the Admin SDK
(`admin.auth().createCustomToken()`, signed locally with the key file's
own private key, no IAM role needed) + Identity Toolkit's
`signInWithCustomToken`, then calls the actual deployed API routes with
that token exactly as the browser would — `/api/scan/analyze-url` (or
`/api/scan/analyze-email`) followed by `/api/scan/log-result` — for a
low-risk case (a `.test` TLD Google-owned test URL), a high-risk case (a
synthetic, non-resolving typosquatting-style URL — never a real malicious
target), and a synthetic BEC/CEO-impersonation email meant to exercise the
`quarantine_email` **gated** auto-action (queued to `pendingActions`
awaiting an authenticated Approve, never auto-executed — see
`docs/tech-debt-server-side-client-sdk-usage.md`'s "act stage" notes; not
guaranteed to trigger, that's Nemotron's judgment call each run). It then
traces Firestore directly (`analystAlerts`, `analystIncidents`,
`pendingActions`, `blockedUrls`, `quarantinedItems`, `allScans`,
`adminEvents`) and reports a verdict: did `processScan()` run end-to-end,
did the risk score correctly gate incident creation, was a forensic report
generated, did `block_url` actually execute (a real `blockedUrls` write,
not just a returned success flag), and did `quarantine_email` correctly
stay gated rather than auto-executing.

Requires two independent credentials, deliberately not shared:
- Application Default Credentials with access to this project's Firebase
  Admin SDK (`gcloud auth application-default login`), used only to trace
  Firestore afterward.
- The `scan-test-harness` service account's key file (below), used only to
  sign custom tokens.
- `NEXT_PUBLIC_FIREBASE_API_KEY` in `.env.local`.

Wipes the test user's prior scan data at the start of each run so results
are never a mix of old and new runs.

### The `scan-test-harness` service account

A dedicated GCP service account,
`scan-test-harness@da-costa-unisoc23v1-6386-61f95.iam.gserviceaccount.com`,
exists **solely** to sign custom tokens for this harness's test user. It:

- Has **zero IAM roles granted** — signing a custom token with a key file
  happens entirely locally against that key's private key; no Firestore,
  Auth, or any other API permission is needed for this use case.
- Is **fully independent of the app's runtime identity**
  (`979829518210-compute@developer.gserviceaccount.com`, the Cloud Run
  service account) — a different account, a different `uniqueId`,
  created and revocable separately.
- Its key file is **never committed** — `.gitignore` blocks
  `*-key.json`/`*service-account*.json` as defense-in-depth, but the key
  itself should live outside this repo entirely (e.g. your local machine
  or a session-scoped scratch directory), passed to the script via
  `--key-file`/`HARNESS_KEY_FILE`.

To recreate it (e.g. after revoking, or on a fresh machine):

```bash
gcloud iam service-accounts create scan-test-harness \
  --project=da-costa-unisoc23v1-6386-61f95 \
  --display-name="Scan Pipeline Test Harness (no roles, key-based signing only)"

gcloud iam service-accounts keys create /path/to/scan-test-harness-key.json \
  --iam-account=scan-test-harness@da-costa-unisoc23v1-6386-61f95.iam.gserviceaccount.com
```

To revoke it entirely when no longer needed:

```bash
gcloud iam service-accounts delete scan-test-harness@da-costa-unisoc23v1-6386-61f95.iam.gserviceaccount.com
```

Deleting the service account immediately invalidates all of its keys — no
separate key revocation step is needed.

## Guarding against server code using the client Firebase SDK

`npm run check:server-sdk` (wired into CI before the build step) fails if
any server-only file — an API route, a `'use server'` file, or a file in
its hand-maintained list — imports the client Firebase SDK instead of the
Admin SDK. See `docs/tech-debt-server-side-client-sdk-usage.md` for the
bug class this guards against and its current known exceptions.
