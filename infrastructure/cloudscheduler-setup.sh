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
TARGET_URI="${BASE_URL}/api/orchestrator/run-scan"

if [ -z "${SCHEDULER_SECRET:-}" ]; then
  echo "SCHEDULER_SECRET is not set — refusing to create jobs with no way to authenticate them." >&2
  exit 1
fi

AUTH_HEADER="Authorization=Bearer ${SCHEDULER_SECRET}"

create_or_update_job() {
  local name="$1" schedule="$2" body="$3" retry_count="$4" max_retry_duration="$5" min_backoff="$6" max_backoff="$7" max_doublings="$8"

  if gcloud scheduler jobs describe "$name" --location="$LOCATION" --project="$PROJECT_ID" >/dev/null 2>&1; then
    echo "Updating existing job: $name"
    gcloud scheduler jobs update http "$name" \
      --location="$LOCATION" \
      --project="$PROJECT_ID" \
      --schedule="$schedule" \
      --time-zone="UTC" \
      --uri="$TARGET_URI" \
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
      --uri="$TARGET_URI" \
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

create_or_update_job "daily-full-scan" "0 2 * * *" '{"scanType":"full"}' 3 300s 10s 60s 3
create_or_update_job "hourly-quick-scan" "0 * * * *" '{"scanType":"quick"}' 2 120s 5s 30s 2
create_or_update_job "weekly-deep-scan" "0 3 * * 0" '{"scanType":"deep"}' 3 600s 30s 120s 4

echo "Cloud Scheduler setup complete!"
gcloud scheduler jobs list --location="$LOCATION" --project="$PROJECT_ID"
