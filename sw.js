const CACHE_NAME = 'ibraedu-v8'; // Bumped version to evict old corrupted logic caches

// Core static assets to cache on service worker install
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

// Activate and purge old caches immediately
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

  // 1. Exclude Supabase live database traffic from being hijacked by the cache
  if (url.hostname.includes('supabase.co')) {
    return; // Let the browser handle live database updates naturally
  }

  // 2. CRITICAL FIX FOR SPA & VERCEL REDIRECTS:
  // If this is a main window browser navigation request (e.g. typing the URL, reloading,
  // or hitting the root domain), step aside completely. This lets Vercel's server-side 
  // redirects handle routing naturally without hitting the "redirect mode not follow" security crash.
  if (request.mode === 'navigate') {
    return; 
  }

  // 3. Filter and handle external CDN assets
  const isExternalCDN = 
    url.hostname.includes('tailwindcss.com') || 
    url.hostname.includes('unpkg.com') || 
    url.hostname.includes('googleapis.com') || 
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('jsdelivr.net');

  if (isExternalCDN) {
    // Strategy for CDNs: Network First, Fallback to Cache
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
    // Strategy for local sub-assets (Images, CSS, structural JS, Manifest)
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
        }).catch((err) => {
          throw err;
        });
      })
    );
  }
});
