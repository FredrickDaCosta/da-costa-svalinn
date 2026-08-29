#!/bin/bash
# Cloud Tasks Setup Script for Da-Costa Svalinn
# Run this after deploying to create the task queues

PROJECT_ID="da-costa-unisoc23v1-6386-61f95"
LOCATION="europe-west1"
SERVICE_ACCOUNT="scheduler-runner@${PROJECT_ID}.iam.gserviceaccount.com"

echo "Creating Cloud Tasks queues..."

# Main agent loop queue
gcloud tasks queues create analyst-agent-loop \
  --location=$LOCATION \
  --max-dispatches-per-second=10 \
  --max-concurrent-dispatches=20 \
  --max-attempts=5 \
  --max-retry-duration=3600s \
  --min-backoff=10s \
  --max-backoff=300s \
  --max-doublings=3 \
  --project=$PROJECT_ID

# Scheduled scan callback queue
gcloud tasks queues create scheduled-scan-callback \
  --location=$LOCATION \
  --max-dispatches-per-second=5 \
  --max-concurrent-dispatches=10 \
  --max-attempts=3 \
  --max-retry-duration=600s \
  --min-backoff=30s \
  --max-backoff=120s \
  --max-doublings=2 \
  --project=$PROJECT_ID

# Notification dispatch queue
gcloud tasks queues create notification-dispatch \
  --location=$LOCATION \
  --max-dispatches-per-second=20 \
  --max-concurrent-dispatches=50 \
  --max-attempts=3 \
  --max-retry-duration=300s \
  --min-backoff=5s \
  --max-backoff=60s \
  --max-doublings=2 \
  --project=$PROJECT_ID

# IOC processing queue
gcloud tasks queues create ioc-processing \
  --location=$LOCATION \
  --max-dispatches-per-second=10 \
  --max-concurrent-dispatches=20 \
  --max-attempts=5 \
  --max-retry-duration=600s \
  --min-backoff=10s \
  --max-backoff=120s \
  --max-doublings=3 \
  --project=$PROJECT_ID

# Playbook execution queue
gcloud tasks queues create playbook-execution \
  --location=$LOCATION \
  --max-dispatches-per-second=5 \
  --max-concurrent-dispatches=10 \
  --max-attempts=3 \
  --max-retry-duration=600s \
  --min-backoff=10s \
  --max-backoff=120s \
  --max-doublings=2 \
  --project=$PROJECT_ID

echo "Creating service account for Cloud Tasks..."
gcloud iam service-accounts create scheduler-runner \
  --display-name="Cloud Scheduler/Tasks Runner" \
  --project=$PROJECT_ID || echo "Service account may already exist"

# Grant necessary permissions
gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/cloudtasks.enqueuer" \
  --condition=None

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/datastore.user" \
  --condition=None

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/logging.logWriter" \
  --condition=None

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:$SERVICE_ACCOUNT" \
  --role="roles/monitoring.metricWriter" \
  --condition=None

echo "Cloud Tasks setup complete!"
echo "Queues created:"
gcloud tasks queues list --location=$LOCATION --project=$PROJECT_ID