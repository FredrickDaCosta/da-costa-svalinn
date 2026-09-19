# Direct Cloud Run deployment, bypassing Firebase Hosting's frameworksBackend
# auto-build (which forces Turbopack in production -- see
# docs/tech-debt-turbopack-firebase-build.md for the full root-cause writeup).
# Builds with `next build --webpack`, the documented public flag, instead of
# the undocumented IS_WEBPACK_TEST env var the old path relies on.

FROM node:22-slim AS builder
WORKDIR /app

# NEXT_PUBLIC_* vars are inlined into the client bundle at build time (see
# next.config.ts's `env` block) -- they are not secrets, so build args are
# the correct mechanism, not a runtime env var / Secret Manager binding.
ARG NEXT_PUBLIC_FIREBASE_API_KEY
ARG NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
ARG NEXT_PUBLIC_FIREBASE_PROJECT_ID
ARG NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
ARG NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
ARG NEXT_PUBLIC_FIREBASE_APP_ID
ARG NEXT_PUBLIC_ADMIN_UID
ENV NEXT_PUBLIC_FIREBASE_API_KEY=$NEXT_PUBLIC_FIREBASE_API_KEY \
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=$NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN \
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=$NEXT_PUBLIC_FIREBASE_PROJECT_ID \
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET \
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=$NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID \
    NEXT_PUBLIC_FIREBASE_APP_ID=$NEXT_PUBLIC_FIREBASE_APP_ID \
    NEXT_PUBLIC_ADMIN_UID=$NEXT_PUBLIC_ADMIN_UID

COPY package.json package-lock.json* ./
# Matches deploy.yml's existing, proven-working CI step exactly: node:22-slim
# ships an older npm (10.x) whose lockfile-sync check for optional platform
# deps (e.g. esbuild's per-platform binaries) is stricter/different than
# npm 11's, and fails `npm ci` on the same package.json/package-lock.json
# pair that GitHub Actions' npm ci (after its own `npm install -g npm@11`
# step) installs cleanly.
RUN npm install -g npm@11
RUN npm ci
COPY . .
RUN npx next build --webpack

# Runtime stage -- separate from the builder so devDependencies (typescript,
# tailwind, eslint, vitest, etc.) don't ship in the serving image.
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json* ./
RUN npm install -g npm@11
RUN npm ci --omit=dev

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

# Cloud Run injects PORT (default 8080) and expects the container to listen
# on it -- next start needs it passed explicitly, it doesn't read $PORT itself.
ENV PORT=8080
EXPOSE 8080
CMD ["sh", "-c", "npx next start -p ${PORT}"]
