const CACHE_NAME = 'ibraedu-v5';
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
      // Using cache.addAll; if any single asset fails to load, the SW won't install.
      // Ensure manifest.json and icons actually exist in your directory.
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

  // Exclude JSONBin cloud sync requests from being hijacked by the cache
  if (url.hostname.includes('api.jsonbin.io')) {
    return; // Let the browser handle live network updates naturally
  }

  const isExternalCDN = 
    url.hostname.includes('tailwindcss.com') || 
    url.hostname.includes('unpkg.com') || 
    url.hostname.includes('googleapis.com') || 
    url.hostname.includes('gstatic.com');

  if (isExternalCDN) {
    // Strategy: Network First, Fallback to Cache
    // This allows CDNs to load normally via original headers, caching them only if successful.
    event.respondWith(
      fetch(request)
        .then(response => {
          // Only cache valid standard responses or valid opaque responses safely
          if (response && (response.status === 200 || response.type === 'opaque')) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // If network fails (offline), fall back to cached copy
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
          // Cache newly discovered local resources on the fly
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
