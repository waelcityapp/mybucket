import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { get, ref, set, update, onDisconnect, serverTimestamp, goOffline } from 'firebase/database';

const env = await initializeTestEnvironment({ projectId: 'demo-mybucket', database: { rules: readFileSync('database.presence.rules.json', 'utf8') } });
after(async () => env.cleanup());

test('presence is private, validated and supports separate device sessions', async () => {
  const one = env.authenticatedContext('one', { email: 'one@example.com' }).database();
  const other = env.authenticatedContext('other', { email: 'other@example.com' }).database();
  const admin = env.authenticatedContext('admin', { email: 'waelvts@gmail.com', email_verified: true }).database();
  const anon = env.unauthenticatedContext().database();
  const user = ref(one, 'presence/one');
  await assertSucceeds(set(ref(one, 'presence/one/sessions/phone'), { device: 'mobile', since: serverTimestamp() }));
  await assertSucceeds(set(ref(one, 'presence/one/sessions/computer'), { device: 'computer', since: serverTimestamp() }));
  await assertFails(get(ref(other, 'presence/one')));
  await assertFails(get(ref(anon, 'presence/one')));
  await assertFails(set(ref(admin, 'presence/one/sessions/admin'), { device: 'computer', since: serverTimestamp() }));
  await assertFails(set(ref(other, 'presence/one/sessions/attack'), { device: 'mobile', since: serverTimestamp() }));
  await assertFails(set(ref(one, 'presence/one/sessions/invalid'), { device: 'tablet', since: serverTimestamp() }));
  await assertFails(set(ref(one, 'presence/one/extra'), 'no'));
  await assertSucceeds(get(ref(admin, 'presence/one')));
  await assertSucceeds(update(user, { 'sessions/phone': null, 'lastSeen/at': serverTimestamp(), 'lastSeen/device': 'mobile' }));
  const data = (await get(ref(admin, 'presence/one'))).val();
  assert.equal(data.sessions.computer.device, 'computer');
  assert.equal(data.sessions.phone, undefined);
  assert.equal(data.lastSeen.device, 'mobile');
});

test('disconnect removes only the device session and records the last appearance', { timeout: 15000 }, async () => {
  const phone = env.authenticatedContext('two').database();
  const admin = env.authenticatedContext('owner', { email: 'waelvts@gmail.com', email_verified: true }).database();
  await assertSucceeds(onDisconnect(ref(phone, 'presence/two/sessions/phone')).remove());
  await assertSucceeds(onDisconnect(ref(phone, 'presence/two/lastSeen')).set({ at: serverTimestamp(), device: 'mobile' }));
  await assertSucceeds(set(ref(phone, 'presence/two/sessions/phone'), { device: 'mobile', since: serverTimestamp() }));
  await assertSucceeds(set(ref(phone, 'presence/two/sessions/computer'), { device: 'computer', since: serverTimestamp() }));
  goOffline(phone);
  let data;
  for (let i = 0; i < 40; i++) {
    data = (await get(ref(admin, 'presence/two'))).val();
    if (data?.lastSeen?.device === 'mobile' && !data?.sessions?.phone) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.equal(data?.lastSeen?.device, 'mobile');
  assert.equal(data?.sessions?.phone, undefined);
  assert.equal(data?.sessions?.computer?.device, 'computer');
});
