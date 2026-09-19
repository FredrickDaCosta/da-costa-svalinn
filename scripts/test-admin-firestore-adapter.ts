/**
 * Direct correctness test for src/lib/admin-firestore.ts, run against a
 * real, dedicated test collection -- BEFORE any of the 11 tracked-debt
 * files are converted to use it. Everything else inherits trust from
 * this file being correct, so it's verified independently first.
 *
 * Usage: npx tsx scripts/test-admin-firestore-adapter.ts
 * Requires Application Default Credentials with Firestore access
 * (gcloud auth application-default login).
 */

import {
  requireAdminFirestore,
  adminDoc,
  adminCollection,
  adminGetDoc,
  adminSetDoc,
  adminUpdateDoc,
  adminAddDoc,
  adminDeleteDoc,
  adminQuery,
  adminWhere,
  adminOrderBy,
  adminLimit,
  adminGetDocs,
  adminBatch,
  adminServerTimestamp,
  adminRunTransaction,
} from '../src/lib/admin-firestore';

const TEST_COLLECTION = '_adapter_test';
let failures = 0;

function assert(condition: boolean, label: string): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    console.error(`  ✗ ${label}`);
    failures++;
  }
}

async function main() {
  const firestore = await requireAdminFirestore();
  console.log('✓ requireAdminFirestore() resolved a real Firestore instance');

  // Clean slate: delete any leftover docs from a prior run.
  const prior = await adminGetDocs(adminCollection(firestore, TEST_COLLECTION));
  for (const d of prior.docs) await d.ref.delete();

  // --- adminDoc / adminSetDoc / adminGetDoc ---
  console.log('\n--- doc/set/get ---');
  const docId = `test-${Date.now()}`;
  const ref = adminDoc(firestore, TEST_COLLECTION, docId);
  await adminSetDoc(ref, { hello: 'world', n: 1, createdAt: adminServerTimestamp() });
  const snap = await adminGetDoc(ref);
  assert(snap.exists, 'doc exists after adminSetDoc');
  assert(snap.data()?.hello === 'world', 'adminGetDoc reads back the written field');
  assert(snap.data()?.createdAt?.constructor?.name === 'Timestamp', 'adminServerTimestamp() resolved to a real Firestore Timestamp');

  // --- adminSetDoc with merge ---
  await adminSetDoc(ref, { extra: true }, { merge: true });
  const snap2 = await adminGetDoc(ref);
  assert(snap2.data()?.hello === 'world' && snap2.data()?.extra === true, 'adminSetDoc merge:true preserves existing fields and adds new ones');

  // --- adminUpdateDoc ---
  await adminUpdateDoc(ref, { n: 2 });
  const snap3 = await adminGetDoc(ref);
  assert(snap3.data()?.n === 2, 'adminUpdateDoc updates a single field without touching others');
  assert(snap3.data()?.hello === 'world', 'adminUpdateDoc leaves untouched fields intact');

  // --- ignoreUndefinedProperties inherited from the shared instance ---
  console.log('\n--- shared instance config ---');
  try {
    await adminSetDoc(ref, { willBeUndefined: undefined, stillHere: true }, { merge: true });
    const snap4 = await adminGetDoc(ref);
    assert(snap4.data()?.stillHere === true, 'adminSetDoc with an undefined field does not throw (ignoreUndefinedProperties inherited)');
  } catch (e) {
    assert(false, `adminSetDoc with an undefined field should not throw, but got: ${e}`);
  }

  // --- adminAddDoc ---
  console.log('\n--- addDoc ---');
  const coll = adminCollection(firestore, TEST_COLLECTION);
  const added = await adminAddDoc(coll, { kind: 'added', value: 42 });
  const addedSnap = await adminGetDoc(added);
  assert(addedSnap.exists && addedSnap.data()?.value === 42, 'adminAddDoc creates a real doc with an auto-generated ID, readable back');

  // --- adminQuery / adminWhere / adminOrderBy / adminLimit ---
  // Tested individually (not where+orderBy combined on different fields --
  // that's a real Firestore composite-index requirement, not an adapter
  // concern; any production query doing that needs the same index
  // creation step regardless of client vs Admin SDK).
  console.log('\n--- query ---');
  await adminAddDoc(coll, { kind: 'queryable', rank: 1 });
  await adminAddDoc(coll, { kind: 'queryable', rank: 2 });
  await adminAddDoc(coll, { kind: 'other', rank: 3 });

  const whereQ = adminQuery(coll, adminWhere('kind', '==', 'queryable'));
  const whereSnap = await adminGetDocs(whereQ);
  assert(whereSnap.size === 2, 'adminWhere filters correctly (2 "queryable" docs, not the "other" one)');

  const orderQ = adminQuery(coll, adminOrderBy('rank', 'desc'), adminLimit(2));
  const orderSnap = await adminGetDocs(orderQ);
  const ranks = orderSnap.docs.map(d => d.data().rank);
  assert(orderSnap.size === 2, 'adminLimit(2) returns exactly 2 docs');
  assert(ranks[0] === 3 && ranks[1] === 2, 'adminOrderBy(desc) returns docs in the right order');

  // --- adminBatch ---
  console.log('\n--- batch ---');
  const batch = adminBatch(firestore);
  const b1 = adminDoc(firestore, TEST_COLLECTION, 'batch-1');
  const b2 = adminDoc(firestore, TEST_COLLECTION, 'batch-2');
  batch.set(b1, { batched: true });
  batch.set(b2, { batched: true });
  await batch.commit();
  const b1Snap = await adminGetDoc(b1);
  const b2Snap = await adminGetDoc(b2);
  assert(b1Snap.exists && b2Snap.exists, 'adminBatch().commit() writes both docs atomically');

  // --- adminRunTransaction ---
  console.log('\n--- transaction ---');
  const txDocId = `tx-${Date.now()}`;
  const txRef = adminDoc(firestore, TEST_COLLECTION, txDocId);
  await adminSetDoc(txRef, { counter: 0 });
  await Promise.all([
    adminRunTransaction(firestore, async (tx) => {
      const s = await tx.get(txRef);
      tx.update(txRef, { counter: (s.data()?.counter ?? 0) + 1 });
    }),
    adminRunTransaction(firestore, async (tx) => {
      const s = await tx.get(txRef);
      tx.update(txRef, { counter: (s.data()?.counter ?? 0) + 1 });
    }),
  ]);
  const txSnap = await adminGetDoc(txRef);
  assert(txSnap.data()?.counter === 2, 'adminRunTransaction serializes two concurrent increments correctly (no lost update)');

  // --- adminDeleteDoc + cleanup ---
  console.log('\n--- delete / cleanup ---');
  await adminDeleteDoc(ref);
  const deletedSnap = await adminGetDoc(ref);
  assert(!deletedSnap.exists, 'adminDeleteDoc actually removes the doc');

  const finalSnap = await adminGetDocs(adminCollection(firestore, TEST_COLLECTION));
  for (const d of finalSnap.docs) await d.ref.delete();
  console.log(`  (cleaned up ${finalSnap.size} remaining test doc(s))`);

  console.log(`\n${failures === 0 ? '✓ ALL CHECKS PASSED' : `✗ ${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => { console.error('Adapter test harness error:', e); process.exit(1); });
