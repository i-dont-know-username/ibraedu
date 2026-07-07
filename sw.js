const CACHE_NAME = 'ibraedu-v3'; // Incremented version
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install: cache local assets only (skipping Tailwind CDN to prevent CORS crash)
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Activate: clean up old cache versions
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  return self.clients.claim();
});

// Fetch: network-first safely using 'no-cors' mode for external assets
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  const isExternal = url.hostname.includes('tailwindcss.com') || 
                     url.hostname.includes('unpkg.com') || 
                     url.hostname.includes('googleapis.com') || 
                     url.hostname.includes('gstatic.com');

  if (isExternal) {
    event.respondWith(
      // We pass an options object with mode: 'no-cors' to bypass the restriction
      fetch(request.url, { mode: 'no-cors' })
        .then(networkResponse => {
          // Verify we got a usable response layout before caching
          if (networkResponse) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
  } else {
    // Local files: cache-first strategy
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        return cachedResponse || fetch(request);
      })
    );
  }
});
