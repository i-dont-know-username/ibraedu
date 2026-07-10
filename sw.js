const CACHE_NAME = 'ibraedu-v6'; // Bumped version to evict old layout/session bug caches
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install Service Worker and cache core local assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate and purge old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  return self.clients.claim();
});

// Fetch interception strategy
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // CORRECTED: Exclude Supabase live database traffic from being hijacked by the cache
  if (url.hostname.includes('supabase.co')) {
    return; // Let the browser handle live database updates naturally
  }

  // UPDATED: Added jsdelivr.net to ensure the Supabase client library can be cached for offline use
  const isExternalCDN = 
    url.hostname.includes('tailwindcss.com') || 
    url.hostname.includes('unpkg.com') || 
    url.hostname.includes('googleapis.com') || 
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('jsdelivr.net');

  if (isExternalCDN) {
    // Strategy: Network First, Fallback to Cache
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && (response.status === 200 || response.type === 'opaque')) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          return caches.match(request);
        })
    );
  } else {
    // Strategy for local files: Cache First, Fallback to Network
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
  }
});
