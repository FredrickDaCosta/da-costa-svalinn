# Firestore TTL — Blocklist Collections

Firestore's TTL (time-to-live) feature is what actually deletes expired
blocklist entries. It is **not configurable via `firestore.indexes.json`**
(that file only holds query indexes and field overrides — there's no TTL
schema in it) and there's no equivalent in `firebase.json`. TTL policies
are enabled per collection group, one time, via either the Firebase/GCP
console or the `gcloud` CLI.

## What the app side already does

Every write to the four blocklist collections
(`quarantinedItems`, `blockedUrls`, `blockedNumbers`, `flaggedDeepfakes`,
each under `users/{userId}/...`) now stores an `expiresAt` field —
`Timestamp.fromMillis(Date.now() + 30 days)` — set in
`src/lib/actions/index.ts`'s four blocklist actions
(`quarantineEmailFirestore`, `blockUrlFirestore`, `blockNumberFirestore`,
`flagDeepfakeFirestore`). No app code reads or filters on this field —
once the one-time policy below is enabled, Firestore purges the
document automatically after `expiresAt` passes. There is nothing else
to build on the app side.

## One-time setup (run once per collection group, in the target GCP project)

Project: `da-costa-unisoc23v1-6386-61f95` (from `.firebaserc` / the
active `gcloud config`).

```bash
gcloud firestore fields ttls update expiresAt \
  --collection-group=quarantinedItems \
  --enable-ttl \
  --project=da-costa-unisoc23v1-6386-61f95

gcloud firestore fields ttls update expiresAt \
  --collection-group=blockedUrls \
  --enable-ttl \
  --project=da-costa-unisoc23v1-6386-61f95

gcloud firestore fields ttls update expiresAt \
  --collection-group=blockedNumbers \
  --enable-ttl \
  --project=da-costa-unisoc23v1-6386-61f95

gcloud firestore fields ttls update expiresAt \
  --collection-group=flaggedDeepfakes \
  --enable-ttl \
  --project=da-costa-unisoc23v1-6386-61f95
```

Each of these targets the collection **group** (i.e. every
`users/{userId}/blockedUrls` subcollection across all users at once,
not a single user's subcollection) — this is the correct scope, since
the blocklist lives under each user's own document tree.

Verify a policy took effect (may take a few minutes to move from
`CREATING` to `ACTIVE`). Note: there is no `describe` subcommand in
this gcloud CLI version — use `list` and read the relevant entry:

```bash
gcloud firestore fields ttls list --project=da-costa-unisoc23v1-6386-61f95
```

TTL deletion itself isn't instant — Google's SLA is "usually within 24
hours of expiration," not exactly at the `expiresAt` timestamp. That's
a platform characteristic, not a bug in this setup.

## Status

All 4 policies are enabled and `ACTIVE` in production as of this
writing (confirmed via `gcloud firestore fields ttls list`). This was
a live change to the `da-costa-unisoc23v1-6386-61f95` project, run
only after explicit approval — it was deliberately not run
automatically as part of the code change that added the `expiresAt`
field, since enabling a deletion policy on production data collections
warrants a human's explicit go-ahead rather than being inferred from a
task description.
