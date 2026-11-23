import assert from 'node:assert/strict';
import { createECDH, randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import gateway from '../api/gateway.ts';
import { reviewOfferAds } from '../server/offerAds.ts';
import { deliverVipPush, vipPushAction } from '../server/vipPush.ts';

if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) {
  throw new Error('Local Firestore emulator required');
}
const app = initializeApp({ projectId: `demo-push-${randomUUID().slice(0, 8)}` });
const db = getFirestore(app);
const ecdh = createECDH('prime256v1');
const key = ecdh.generateKeys().toString('base64url');
const formerKey = process.env.VIP_PUSH_VAPID_PUBLIC_KEY;
after(async () => {
  if (formerKey === undefined) delete process.env.VIP_PUSH_VAPID_PUBLIC_KEY;
  else process.env.VIP_PUSH_VAPID_PUBLIC_KEY = formerKey;
  await db.terminate();
  await deleteApp(app);
});
let validationCount = 0;
const validation = async () => { validationCount++; };
const request = (action, payload = {}, ip = '192.0.2.10') => vipPushAction(action, payload, ip, db, validation);
const token = char => char.repeat(100);
const secret = 'a'.repeat(64);
const other = 'b'.repeat(64);

test('guest gateway uses same-origin requests and feature is unavailable without its FCM public key', async () => {
  delete process.env.VIP_PUSH_VAPID_PUBLIC_KEY;
  async function api(origin) {
    let status, body;
    await gateway({ method: 'POST', headers: { origin, host: 'mybucket.example' }, body: { action: 'vipPush.config' } }, {
      status(value) { status = value; return this; },
      json(value) { body = value; },
    });
    return { status, body };
  }
  assert.equal((await api('https://example.com')).status, 403);
  assert.deepEqual(await api('https://mybucket.example'), { status: 200, body: { ok: true, data: { vapidKey: null } } });
  await assert.rejects(request('vipPush.subscribe', { token: token('A'), secret, lang: 'ar' }), { code: 'vip_push_unavailable' });
  process.env.VIP_PUSH_VAPID_PUBLIC_KEY = key;
  assert.equal((await api('https://mybucket.example')).body.data.vapidKey, key);
});

test('guest devices opt in with FCM validation and can revoke only their own registration', async () => {
  const first = await request('vipPush.subscribe', { token: token('A'), secret, lang: 'ar' });
  assert.equal(validationCount, 1);
  const repeated = await request('vipPush.subscribe', { token: token('A'), secret, lang: 'en' });
  assert.equal(first.id, repeated.id);
  assert.equal(validationCount, 1);
  assert.equal((await db.doc(`vipPushDevices/${first.id}`).get()).get('lang'), 'en');
  await request('vipPush.unsubscribe', { id: first.id, secret: other });
  assert.equal((await request('vipPush.status', { id: first.id, secret })).active, true);
  await assert.rejects(request('vipPush.subscribe', { token: token('A'), secret: other, lang: 'ar' }), { code: 'push_device_already_registered' });
  await request('vipPush.unsubscribe', { id: first.id, secret });
  assert.equal((await request('vipPush.status', { id: first.id, secret })).active, false);
});

test('registrations are rate limited before validating more tokens and malformed tokens never reach FCM', async () => {
  const before = validationCount;
  await assert.rejects(request('vipPush.subscribe', { token: 'fake', secret, lang: 'ar' }, '192.0.2.20'), { code: 'invalid_push_token' });
  for (let i = 0; i < 10; i++) {
    await request('vipPush.subscribe', { token: `limited${i}${token('B')}`, secret, lang: 'ar' }, '192.0.2.20');
  }
  await assert.rejects(request('vipPush.subscribe', { token: token('C'), secret, lang: 'ar' }, '192.0.2.20'), { code: 'vip_push_rate_limit' });
  assert.equal(validationCount, before + 10);
  const result = await db.collection('vipPushDevices').get();
  await Promise.all(result.docs.map(doc => doc.ref.delete()));
});

