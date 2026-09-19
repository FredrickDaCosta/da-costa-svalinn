/**
 * Shared Admin Firestore adapter -- THE standard way for any server-only
 * code in this codebase to talk to Firestore, going forward.
 *
 * Wraps firebase-admin/firestore's real class-based API behind function
 * signatures that mirror the client SDK's modular API
 * (doc()/getDoc()/setDoc()/query()/where()/...) already used everywhere
 * in this codebase -- so converting a server-only file off the client SDK
 * is a close-to-mechanical rename, not a bespoke rewrite:
 *
 *   Client SDK                                    Admin adapter
 *   ---------------------------------------------  ---------------------------------------------
 *   const { firestore } = initializeFirebase();    const firestore = await requireAdminFirestore();
 *   doc(firestore, 'users', uid, 'assets', id)      adminDoc(firestore, 'users', uid, 'assets', id)
 *   getDoc(ref)                                     await adminGetDoc(ref)
 *   setDoc(ref, data, { merge: true })              await adminSetDoc(ref, data, { merge: true })
 *   updateDoc(ref, data)                            await adminUpdateDoc(ref, data)
 *   addDoc(collectionRef, data)                     await adminAddDoc(collectionRef, data)
 *   collection(firestore, 'x')                      adminCollection(firestore, 'x')
 *   getDocs(collectionRef)                          await adminGetDocs(collectionRef)
 *   query(ref, where(...), orderBy(...), limit(...)) adminQuery(ref, adminWhere(...), adminOrderBy(...), adminLimit(...))
 *   writeBatch(firestore)                           adminBatch(firestore)
 *   serverTimestamp()                               adminServerTimestamp()
 *   deleteDoc(ref)                                  await adminDeleteDoc(ref)
 *
 * Every function here routes through getAdminFirestore() (src/lib/
 * firebase-admin.ts) -- the ONE shared, cached Admin SDK Firestore
 * instance for the whole app, with ignoreUndefinedProperties already set
 * on it. Never construct a second Admin Firestore instance elsewhere;
 * any future global config (settings, emulator wiring, etc.) belongs in
 * that one place, not duplicated per-file.
 *
 * See docs/tech-debt-server-side-client-sdk-usage.md for the incident
 * this exists to prevent recurring, and README.md's "Server-only
 * Firestore access" section for the policy this codifies.
 */

import { FieldValue, Timestamp, type Firestore, type DocumentReference, type CollectionReference, type Query, type WhereFilterOp, type OrderByDirection, type SetOptions } from 'firebase-admin/firestore';
import { getAdminFirestore } from '@/lib/firebase-admin';

export { Timestamp, FieldValue };
export type { Firestore, DocumentReference, CollectionReference, Query };

/**
 * Resolves the shared Admin Firestore instance, or throws. Every other
 * function in this module either takes a `Firestore` explicitly (mirroring
 * the client SDK passing `firestore` around) or, for the ones that need
 * it internally (adminBatch, adminRunTransaction), takes it as their
 * first argument too -- callers get it once per operation via this.
 */
export async function requireAdminFirestore(): Promise<Firestore> {
  const firestore = await getAdminFirestore();
  if (!firestore) throw new Error('Admin Firestore unavailable');
  return firestore;
}

