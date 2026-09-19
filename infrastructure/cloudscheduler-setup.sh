#!/bin/bash
# Cloud Scheduler Setup for Da-Costa Svalinn — creates/updates the jobs
# that trigger POST /api/orchestrator/run-scan on a schedule.
#
# Run via CI (.github/workflows/deploy.yml, "Configure Cloud Scheduler"
# step) on every deploy to main — idempotent, so re-running just updates
# the existing jobs in place instead of failing on "already exists".
#
# Requires $SCHEDULER_SECRET in the environment: the same value the app
# reads as SCHEDULER_SECRET (see src/lib/api-helpers.ts's
# withSchedulerAuth) to verify these calls. Never commit this value —
# it's injected from the GitHub Actions secret at deploy time, which is
# why this is a script rather than a static cloudscheduler.yaml (the
# previous version of this file hardcoded an oauthToken/service-account
# target, which src/app/api/orchestrator/run-scan/route.ts's
# withAdminAuth never accepted in the first place — Cloud Scheduler's
# OAuth2 access token is not a Firebase Auth ID token, so every prior
# scheduled invocation would have 401'd even if the jobs had ever been
# created, which they also never were).

set -euo pipefail

PROJECT_ID="da-costa-unisoc23v1-6386-61f95"
LOCATION="europe-west1"
# Firebase's default hosting domain for this project — stable regardless
# of custom-domain DNS status, unlike a raw Cloud Functions/Cloud Run URL
# (frameworksBackend fronts the Next.js app via Firebase Hosting, not a
# bare Cloud Function, so a *.cloudfunctions.net target would never route
# to this API route at all).
BASE_URL="https://${PROJECT_ID}.web.app"
RUN_SCAN_URI="${BASE_URL}/api/orchestrator/run-scan"
THREAT_INTEL_INGEST_URI="${BASE_URL}/api/threat-intel/ingest"
IOC_PROCESS_URI="${BASE_URL}/api/ioc/process"

if [ -z "${SCHEDULER_SECRET:-}" ]; then
  echo "SCHEDULER_SECRET is not set — refusing to create jobs with no way to authenticate them." >&2
  exit 1
fi

AUTH_HEADER="Authorization=Bearer ${SCHEDULER_SECRET}"

create_or_update_job() {
  local name="$1" schedule="$2" target_uri="$3" body="$4" retry_count="$5" max_retry_duration="$6" min_backoff="$7" max_backoff="$8" max_doublings="$9"

  if gcloud scheduler jobs describe "$name" --location="$LOCATION" --project="$PROJECT_ID" >/dev/null 2>&1; then
    echo "Updating existing job: $name"
    gcloud scheduler jobs update http "$name" \
      --location="$LOCATION" \
      --project="$PROJECT_ID" \
      --schedule="$schedule" \
      --time-zone="UTC" \
      --uri="$target_uri" \
      --http-method=POST \
      --message-body="$body" \
      --update-headers="Content-Type=application/json,${AUTH_HEADER}" \
      --max-retry-attempts="$retry_count" \
      --max-retry-duration="$max_retry_duration" \
      --min-backoff="$min_backoff" \
      --max-backoff="$max_backoff" \
      --max-doublings="$max_doublings"
  else
    echo "Creating job: $name"
    gcloud scheduler jobs create http "$name" \
      --location="$LOCATION" \
      --project="$PROJECT_ID" \
      --schedule="$schedule" \
      --time-zone="UTC" \
      --uri="$target_uri" \
      --http-method=POST \
      --message-body="$body" \
      --headers="Content-Type=application/json,${AUTH_HEADER}" \
      --max-retry-attempts="$retry_count" \
      --max-retry-duration="$max_retry_duration" \
      --min-backoff="$min_backoff" \
      --max-backoff="$max_backoff" \
      --max-doublings="$max_doublings"
  fi
}

create_or_update_job "daily-full-scan" "0 2 * * *" "$RUN_SCAN_URI" '{"scanType":"full"}' 3 300s 10s 60s 3
create_or_update_job "hourly-quick-scan" "0 * * * *" "$RUN_SCAN_URI" '{"scanType":"quick"}' 2 120s 5s 30s 2
create_or_update_job "weekly-deep-scan" "0 3 * * 0" "$RUN_SCAN_URI" '{"scanType":"deep"}' 3 600s 30s 120s 4
# Threat feeds don't need hourly freshness -- daily, offset from
# daily-full-scan (02:00) so they don't compete for the same window.
# nvdDaysBack is pinned to 1: the route's own default (7) is sized for
# a manual backfill, not a job that already runs every 24h -- a 7-day
# NVD window returns thousands of CVEs, and ingestNVDCVE's per-CVE
# dedup query is a sequential Firestore round-trip in a for-loop, which
# blows straight through the Cloud Run request timeout (confirmed: a
# real trigger with the 7-day default never completed).
create_or_update_job "daily-threat-intel-ingest" "0 4 * * *" "$THREAT_INTEL_INGEST_URI" '{"source":"all","options":{"nvdDaysBack":1}}' 2 300s 30s 120s 3
# daily-ioc-pipeline is NOT wired yet: runIOCPipeline({source:'both'})
# measured at 281s against real production Firestore (processIOCBatch
# does one sequential adminGetDoc() per normalized IOC group, the same
# N+1 pattern that made the NVD ingestion time out) -- comfortably over
# the 180s Cloud Run request timeout every single run. Scheduling it as
# a POST job here would create a job that fails on every invocation.
# Needs either batched existence checks in processIOCBatch or a
# deliberately narrower scope (e.g. source:'threatIntel' alone, or a
# shorter `since` window) before this is safe to schedule. $IOC_PROCESS_URI
# is left defined above for whichever fix lands.

echo "Cloud Scheduler setup complete!"
gcloud scheduler jobs list --location="$LOCATION" --project="$PROJECT_ID"
