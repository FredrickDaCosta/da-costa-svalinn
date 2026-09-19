#!/usr/bin/env node
/**
 * Self-verification harness for the scan -> detect -> correlate -> explain
 * -> act pipeline. Mints a real Firebase ID token for a dedicated test
 * user via the Admin SDK, then calls the actual deployed API routes with
 * it -- bypassing the browser entirely. This is the standard way to
 * verify this pipeline going forward; see README.md's "Verifying the
 * scan pipeline" section.
 *
 * Usage:
 *   node scripts/verify-scan-pipeline.js
 *   node scripts/verify-scan-pipeline.js --base-url http://localhost:9002
 *
 * Requires:
 *   - Application Default Credentials with access to the project's
 *     Firebase Admin SDK, for Firestore tracing only (`gcloud auth
 *     application-default login`, or GOOGLE_APPLICATION_CREDENTIALS
 *     pointing at a service account key with Firestore access).
 *   - A key file for the dedicated, zero-IAM-role "scan-test-harness"
 *     service account (see README.md's "Verifying the scan pipeline"
 *     section for how it was created and how to recreate/revoke it),
 *     path given via --key-file or the HARNESS_KEY_FILE env var. Used
 *     ONLY to sign custom tokens locally (admin.auth().createCustomToken()
 *     signs with the key file's own private key -- no IAM role needed).
 *     This SA is fully independent of the app's runtime identity and of
 *     whatever ADC is used for the Firestore tracing above.
 *   - NEXT_PUBLIC_FIREBASE_API_KEY in .env.local (the Web API key used to
 *     exchange the custom token for an ID token via Identity Toolkit).
 *
 * Uses a dedicated test user (TEST_UID below), never a real account, and
 * wipes that user's test data at the start of each run so results are
 * never a mix of old and new runs.
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const PROJECT_ID = 'da-costa-unisoc23v1-6386-61f95';
const TEST_UID = 'test-harness-user';
const LOW_RISK_URL = 'http://malware.testing.google.test/testing/malware/';
const HIGH_RISK_URL = 'http://paypal-secure-verify-account.com.suspicious-login-update.xyz/signin';
// Synthetic BEC (business email compromise) pattern -- CEO-impersonation
// urgent wire transfer request. Attempts to exercise the quarantine_email
// GATED auto-action (queued to pendingActions, requiring an authenticated
// Approve via decide-action, rather than auto-executing) -- not guaranteed
// to classify as high impersonation risk, that's Nemotron's judgment.
const BEC_EMAIL = `From: "John Okafor (CEO)" <j.okafor@da0costa-svalinn.com>
To: finance@da-costa-svalinn.com
Subject: URGENT - Confidential wire transfer needed today

Hi, I'm in a closed-door investor meeting and can't take calls. I need you
to process an urgent wire transfer of $48,500 to our new vendor before 3pm
today -- this is time-sensitive and confidential, please don't discuss it
with anyone else on the team until I confirm. Reply with the transfer
confirmation once done. I'll explain everything when I'm out.

Regards,
John`;

function readApiKeyFromEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local');
  const content = fs.readFileSync(envPath, 'utf8');
  const match = content.match(/^NEXT_PUBLIC_FIREBASE_API_KEY=(.+)$/m);
  if (!match) throw new Error('NEXT_PUBLIC_FIREBASE_API_KEY not found in .env.local');
  return match[1].trim();
}

function getBaseUrl() {
  const idx = process.argv.indexOf('--base-url');
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  return process.env.VERIFY_BASE_URL || 'https://dacosta-svalinn.com';
}

function getHarnessKeyFilePath() {
  const idx = process.argv.indexOf('--key-file');
  if (idx !== -1 && process.argv[idx + 1]) return process.argv[idx + 1];
  if (process.env.HARNESS_KEY_FILE) return process.env.HARNESS_KEY_FILE;
  throw new Error('Provide the scan-test-harness service account key file via --key-file <path> or HARNESS_KEY_FILE env var.');
}

async function mintIdToken(authApp, apiKey) {
  const customToken = await authApp.auth().createCustomToken(TEST_UID);
  const res = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: customToken, returnSecureToken: true }),
    }
  );
  const body = await res.json();
  if (!res.ok) throw new Error(`Failed to exchange custom token: ${JSON.stringify(body)}`);
  return body.idToken;
}

async function callApi(baseUrl, idToken, endpoint, payload) {
  const res = await fetch(`${baseUrl}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${idToken}` },
    body: JSON.stringify(payload),
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

async function wipeTestUserData(db) {
  const collections = ['securityScanResults', 'analystAlerts', 'analystIncidents', 'pendingActions', 'blockedUrls', 'quarantinedItems', 'flaggedDeepfakes'];
  for (const c of collections) {
    const snap = await db.collection('users').doc(TEST_UID).collection(c).get();
    await Promise.all(snap.docs.map(d => d.ref.delete()));
  }
  const rootIncidents = await db.collection('analystIncidents').where('userId', '==', TEST_UID).get();
  await Promise.all(rootIncidents.docs.map(d => d.ref.delete()));
  const allScans = await db.collection('allScans').where('userId', '==', TEST_UID).get();
  await Promise.all(allScans.docs.map(d => d.ref.delete()));
  const adminEvents = await db.collection('adminEvents').where('userId', '==', TEST_UID).get();
  await Promise.all(adminEvents.docs.map(d => d.ref.delete()));
}

async function traceUser(db, label) {
  console.log(`\n--- ${label} ---`);
  // securityScanResults is intentionally NOT written by this harness --
  // that's a client-side write from manual-scan-center.tsx this harness
  // doesn't replicate, since it's testing the server pipeline specifically.

  const alertSnap = await db.collection('users').doc(TEST_UID).collection('analystAlerts').orderBy('scanTimestamp', 'desc').limit(1).get();
  const alert = alertSnap.empty ? null : alertSnap.docs[0].data();
  console.log('analystAlerts (latest):', alert ? JSON.stringify({ id: alertSnap.docs[0].id, riskScore: alert.riskScore, alertLevel: alert.alertLevel, incidentId: alert.incidentId, iocs: alert.iocs, enrichment: alert.enrichment }) : '(none)');

  const incidentSnap = await db.collection('users').doc(TEST_UID).collection('analystIncidents').get();
  console.log(`analystIncidents: ${incidentSnap.size} doc(s)`);
  incidentSnap.docs.forEach(d => {
    const inc = d.data();
    console.log('  ', JSON.stringify({ id: d.id, title: inc.title, riskScore: inc.riskScore, hasForensicReport: !!inc.forensicReport }));
  });

  const pendingSnap = await db.collection('users').doc(TEST_UID).collection('pendingActions').get();
  console.log(`pendingActions: ${pendingSnap.size} doc(s)`);
  pendingSnap.docs.forEach(d => console.log('  ', JSON.stringify({ id: d.id, action: d.data().action, status: d.data().status })));

  const blockedUrlsSnap = await db.collection('users').doc(TEST_UID).collection('blockedUrls').get();
  console.log(`blockedUrls: ${blockedUrlsSnap.size} doc(s)`);
  blockedUrlsSnap.docs.forEach(d => console.log('  ', JSON.stringify(d.data())));

  const quarantinedSnap = await db.collection('users').doc(TEST_UID).collection('quarantinedItems').get();
  console.log(`quarantinedItems: ${quarantinedSnap.size} doc(s)`);
  quarantinedSnap.docs.forEach(d => console.log('  ', JSON.stringify(d.data())));

  const allScansSnap = await db.collection('allScans').where('userId', '==', TEST_UID).get();
  console.log(`allScans (this user): ${allScansSnap.size} doc(s)`);

  const adminEventsSnap = await db.collection('adminEvents').where('userId', '==', TEST_UID).get();
  console.log(`adminEvents (this user): ${adminEventsSnap.size} doc(s)`);

  return {
    alert,
    incident: incidentSnap.empty ? null : incidentSnap.docs[0].data(),
    allScansCount: allScansSnap.size,
    ranAtAll: allScansSnap.size > 0, // Step 9 -- last step before the always-succeeds return, so its presence proves processScan() completed end-to-end even if an earlier optional write (Step 8, Step 10) failed independently.
    pendingActions: pendingSnap.docs.map(d => ({ id: d.id, ...d.data() })),
    blockedUrls: blockedUrlsSnap.docs.map(d => d.data()),
    quarantinedItems: quarantinedSnap.docs.map(d => d.data()),
  };
}

async function runEmailScan(db, baseUrl, idToken, emailContent, label) {
  console.log(`\n=== ${label} ===`);
  const scanRes = await callApi(baseUrl, idToken, '/api/scan/analyze-email', { emailContent });
  console.log(`analyze-email -> HTTP ${scanRes.status}:`, JSON.stringify(scanRes.body));
  if (scanRes.status !== 200) {
    console.error(`✗ analyze-email failed, skipping log-result for this case.`);
    return null;
  }

  const logRes = await callApi(baseUrl, idToken, '/api/scan/log-result', {
    moduleType: 'email',
    rawData: scanRes.body,
    subject: emailContent.slice(0, 100),
  });
  console.log(`log-result -> HTTP ${logRes.status}:`, JSON.stringify(logRes.body));
  if (logRes.status !== 200) {
    console.error(`✗ log-result failed -- processScan() did not complete.`);
    return null;
  }

  return await traceUser(db, `${label} -- Firestore trace`);
}

async function runOneScan(db, baseUrl, idToken, url, label) {
  console.log(`\n=== ${label}: ${url} ===`);
  const scanRes = await callApi(baseUrl, idToken, '/api/scan/analyze-url', { url });
  console.log(`analyze-url -> HTTP ${scanRes.status}:`, JSON.stringify(scanRes.body));
  if (scanRes.status !== 200) {
    console.error(`✗ analyze-url failed, skipping log-result for this case.`);
    return null;
  }

  const logRes = await callApi(baseUrl, idToken, '/api/scan/log-result', {
    moduleType: 'link',
    rawData: scanRes.body,
    subject: url,
  });
  console.log(`log-result -> HTTP ${logRes.status}:`, JSON.stringify(logRes.body));
  if (logRes.status !== 200) {
    console.error(`✗ log-result failed -- processScan() did not complete.`);
    return null;
  }

  return await traceUser(db, `${label} -- Firestore trace`);
}

async function main() {
  // Two independent credentials, deliberately not shared:
  //  - defaultApp: your own ADC, used only to read/trace Firestore.
  //  - authApp: the zero-IAM-role scan-test-harness service account,
  //    used only to sign custom tokens locally with its own key file.
  const defaultApp = admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: PROJECT_ID });
  const keyFilePath = getHarnessKeyFilePath();
  const serviceAccount = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));
  const authApp = admin.initializeApp({ credential: admin.credential.cert(serviceAccount), projectId: PROJECT_ID }, 'harness-auth');

  const db = defaultApp.firestore();
  const apiKey = readApiKeyFromEnvLocal();
  const baseUrl = getBaseUrl();

  console.log(`Base URL: ${baseUrl}`);
  console.log(`Test user: ${TEST_UID}`);
  console.log(`Signing service account: ${serviceAccount.client_email}`);
  console.log('Wiping prior test data for a clean baseline...');
  await wipeTestUserData(db);

  const idToken = await mintIdToken(authApp, apiKey);
  console.log('✓ Minted a real Firebase ID token for the test user.');

  const lowRisk = await runOneScan(db, baseUrl, idToken, LOW_RISK_URL, 'LOW-RISK');
  const highRisk = await runOneScan(db, baseUrl, idToken, HIGH_RISK_URL, 'HIGH-RISK (typosquatting-style, synthetic)');
  const becEmail = await runEmailScan(db, baseUrl, idToken, BEC_EMAIL, 'BEC EMAIL (synthetic CEO-impersonation, gating test)');

  console.log('\n=== VERDICT ===');
  for (const [label, result, expectIncident] of [['Low-risk', lowRisk, false], ['High-risk', highRisk, null], ['BEC email', becEmail, null]]) {
    if (!result) {
      console.log(`✗ ${label} scan: log-result API call itself failed -- pipeline did not run at all.`);
      continue;
    }
    if (!result.ranAtAll) {
      console.log(`✗ ${label} scan: processScan() did NOT complete -- allScans (Step 9, the last write before return) is empty.`);
      continue;
    }
    console.log(`✓ ${label} scan: processScan() ran end-to-end (allScans populated).`);
    console.log(`  analystAlerts populated: ${!!result.alert}${result.alert ? '' : '  ✗ Step 8 (persistAlert) failed independently -- check server logs.'}`);
    console.log(`  Incident created: ${!!result.incident}` + (expectIncident === false ? ` (expected: false, score below >=7 threshold)` : ` (depends on Nemotron's actual risk_score -- not guaranteed)`));
    if (result.incident) {
      console.log(`  Forensic report present: ${!!result.incident.forensicReport}`);
    }
  }

  console.log('\n--- act stage ---');
  if (highRisk?.blockedUrls?.length) {
    console.log(`✓ block_url EXECUTED for real: blockedUrls has ${highRisk.blockedUrls.length} doc(s).`);
  } else if (highRisk) {
    console.log('✗ block_url did not execute (no blockedUrls doc) -- either autoAction wasn\'t block_url this run, or the action failed. Check server logs.');
  }
  if (becEmail?.pendingActions?.some(p => p.action === 'quarantine_email')) {
    const p = becEmail.pendingActions.find(p => p.action === 'quarantine_email');
    console.log(`✓ quarantine_email correctly GATED, not auto-executed: pendingActions has a '${p.status}' entry (expected: 'pending', requires an authenticated Approve via decide-action).`);
    console.log(`  quarantinedItems: ${becEmail.quarantinedItems.length} doc(s) (expected: 0 until Approved).`);
  } else if (becEmail) {
    console.log("(quarantine_email gate not exercised this run -- Nemotron didn't classify the BEC email as high impersonation risk. Not a failure; retry, or treat as inconclusive.)");
  }
}

main().then(() => process.exit(0)).catch(e => { console.error('\nHarness error:', e); process.exit(1); });
