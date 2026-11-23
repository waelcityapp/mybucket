import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const id = 'ac59b288-520c-4393-9303-4ad208482814';
const origin = 'https://mybucket.example';
function worker(windows = [], stored = new Set()) {
  const handlers = new Map();
  const shown = [], opened = [];
  runInNewContext(readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8'), {
    URL, Date, Response, caches: { open: async () => ({
      match: async href => Array.from(stored).some(item => item.split('?')[0] === href.split('?')[0]) || undefined,
      keys: async () => Array.from(stored, url => ({ url })),
      delete: async request => stored.delete(request.url),
      put: async href => { stored.add(href); },
    }) },
    self: {
      location: { origin },
      addEventListener: (type, listener) => handlers.set(type, listener),
      registration: { showNotification: async (title, options) => shown.push({ title, ...options }) },
      clients: { matchAll: async () => windows, openWindow: async url => opened.push(url) },
    },
  });
  async function emit(type, event) {
    let result;
    handlers.get(type)({ ...event, waitUntil: work => { result = work; } });
    await result;
  }
  return { shown, opened, emit };
}

test('displays the approved title, app and hint in the device language, with no external click target', async () => {
  const { emit, shown, opened } = worker();
  for (const lang of ['ar', 'en']) {
    const device = lang === 'ar' ? { emit, shown } : worker();
    await device.emit('push', { data: { json: () => ({ data: { type: 'vip-ad', id, title: 'Disco Night – Blue Buzz', lang, expiresAt: String(Date.now() + 60_000) } }) } });
    if (lang === 'en') shown.push(...device.shown);
  }
  assert.equal(shown[0].title, '🎉 إعلان VIP جديد');
  assert.equal(shown[0].body, 'My Bucket\nDisco Night – Blue Buzz\nاضغط لمشاهدة تفاصيل الإعلان.');
  assert.equal(shown[1].title, '🎉 New VIP ad');
  assert.equal(shown[0].tag, shown[1].tag);
  await emit('notificationclick', { notification: { tag: shown[0].tag, data: shown[0].data, close() {} } });
  assert.deepEqual(opened, [`${origin}/offers/ad/${id}`]);
  await emit('notificationclick', { notification: { tag: shown[0].tag, data: { path: 'https://example.com' }, close() {} } });
  assert.equal(opened.length, 1);
});

test('ignores malformed and expired payloads and focuses an already open detail page', async () => {
  let focused = 0;
  const { emit, shown, opened } = worker([{ url: `${origin}/offers/ad/${id}`, focus: async () => focused++ }]);
  await emit('push', { data: { json: () => ({ data: { type: 'vip-ad', id, title: 'Expired', expiresAt: Date.now() - 10 } }) } });
  await emit('push', { data: { json: () => ({ data: { type: 'vip-ad', id: '../escape', title: 'Invalid', expiresAt: Date.now() + 10_000 } }) } });
  await emit('push', { data: { json: () => { throw new Error('invalid JSON'); } } });
  await emit('notificationclick', { notification: { tag: 'vip-ad-' + id, data: { path: '/offers/ad/' + id }, close() {} } });
  assert.equal(shown.length, 0);
  assert.equal(opened.length, 0);
  assert.equal(focused, 1);
});


test('one device suppresses repeated deliveries of the same campaign across service worker restarts', async () => {
  const persisted = new Set();
  const input = { data: { json: () => ({ data: { type: 'vip-ad', id, title: 'Real VIP', expiresAt: Date.now() + 10_000 } }) } };
  const before = worker([], persisted), after = worker([], persisted);
  await Promise.all([before.emit('push', input), before.emit('push', input)]);
  await after.emit('push', input);
  assert.equal(before.shown.length, 1);
  assert.equal(after.shown.length, 0);
});
