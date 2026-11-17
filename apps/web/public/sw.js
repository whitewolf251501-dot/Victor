// Victor Noctis - System 07 Offline Service Worker
const CACHE_NAME = 'victor-v1';
const OFFLINE_URL = '/offline.html';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(['/', OFFLINE_URL, '/manifest.json', '/icons/icon-192x192.svg']);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE_NAME);
      const cachedResponse = await cache.match(event.request);
      if (cachedResponse) return cachedResponse;

      if (event.request.headers.get('accept')?.includes('text/html')) {
        return (await cache.match(OFFLINE_URL)) || new Response('Victor is offline. Reconnecting...', {
          headers: { 'Content-Type': 'text/plain' },
        });
      }

      if (event.request.headers.get('accept')?.includes('application/json')) {
        return new Response(JSON.stringify({ error: 'Victor is offline. Reconnecting...' }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('Victor is offline. Reconnecting...', {
        status: 503,
        statusText: 'Service Unavailable',
      });
    })
  );
});