function logAdminFirestoreError(op: string, error: unknown): void {
  const code = (error as { code?: string | number })?.code;
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[admin-firestore] ${op} failed. code=${code ?? '(none)'} message=${message}`);
}

async function withErrorLogging<T>(op: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logAdminFirestoreError(op, error);
    throw error; // never swallow -- callers keep their own try/catch semantics
  }
}

// ─── References ────────────────────────────────────────────────────

/** Mirrors doc(firestore, ...pathSegments) -- Admin SDK accepts the same slash-joined path directly. */
export function adminDoc(firestore: Firestore, ...pathSegments: string[]): DocumentReference {
  return firestore.doc(pathSegments.join('/'));
}

/** Mirrors collection(firestore, ...pathSegments). */
export function adminCollection(firestore: Firestore, ...pathSegments: string[]): CollectionReference {
  return firestore.collection(pathSegments.join('/'));
}

/** doc(collectionRef, docId) equivalent -- get a child doc ref off an existing collection ref. */
export function adminDocIn(collectionRef: CollectionReference, docId?: string): DocumentReference {
  return docId ? collectionRef.doc(docId) : collectionRef.doc();
}

// ─── Document reads/writes ─────────────────────────────────────────

export async function adminGetDoc(ref: DocumentReference): Promise<FirebaseFirestore.DocumentSnapshot> {
  return withErrorLogging(`getDoc(${ref.path})`, () => ref.get());
}

/**
 * Batched equivalent of calling adminGetDoc() once per ref in a loop --
 * one round-trip instead of N. Use whenever the full set of refs to read
 * is known upfront (e.g. deduplicating a batch of writes against
 * existing docs) rather than discovered one at a time.
 */
export async function adminGetAll(firestore: Firestore, refs: DocumentReference[]): Promise<FirebaseFirestore.DocumentSnapshot[]> {
  if (refs.length === 0) return [];
  return withErrorLogging(`getAll(${refs.length} refs)`, () => firestore.getAll(...refs));
}

export async function adminSetDoc(ref: DocumentReference, data: FirebaseFirestore.DocumentData, options?: SetOptions): Promise<void> {
  await withErrorLogging(`setDoc(${ref.path})`, () => (options ? ref.set(data, options) : ref.set(data)));
}

export async function adminUpdateDoc(ref: DocumentReference, data: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>): Promise<void> {
  await withErrorLogging(`updateDoc(${ref.path})`, () => ref.update(data));
}

export async function adminAddDoc(collectionRef: CollectionReference, data: FirebaseFirestore.DocumentData): Promise<DocumentReference> {
  return withErrorLogging(`addDoc(${collectionRef.path})`, () => collectionRef.add(data));
}

export async function adminDeleteDoc(ref: DocumentReference): Promise<void> {
  await withErrorLogging(`deleteDoc(${ref.path})`, () => ref.delete());
}

// ─── Queries ────────────────────────────────────────────────────────

export type QueryConstraint = (q: Query) => Query;

/** Mirrors where(field, op, value) as a composable constraint, like the client SDK's. */
export function adminWhere(field: string | FirebaseFirestore.FieldPath, op: WhereFilterOp, value: unknown): QueryConstraint {
  return (q) => q.where(field, op, value);
}

export function adminOrderBy(field: string | FirebaseFirestore.FieldPath, direction: OrderByDirection = 'asc'): QueryConstraint {
  return (q) => q.orderBy(field, direction);
}

export function adminLimit(n: number): QueryConstraint {
  return (q) => q.limit(n);
}

/** Mirrors query(ref, ...constraints) -- applies each constraint in order. */
export function adminQuery(base: Query, ...constraints: QueryConstraint[]): Query {
  return constraints.reduce((q, c) => c(q), base);
}

export async function adminGetDocs(queryOrCollectionRef: Query): Promise<FirebaseFirestore.QuerySnapshot> {
  return withErrorLogging('getDocs', () => queryOrCollectionRef.get());
}

// ─── Batch & transaction ────────────────────────────────────────────

export function adminBatch(firestore: Firestore): FirebaseFirestore.WriteBatch {
  return firestore.batch();
}

export function adminRunTransaction<T>(
  firestore: Firestore,
  updateFn: (tx: FirebaseFirestore.Transaction) => Promise<T>
): Promise<T> {
  return firestore.runTransaction(updateFn);
}

// ─── Field values ───────────────────────────────────────────────────

export function adminServerTimestamp(): FirebaseFirestore.FieldValue {
  return FieldValue.serverTimestamp();
}
