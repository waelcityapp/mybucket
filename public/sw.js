/* My Bucket install service worker. Financial data must never be cached. */
const ICON_CACHE = 'mybucket-pwa-icons-v1';
const STATIC_ICONS = ['/icons/mybucket-192.png', '/icons/mybucket-512.png'];
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(ICON_CACHE)
      .then(cache => Promise.allSettled(STATIC_ICONS.map(path => cache.add(path))))
      .then(() => self.skipWaiting())
  );
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('mybucket-pwa-icons-') && key !== ICON_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  // Keep a stable manifest URL so installed PWA identity remains the same.
  // Public identity is written to this cache by the signed-in or guest app UI.
  if (url.pathname === '/manifest.webmanifest') {
    event.respondWith(caches.open('mybucket-pwa-branding-v1')
      .then(cache => cache.match('/manifest.webmanifest'))
      .then(cached => cached || fetch(event.request)));
    return;
  }
  if (!STATIC_ICONS.includes(url.pathname)) return;
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request)));
});
