const CACHE_NAME = 'ibraedu-v4';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
    ))
  );
  return self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Safely check for external scripts and fonts
  const isExternal = url.hostname.includes('tailwindcss.com') || 
                     url.hostname.includes('unpkg.com') || 
                     url.hostname.includes('googleapis.com') || 
                     url.hostname.includes('gstatic.com');

  if (isExternal) {
    event.respondWith(
      fetch(request.url, { mode: 'no-cors' })
        .then(response => {
          if (response) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
  } else {
    event.respondWith(
      caches.match(request).then(response => response || fetch(request))
    );
  }
});
