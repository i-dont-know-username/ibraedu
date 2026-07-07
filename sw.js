const CACHE_NAME = 'ibraedu-v2';
const ASSETS_TO_CACHE = [
  './index.html',
  'https://cdn.tailwindcss.com',
  'https://unpkg.com/lucide@latest',
  'https://fonts.googleapis.com/css2?family=Inter:opsz,wght@14..32,400;500;600;700&display=swap',
  'https://fonts.gstatic.com/s/inter/v13/UcC73FwrK3iLTeHuS_fvQtMwCp50KnMa1ZL7.woff2', // example; real URL may vary
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// Install: cache core assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('Failed to cache some assets, proceeding anyway', err);
      });
    })
  );
});

// Activate: remove old caches
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

// Fetch: network-first for CDN, cache-first for local
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // For CDN scripts/fonts: network first, fallback to cache
  if (url.hostname.includes('cdn.tailwindcss.com') || url.hostname.includes('unpkg.com') || url.hostname.includes('fonts.googleapis.com') || url.hostname.includes('fonts.gstatic.com')) {
    event.respondWith(
      fetch(request)
        .then(networkResponse => {
          const clone = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          return networkResponse;
        })
        .catch(() => caches.match(request))
    );
  } else {
    // For local files (index.html, manifest, icons): cache-first, then network
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        return cachedResponse || fetch(request).then(networkResponse => {
          // Optionally cache new content dynamically
          return networkResponse;
        });
      })
    );
  }
});
