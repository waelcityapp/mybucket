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

const VIP_AD_PATH = /^\/offers\/ad\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const VIP_DELIVERY_CACHE = 'mybucket-vip-deliveries-v1';
const pendingNotices = new Map();

async function showVipOnce(id, expiresAt, title, options) {
  const marker = new URL('/__vip-delivery/' + id, self.location.origin);
  marker.searchParams.set('expires', String(expiresAt));
  const cache = await caches.open(VIP_DELIVERY_CACHE).catch(() => null);
  if (cache) {
    if (await cache.match(marker.href, { ignoreSearch: true })) return;
    await Promise.all((await cache.keys()).filter(request =>
      Number(new URL(request.url).searchParams.get('expires')) <= Date.now()
    ).map(request => cache.delete(request)));
  }
  await self.registration.showNotification(title, options);
  if (cache) await cache.put(marker.href, new Response('shown')).catch(() => {});
}

self.addEventListener('push', event => {
  let payload;
  try { payload = event.data?.json()?.data; } catch { return; }
  if (payload?.type !== 'vip-ad' || typeof payload.id !== 'string' ||
      typeof payload.title !== 'string' || !payload.title.trim()) return;
  const expiresAt = Number(payload.expiresAt);
  const path = '/offers/ad/' + payload.id;
  if (!VIP_AD_PATH.test(path) || !Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return;
  const ar = payload.lang !== 'en';
  const running = pendingNotices.get(payload.id);
  if (running) { event.waitUntil(running); return; }
  const work = showVipOnce(payload.id, expiresAt, ar ? '🎉 إعلان VIP جديد' : '🎉 New VIP ad', {
    body: 'My Bucket\n' + payload.title + '\n' +
      (ar ? 'اضغط لمشاهدة تفاصيل الإعلان.' : 'Tap to see the ad details.'),
    lang: ar ? 'ar' : 'en',
    dir: ar ? 'rtl' : 'ltr',
    icon: '/icons/mybucket-192.png',
    tag: 'vip-ad-' + payload.id,
    renotify: false,
    data: { path },
  }).finally(() => pendingNotices.delete(payload.id));
  pendingNotices.set(payload.id, work);
  event.waitUntil(work);
});

self.addEventListener('notificationclick', event => {
  const path = event.notification.data?.path;
  if (!event.notification.tag.startsWith('vip-ad-') || !VIP_AD_PATH.test(path ?? '')) return;
  event.notification.close();
  const target = new URL(path, self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const existing = windows.find(window => window.url === target);
    return existing ? existing.focus() : self.clients.openWindow(target);
  }));
});
