#!/usr/bin/env node
/**
 * Guardrail: fails the build if any server-only file imports the CLIENT
 * Firebase SDK ('@/firebase' or 'firebase/firestore') instead of the
 * Admin SDK ('firebase-admin/firestore' + '@/lib/firebase-admin').
 *
 * A server-only file is either:
 *   - anything under src/app/api/** /route.ts (an API route handler), or
 *   - any .ts/.tsx file whose first statement is the 'use server' directive
 *     (a Next.js Server Action file -- these are callable from client
 *     components but ALWAYS execute on the server, which is exactly the
 *     bug class this guards against: src/lib/analyst/orchestrator.ts had
 *     'use server' and called the client SDK, and it crashed silently on
 *     every real invocation for most of a day before being traced).
 *
 * Run via `npm run check:server-sdk`, wired into CI before the build step.
 */

const fs = require('fs');
const path = require('path');

const SRC_DIR = path.join(__dirname, '..', 'src');
const CLIENT_SDK_PATTERNS = [/from ['"]@\/firebase['"]/, /from ['"]firebase\/firestore['"]/];
const USE_SERVER_RE = /^\s*['"]use server['"]\s*;?/;

/**
 * Server-only lib files that are neither an API route themselves nor
 * carry their own 'use server' directive, but are only ever reachable
 * from one -- pure path/directive heuristics can't discover these
 * (that requires real import-graph analysis, which this script doesn't
 * do). Maintained by hand against docs/tech-debt-server-side-client-sdk-usage.md.
 * Add a file here when it's confirmed server-only reachable, remove it
 * once it's fixed to use the Admin SDK.
 */
const KNOWN_SERVER_ONLY_LIB_FILES = [
  'src/lib/cases/manager.ts',
  'src/lib/notifications/index.ts',
];

/**
 * Ratchet: violations already tracked in docs/tech-debt-server-side-client-sdk-usage.md
 * as deliberately-deferred debt. These are reported but do NOT fail the
 * build -- the point of this check is to catch any NEW file introducing
 * this bug class from this point forward, not to force-fix 17 files' worth
 * of pre-existing, already-documented debt in one go. Remove an entry here
 * (and from KNOWN_SERVER_ONLY_LIB_FILES above, if it's a lib file) once
 * that file is actually fixed -- if it still violates after being removed
 * from this list, the next run will correctly fail the build on it.
 */
const ACCEPTED_EXISTING_DEBT = new Set([
  'src/lib/cases/manager.ts',
  'src/lib/notifications/index.ts',
]);

/** @returns {string[]} all .ts/.tsx file paths under dir, recursively */
function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function isApiRoute(filePath) {
  const rel = path.relative(SRC_DIR, filePath).replace(/\\/g, '/');
  return rel.startsWith('app/api/') && rel.endsWith('/route.ts');
}

function isKnownServerOnlyLib(filePath) {
  const relFromRoot = path.relative(path.join(SRC_DIR, '..'), filePath).replace(/\\/g, '/');
  return KNOWN_SERVER_ONLY_LIB_FILES.includes(relFromRoot);
}

function hasUseServerDirective(content) {
  const firstLine = content.split('\n').find(l => l.trim().length > 0) || '';
  return USE_SERVER_RE.test(firstLine);
}

function usesClientSdk(content) {
  return CLIENT_SDK_PATTERNS.some(re => re.test(content));
}

function main() {
  const allFiles = walk(SRC_DIR);
  const newViolations = [];
  const trackedDebt = [];

  for (const filePath of allFiles) {
    const content = fs.readFileSync(filePath, 'utf8');
    const serverOnly = isApiRoute(filePath) || hasUseServerDirective(content) || isKnownServerOnlyLib(filePath);
    if (!serverOnly) continue;
    if (!usesClientSdk(content)) continue;

    const rel = path.relative(process.cwd(), filePath).replace(/\\/g, '/');
    const reason = isApiRoute(filePath)
      ? 'API route handler'
      : hasUseServerDirective(content)
        ? "'use server' directive"
        : 'known server-only lib file (see KNOWN_SERVER_ONLY_LIB_FILES)';

    if (ACCEPTED_EXISTING_DEBT.has(rel)) {
      trackedDebt.push({ file: rel, reason });
    } else {
      newViolations.push({ file: rel, reason });
    }
  }

  if (trackedDebt.length > 0) {
    console.log(`ℹ ${trackedDebt.length} pre-existing, already-tracked violation(s) (not blocking -- see docs/tech-debt-server-side-client-sdk-usage.md):`);
    for (const v of trackedDebt) console.log(`  ${v.file}  (${v.reason})`);
    console.log('');
  }

  if (newViolations.length > 0) {
    console.error(`✗ ${newViolations.length} NEW server-only file(s) import the client Firebase SDK instead of the Admin SDK:\n`);
    for (const v of newViolations) {
      console.error(`  ${v.file}  (${v.reason})`);
    }
    console.error(
      "\nServer-only code must use getAdminFirestore() from '@/lib/firebase-admin' + firebase-admin/firestore's",
      "class-based API (collection().doc().get()/.set()/.add(), FieldValue.serverTimestamp()), never",
      "initializeFirebase() or 'firebase/firestore' (the client SDK). See",
      "docs/tech-debt-server-side-client-sdk-usage.md for the fix pattern.\n"
    );
    process.exit(1);
  }

  console.log(`✓ No NEW server-only file imports the client Firebase SDK (${allFiles.length} files checked, ${trackedDebt.length} pre-existing debt tracked and not blocking).`);
}

main();
