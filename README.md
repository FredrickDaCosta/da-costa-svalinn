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
npm run verify:scan-pipeline
# or against a different deployment:
node scripts/verify-scan-pipeline.js --base-url http://localhost:9002
```

It mints a real Firebase ID token for a dedicated test user
(`test-harness-user` — never a real account) via the Admin SDK
(`admin.auth().createCustomToken()` + Identity Toolkit's
`signInWithCustomToken`), then calls the actual deployed API routes with
that token exactly as the browser would — `/api/scan/analyze-url` followed
by `/api/scan/log-result` — for both a low-risk case (a `.test` TLD
Google-owned test URL) and a high-risk case (a synthetic, non-resolving
typosquatting-style URL — never a real malicious target). It then traces
Firestore directly (`securityScanResults`, `analystAlerts`,
`analystIncidents`, `pendingActions`) and reports a verdict: did
`processScan()` actually run end-to-end, did the risk score correctly
gate incident creation, and — for the high-risk case — was a forensic
report generated.

Requires Application Default Credentials with access to this project's
Firebase Admin SDK (`gcloud auth application-default login`) and
`NEXT_PUBLIC_FIREBASE_API_KEY` in `.env.local`. Wipes the test user's prior
scan data at the start of each run so results are never a mix of old and
new runs.

## Guarding against server code using the client Firebase SDK

`npm run check:server-sdk` (wired into CI before the build step) fails if
any server-only file — an API route, a `'use server'` file, or a file in
its hand-maintained list — imports the client Firebase SDK instead of the
Admin SDK. See `docs/tech-debt-server-side-client-sdk-usage.md` for the
bug class this guards against and its current known exceptions.
