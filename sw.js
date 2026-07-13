const CACHE_NAME = 'ibraedu-v10'; // bumped version

// Core static assets to cache on install
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png'
];

// ----- Install & Activate -----
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))
    )
  );
  return self.clients.claim();
});

// ----- Fetch interception -----
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Exclude Supabase live database traffic from being cached
  if (url.hostname.includes('supabase.co')) return;

  // 2. Navigation requests → cache-first (offline support)
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then(cachedResponse => {
        return cachedResponse || fetch(request).then(networkResponse => {
          // Optionally update the cached index.html in the background
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put('./index.html', clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 3. External CDN assets – Network first, fallback to cache
  const isExternalCDN =
    url.hostname.includes('tailwindcss.com') ||
    url.hostname.includes('unpkg.com') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('jsdelivr.net');

  if (isExternalCDN) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && (response.status === 200 || response.type === 'opaque')) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
  } else {
    // 4. Local sub‑assets – Cache first, then network
    event.respondWith(
      caches.match(request).then(cachedResponse => {
        if (cachedResponse) return cachedResponse;
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

// ----- Push Notifications -----
self.addEventListener('push', event => {
  const payload = event.data ? event.data.json() : { title: 'IbraEdu', body: 'New update' };
  const options = {
    body: payload.body || '',
    icon: 'icons/icon-192.png',
    badge: 'icons/icon-192.png',
    data: { url: payload.url || '/' }
  };
  event.waitUntil(self.registration.showNotification(payload.title, options));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      const url = event.notification.data.url || '/';
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// ----- Background Sync (for offline resilience) -----
self.addEventListener('sync', event => {
  // This event fires when the user comes back online
  // In a full app you'd sync any queued data here
  console.log('Background sync fired for tag:', event.tag);
  // For now, just resolve so PWABuilder detects the handler
  event.waitUntil(Promise.resolve());
});

// ----- Periodic Background Sync (for periodic updates) -----
self.addEventListener('periodicsync', event => {
  // Fires at intervals when conditions are met (requires site engagement)
  console.log('Periodic sync fired for tag:', event.tag);
  // Here you could fetch fresh content, update caches, etc.
  event.waitUntil(
    (async () => {
      // Example: update cached index.html from network
      try {
        const response = await fetch('./index.html', { cache: 'no-cache' });
        if (response.ok) {
          const cache = await caches.open(CACHE_NAME);
          await cache.put('./index.html', response);
        }
      } catch (err) {
        console.warn('Periodic sync update failed:', err);
      }
    })()
  );
});