test('only approved live VIP ads reach opted-in devices, with no duplicate send on approval retry', async () => {
  const recipient = await request('vipPush.subscribe', { token: token('D'), secret, lang: 'ar' }, '192.0.2.30');
  const revoked = await request('vipPush.subscribe', { token: token('E'), secret: other, lang: 'en' }, '192.0.2.30');
  await request('vipPush.unsubscribe', { id: revoked.id, secret: other });
  async function approve(tier, scheduled = false) {
    const id = randomUUID();
    await db.doc(`offerAds/${id}`).set({
      title: 'Disco Night – Blue Buzz', description: 'Details', merchant: 'Store', ownerId: 'buyer',
      categorySlug: 'food-beverages', contact: '', status: 'pending', mediaType: null,
      startsAt: Date.now() + (scheduled ? 3600000 : -10000), endsAt: Date.now() + 7200000,
      ...(tier !== 'free' && { payment: { tier, amountEgp: 0, dailyPriceEgp: 0 } }),
    });
    const ad = db.doc(`offerAds/${id}`);
    const original = (await ad.get()).data();
    const approval = { id, status: 'approved' };
    if (scheduled && tier === 'vip') {
      await assert.rejects(reviewOfferAds('admin.ads.review', 'admin', approval, db), { code: 'ad_vip_immediate_confirmation_required' });
      assert.deepEqual((await ad.get()).data(), original);
      assert.equal((await db.doc(`vipPushOutbox/${id}`).get()).exists, false);
      approval.publishVipNow = true;
    }
    await reviewOfferAds('admin.ads.review', 'admin', approval, db);
    const published = (await ad.get()).data();
    if (tier === 'vip') {
      assert.equal(published.startsAt, published.reviewedAt);
      assert.equal(published.endsAt - published.startsAt, original.endsAt - original.startsAt);
      assert.deepEqual(published.payment, original.payment);
      if (scheduled) assert.deepEqual(published.formerVipSchedule, { startsAt: original.startsAt, endsAt: original.endsAt });
    } else if (scheduled) {
      assert.equal(published.startsAt, original.startsAt);
    }
    return id;
  }
  const free = await approve('free');
  const featured = await approve('featured', true);
  const vip = await approve('vip');
  const scheduled = await approve('vip', true);
  const job = id => db.doc(`vipPushOutbox/${id}`);
  assert.equal((await job(free).get()).exists, false);
  assert.equal((await job(featured).get()).exists, false);
  assert.equal((await job(scheduled).get()).exists, true);

  const campaign = async id => (await reviewOfferAds('admin.ads.list', 'admin', { status: 'approved' }, db))
    .find(ad => ad.id === id)?.vipPushCampaign;
  assert.deepEqual(await campaign(vip), { status: 'queued', scannedCount: 0, failedCount: 0 });
  assert.equal(await campaign(featured), undefined);
  const interrupted = await approve('vip');
  await job(interrupted).update({ startedAt: Date.now() - 600_000, leaseUntil: Date.now() - 1, scannedCount: 100 });
  assert.deepEqual(await campaign(interrupted), { status: 'stopped', scannedCount: 100, failedCount: 0 });
  assert.equal((await job(interrupted).get()).get('completedAt'), undefined);
  const expired = await approve('vip');
  await db.doc(`offerAds/${expired}`).update({ endsAt: Date.now() - 1 });
  await deliverVipPush(db, async () => assert.fail('An expired ad should never send'), expired);
  assert.equal((await campaign(expired)).status, 'stopped');
  assert.equal((await job(expired).get()).get('completedAt'), undefined);

  const sent = [];
  const send = async messages => {
    sent.push(...messages);
    return { responses: messages.map(() => ({ success: true })) };
  };
  await Promise.all([deliverVipPush(db, send, vip), deliverVipPush(db, send, vip)]);
  await reviewOfferAds('admin.ads.review', 'admin', { id: vip, status: 'approved' }, db);
  await deliverVipPush(db, send, vip);
  assert.equal(sent.length, 1);
  await deliverVipPush(db, send, scheduled);
  assert.equal(sent.length, 2);
  assert.equal(sent[1].data.id, scheduled);
  assert.equal(sent[0].data.title, 'Disco Night – Blue Buzz');
  assert.equal(sent[0].data.id, vip);
  assert.equal(sent[0].token, token('D'));
  assert.equal((await db.doc(`vipPushDevices/${recipient.id}`).get()).exists, true);

  const unavailable = await approve('vip');
  const failed = async () => { throw new Error('FCM unavailable'); };
  await deliverVipPush(db, failed, unavailable);
  assert.equal((await db.doc(`offerAds/${unavailable}`).get()).get('status'), 'approved');
  assert.deepEqual(await campaign(unavailable), { status: 'completed_with_failures', scannedCount: 1, failedCount: 1 });
  const failures = await job(unavailable).collection('failures').get();
  assert.deepEqual(failures.docs.map(doc => doc.get('deviceIds')), [[recipient.id]]);
});


test('a live campaign pages through all devices and retries only a failed recipient', async () => {
  const id = randomUUID();
  const ad = db.doc(`offerAds/${id}`);
  const job = db.doc(`vipPushOutbox/${id}`);
  const startsAt = Date.now() - 100;
  const endsAt = startsAt + 3600_000;
  const batch = db.batch();
  const previous = await db.collection('vipPushDevices').get();
  previous.docs.forEach(device => batch.delete(device.ref));
  for (let i = 0; i < 405; i++) {
    batch.set(db.doc(`vipPushDevices/device-${String(i).padStart(3, '0')}`), {
      createdAt: Date.now() - 5000, token: 'device-' + i, lang: 'en',
    });
  }
  batch.set(ad, { title: 'Real VIP', status: 'approved', payment: { tier: 'vip' }, startsAt, endsAt });
  batch.set(job, { publishedAt: startsAt, endsAt, cursor: '' });
  await batch.commit();
  const received = [];
  let failedOnce = false;
  const send = async messages => ({
    responses: messages.map(message => {
      if (message.token === 'device-0' && !failedOnce) {
        failedOnce = true;
        return { success: false, error: { code: 'messaging/internal-error' } };
      }
      received.push(message.token);
      return { success: true };
    }),
  });
  await deliverVipPush(db, send, id);
  await deliverVipPush(db, send, id);
  assert.equal(received.length, 405);
  assert.equal(new Set(received).size, 405);
  assert.ok((await job.get()).get('completedAt'));
  assert.equal((await job.get()).get('failedCount'), 0);
  assert.equal((await job.get()).get('scannedCount'), 405);
});
