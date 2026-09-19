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
 *     Firebase Admin SDK (`gcloud auth application-default login`, or
 *     GOOGLE_APPLICATION_CREDENTIALS pointing at a service account key).
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

async function mintIdToken(apiKey) {
  const customToken = await admin.auth().createCustomToken(TEST_UID);
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
  const collections = ['securityScanResults', 'analystAlerts', 'analystIncidents', 'pendingActions'];
  for (const c of collections) {
    const snap = await db.collection('users').doc(TEST_UID).collection(c).get();
    await Promise.all(snap.docs.map(d => d.ref.delete()));
  }
  const rootIncidents = await db.collection('analystIncidents').where('userId', '==', TEST_UID).get();
  await Promise.all(rootIncidents.docs.map(d => d.ref.delete()));
}

async function traceUser(db, label) {
  console.log(`\n--- ${label} ---`);
  const scanSnap = await db.collection('users').doc(TEST_UID).collection('securityScanResults').orderBy('scanTimestamp', 'desc').limit(1).get();
  console.log('securityScanResults (latest):', scanSnap.empty ? '(none)' : JSON.stringify(scanSnap.docs[0].data()));

  const alertSnap = await db.collection('users').doc(TEST_UID).collection('analystAlerts').orderBy('scanTimestamp', 'desc').limit(1).get();
  const alert = alertSnap.empty ? null : alertSnap.docs[0].data();
  console.log('analystAlerts (latest):', alert ? JSON.stringify({ id: alertSnap.docs[0].id, riskScore: alert.riskScore, alertLevel: alert.alertLevel, incidentId: alert.incidentId, iocs: alert.iocs, enrichment: alert.enrichment }) : '(none -- processScan did not run)');

  const incidentSnap = await db.collection('users').doc(TEST_UID).collection('analystIncidents').get();
  console.log(`analystIncidents: ${incidentSnap.size} doc(s)`);
  incidentSnap.docs.forEach(d => {
    const inc = d.data();
    console.log('  ', JSON.stringify({ id: d.id, title: inc.title, severity: inc.severity, hasForensicReport: !!inc.forensicReport }));
  });

  const pendingSnap = await db.collection('users').doc(TEST_UID).collection('pendingActions').get();
  console.log(`pendingActions: ${pendingSnap.size} doc(s)`);

  return { alert, incident: incidentSnap.empty ? null : incidentSnap.docs[0].data() };
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
  admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: PROJECT_ID });
  const db = admin.firestore();
  const apiKey = readApiKeyFromEnvLocal();
  const baseUrl = getBaseUrl();

  console.log(`Base URL: ${baseUrl}`);
  console.log(`Test user: ${TEST_UID}`);
  console.log('Wiping prior test data for a clean baseline...');
  await wipeTestUserData(db);

  const idToken = await mintIdToken(apiKey);
  console.log('✓ Minted a real Firebase ID token for the test user.');

  const lowRisk = await runOneScan(db, baseUrl, idToken, LOW_RISK_URL, 'LOW-RISK');
  const highRisk = await runOneScan(db, baseUrl, idToken, HIGH_RISK_URL, 'HIGH-RISK (typosquatting-style, synthetic)');

  console.log('\n=== VERDICT ===');
  if (lowRisk?.alert) {
    console.log(`✓ Low-risk scan: processScan() ran, analystAlerts populated. Incident created: ${!!lowRisk.incident} (expected: false, since a genuine 0-1/10 score is below the >=7 threshold).`);
  } else {
    console.log('✗ Low-risk scan: processScan() did NOT run -- pipeline still broken.');
  }
  if (highRisk?.alert) {
    console.log(`✓ High-risk scan: processScan() ran, analystAlerts populated. Incident created: ${!!highRisk.incident} (depends on Nemotron's actual risk_score for this input -- not guaranteed).`);
    if (highRisk.incident) {
      console.log(`  Forensic report present: ${!!highRisk.incident.forensicReport}`);
    }
  } else {
    console.log('✗ High-risk scan: processScan() did NOT run -- pipeline still broken.');
  }
}

main().then(() => process.exit(0)).catch(e => { console.error('\nHarness error:', e); process.exit(1); });
