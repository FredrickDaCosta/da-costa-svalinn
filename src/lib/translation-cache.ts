import { getAdminFirestore } from '@/lib/firebase-admin';

const CACHE_COLLECTION = 'translation_cache';

export async function getCachedTranslation(
  locale: string,
  cacheKey: string
): Promise<Record<string, string> | null> {
  try {
    const snap = await getAdminFirestore().collection(CACHE_COLLECTION).doc(cacheKey).get();
    if (snap.exists) {
      return snap.data() as Record<string, string>;
    }
    return null;
  } catch (e) {
    console.error('[TranslationCache] Read failed:', e);
    return null;
  }
}

export async function setCachedTranslation(
  locale: string,
  cacheKey: string,
  data: Record<string, string>
): Promise<void> {
  try {
    await getAdminFirestore().collection(CACHE_COLLECTION).doc(cacheKey).set({ ...data, locale, cachedAt: Date.now() });
  } catch (e) {
    console.error('[TranslationCache] Write failed:', e);
  }
}
