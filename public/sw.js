const CACHE_NAME = 'dacosta-svalinn-v1';

const PRECACHE_URLS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

// Never intercept these — always go to network
const BYPASS_PATTERNS = [
  '/api/',
  'googleapis.com',
  'firebaseapp.com',
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'openrouter.ai',
  'microsofttranslator.com',
  'virustotal.com',
  'cognitive.microsoft.com',
  'firebase.googleapis.com',
  'securetoken.googleapis.com',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch((err) => {
        console.warn('[SW] Precache failed for some URLs:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Always bypass for API and auth endpoints
  if (BYPASS_PATTERNS.some((pattern) => url.includes(pattern))) {
    return; // Let browser handle normally
  }

  // Only handle GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // For navigation requests (HTML pages): network first,
  // fall back to cache, fall back to offline page
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          // Cache a copy of the response
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed — try cache
          return caches.match(event.request).then((cached) => {
            return cached || caches.match('/');
          });
        })
    );
    return;
  }

  // For static assets (_next/static): cache first, network fallback
  if (url.includes('/_next/static/')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.ok) {
            const responseClone = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // For icons and images: cache first, network fallback
  if (url.includes('/icons/') || url.includes('/favicon')) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        return cached || fetch(event.request);
      })
    );
    return;
  }

  // All other requests: network first
  event.respondWith(
    fetch(event.request).catch(() => {
      return caches.match(event.request);
    })
  );
});
