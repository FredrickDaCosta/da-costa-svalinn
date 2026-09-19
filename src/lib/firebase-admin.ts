// Lazily, dynamically imports firebase-admin so a bundler/runtime
// resolution failure (e.g. Turbopack external-module externalization
// issues) rejects a Promise instead of crashing route module load.
// Cache is best-effort: any failure here must degrade to "no cache",
// never crash the caller.

let cachedFirestore: import('firebase-admin/firestore').Firestore | null = null;
let loadFailed = false;

export async function getAdminFirestore(): Promise<import('firebase-admin/firestore').Firestore | null> {
  if (loadFailed) return null;
  if (cachedFirestore) return cachedFirestore;
  try {
    const { getApps, initializeApp, applicationDefault } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    const app = getApps().length > 0 ? getApps()[0] : initializeApp({
      credential: applicationDefault(),
      projectId: 'da-costa-unisoc23v1-6386-61f95',
    });
    cachedFirestore = getFirestore(app);
    // The Admin SDK rejects any document containing an `undefined` field
    // value outright (unlike callers that assume "just don't set it" is
    // safe) -- e.g. DomainEnrichment.registrar being unset when a WHOIS
    // lookup has no data, or `finalIncident?.id`/`pendingAction?.action`
    // being undefined when there's no incident/pending action. Every
    // caller of getAdminFirestore() shares this one instance, so this is
    // set once, here, rather than patched at each individual write site.
    cachedFirestore.settings({ ignoreUndefinedProperties: true });
    return cachedFirestore;
  } catch (e) {
    console.error('[firebase-admin] Admin SDK unavailable, caching disabled:', e instanceof Error ? e.message : String(e));
    loadFailed = true;
    return null;
  }
}
