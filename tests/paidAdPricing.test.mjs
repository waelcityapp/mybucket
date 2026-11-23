import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import gateway from '../api/gateway.ts';
import { getAdminAuth } from '../server/firebaseAdmin.ts';
import { purgeExpiredOffers, reviewOfferAds, sendOfferAd } from '../server/offerAds.ts';
import { MAX_AD_DAILY_PRICE_EGP } from '../src/utils/adCheckout.ts';

if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) {
  throw new Error('Local Firestore emulator required');
}
const app = initializeApp({ projectId: `demo-prices-${randomUUID().slice(0, 8)}` });
const db = getFirestore(app);
after(async () => { await db.terminate(); await deleteApp(app); });

const uid = 'buyer';
const day = 86400000;
const ad = id => db.doc(`offerAds/${id}`);
const request = (action, payload = {}, user = uid) => sendOfferAd(action, user, payload, db);
const admin = (action, payload = {}) => reviewOfferAds(action, 'admin', payload, db);
const invoice = (overrides = {}) => {
  const startsAt = Date.now();
  return {
    id: randomUUID(), tier: 'featured', title: 'Breakfast', description: 'Offer',
    merchant: 'Store', categorySlug: 'food-beverages', contact: '', resourceType: null,
    paymentPhone: '01012345678', amountEgp: 200, startsAt, endsAt: startsAt + 2 * day, ...overrides,
  };
};

test('only authenticated administration can update centralized integer EGP rates', async t => {
  assert.deepEqual(await request('ads.paidPrices'), { featured: 100, vip: 200 });
  const auth = getAdminAuth();
  t.mock.method(auth, 'verifyIdToken', async token => ({
    uid: token, email_verified: true, email: token === 'admin' ? 'waelvts@gmail.com' : 'buyer@example.com',
  }));
  const api = async (token, action, payload) => {
    let body, status;
    await gateway({ method: 'POST', headers: { authorization: `Bearer ${token}` }, body: { action, payload } }, {
      status(code) { status = code; return this; },
      json(value) { body = value; },
    });
    return { body, status };
  };
  assert.equal((await api('buyer', 'admin.ads.prices', { featured: 1, vip: 1 })).status, 403);
  for (const invalid of [-1, 1.5, '100', MAX_AD_DAILY_PRICE_EGP + 1, null]) {
    assert.equal((await api('admin', 'admin.ads.prices', { featured: invalid, vip: 200 })).status, 400);
  }
  await admin('admin.ads.policy', { freeIntervalDays: 12 });
  const policyRef = db.doc('offerAdSettings/policy');
  await admin('admin.ads.prices', { featured: 100, vip: 200 });
  assert.equal((await policyRef.get()).get('firstPaidPriceChangeAt'), undefined);
  assert.equal((await api('admin', 'admin.ads.prices', { featured: 120, vip: 240 })).status, 200);
  assert.deepEqual(await request('ads.paidPrices'), { featured: 120, vip: 240 });
  assert.ok(Number.isSafeInteger((await policyRef.get()).get('firstPaidPriceChangeAt')));
  assert.equal((await request('ads.freePolicy')).freeIntervalDays, 12);
});

test('a stale or manipulated total does not create an invoice and a confirmed amount never reprices', async () => {
  const data = invoice();
  const stale = await request('ads.lockPrice', data);
  assert.deepEqual(stale, { priceChanged: true, prices: { featured: 120, vip: 240 } });
  assert.equal((await ad(data.id).get()).exists, false);
  await assert.rejects(request('ads.prepare', { ...data, amountEgp: 1, receiptBytes: 100 }), { code: 'ad_invoice_not_locked' });
  assert.equal((await ad(data.id).get()).exists, false);
  const accepted = { ...data, amountEgp: 240 };
  const locked = await request('ads.lockPrice', accepted);
  assert.deepEqual(locked, { priceChanged: false, dailyPriceEgp: 120, amountEgp: 240, createdAt: (await ad(data.id).get()).get('priceLockedAt') });
  assert.ok(Number.isSafeInteger(locked.createdAt));
  await admin('admin.ads.prices', { featured: 150, vip: 300 });
  assert.deepEqual(await request('ads.lockPrice', accepted), locked);
  await assert.rejects(request('ads.resumePayment', { id: data.id }, 'other-owner'), { code: 'ad_invoice_unavailable' });
  assert.equal((await request('ads.resumePayment', { id: data.id })).payment.amountEgp, 240);
  await assert.rejects(request('ads.prepare', { ...accepted, amountEgp: 300 }), { code: 'ad_invoice_mismatch' });
  await assert.rejects(request('ads.prepare', { ...accepted, title: 'Changed' }), { code: 'ad_invoice_mismatch' });
  await assert.rejects(request('ads.cancel', { id: data.id }), { code: 'ad_invoice_locked' });
});

test('zero-priced VIP can be reviewed without a receipt and stays VIP after a rate change', async () => {
  await admin('admin.ads.prices', { featured: 130, vip: 0 });
  const data = invoice({ tier: 'vip', amountEgp: 0, vipDurationDays: 2 });
  await request('ads.lockPrice', data);
  await assert.rejects(request('ads.submit', { id: data.id }), { code: 'ad_invoice_not_prepared' });
  await admin('admin.ads.prices', { featured: 130, vip: 250 });
  const preparation = await request('ads.prepare', data);
  assert.equal(preparation.receiptSigned, null);
  await request('ads.submit', { id: data.id });
  await admin('admin.ads.review', { id: data.id, status: 'approved' });
  const saved = (await ad(data.id).get()).data();
  assert.equal(saved.payment.amountEgp, 0);
  assert.equal(saved.payment.tier, 'vip');
  assert.equal(saved.startsAt, saved.reviewedAt);
  assert.equal(saved.endsAt - saved.startsAt, 2 * 86400000);
  assert.equal(saved.receipt, undefined);
});

test('admin can approve a paid ad with a test image without bank reference, preserving locked price', async t => {
  const config = {
    CLOUDINARY_CLOUD_NAME: 'example-cloud', CLOUDINARY_API_KEY: 'test-key',
    CLOUDINARY_API_SECRET: 'test-secret', CLOUDINARY_UPLOAD_PRESET: 'test-preset',
  };
  for (const [key, value] of Object.entries(config)) {
    const prev = process.env[key];
    process.env[key] = value;
    t.after(() => { if (prev === undefined) delete process.env[key]; else process.env[key] = prev; });
  }
  const data = invoice({ amountEgp: 260 });
  await request('ads.lockPrice', data);
  await admin('admin.ads.prices', { featured: 450, vip: 650 });
  const first = await request('ads.prepare', { ...data, receiptBytes: 100 });
  const second = await request('ads.prepare', { ...data, receiptBytes: 100 });
  assert.equal(first.receiptSigned.publicId, second.receiptSigned.publicId);
  const version = 1;
  const publicId = second.receiptSigned.publicId;
  const responseSignature = createHash('sha1').update(`public_id=${publicId}&version=${version}${config.CLOUDINARY_API_SECRET}`).digest('hex');
  t.mock.method(globalThis, 'fetch', async url => {
    assert.ok(url.endsWith(publicId));
    return Response.json({
      resource_type: 'image', type: 'authenticated', public_id: publicId, bytes: 100,
      version, format: 'png', asset_id: 'receipt', secure_url: `https://res.cloudinary.com/example-cloud/image/authenticated/${publicId}.png`,
    });
  });
  await request('ads.submit', { id: data.id, receipt: { publicId, version, responseSignature, resourceType: 'image' }, amountEgp: 1 });
  assert.equal((await ad(data.id).get()).get('payment.amountEgp'), 260);
  await admin('admin.ads.review', { id: data.id, status: 'approved' });
  const approved = (await ad(data.id).get()).data();
  assert.equal(approved.status, 'approved');
  assert.equal(approved.payment.amountEgp, 260);
  assert.equal(approved.confirmedTransfer, undefined);
  assert.equal(approved.paymentConfirmedAt, undefined);

  const legacy = invoice({ id: randomUUID(), amountEgp: 200 });
  await ad(legacy.id).set({
    ownerId: 'legacy', status: 'pending', startsAt: legacy.startsAt, endsAt: legacy.endsAt,
    payment: { method: 'instapay', amountEgp: 200, phone: '01012345678' },
    receipt: { publicId: 'legacy-receipt', resourceType: 'image', version, format: 'png' },
  });
  await admin('admin.ads.review', { id: legacy.id, status: 'approved' });
  const stored = (await ad(legacy.id).get()).data();
  assert.equal(stored.payment.amountEgp, 200);
  assert.equal(stored.receipt.publicId, 'legacy-receipt');
});

test('temporary upload cleanup preserves locked invoice and does not touch pending orders', async t => {
  const data = invoice({ amountEgp: 900 });
  await request('ads.lockPrice', data, 'cleanup-user');
  await ad(data.id).update({ uploadDay: '2026-11-21', uploadCleanupAt: Date.now() - 1000 });
  const pendingId = randomUUID();
  await ad(pendingId).set({ ownerId: 'legacy-buyer', status: 'pending', payment: { amountEgp: 200 }, uploadCleanupAt: Date.now() - 1000 });
  const prev = {
    CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET,
    CLOUDINARY_UPLOAD_PRESET: process.env.CLOUDINARY_UPLOAD_PRESET,
  };
  for (const key of Object.keys(prev)) process.env[key] = 'test';
  t.after(() => {
    for (const [key, value] of Object.entries(prev)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });
  t.mock.method(globalThis, 'fetch', async () => Response.json({ result: 'ok' }));
  await purgeExpiredOffers(db);
  assert.equal((await request('ads.resumePayment', { id: data.id }, 'cleanup-user')).payment.amountEgp, 900);
  assert.equal((await ad(data.id).get()).get('uploadCleanupAt'), 0);
  assert.equal((await ad(pendingId).get()).get('payment.amountEgp'), 200);
});

test('unrecorded old transfers stay pending until a verified pre-cutoff receipt is claimed once', async t => {
  const settings = db.doc('offerAdSettings/policy');
  const cutoff = (await settings.get()).get('firstPaidPriceChangeAt');
  assert.ok(Number.isSafeInteger(cutoff));
  for (const [key, value] of Object.entries({
    CLOUDINARY_CLOUD_NAME: 'example-cloud', CLOUDINARY_API_KEY: 'test-key',
    CLOUDINARY_API_SECRET: 'test-secret', CLOUDINARY_UPLOAD_PRESET: 'test-preset',
  })) {
    const original = process.env[key];
    process.env[key] = value;
    t.after(() => { if (original === undefined) delete process.env[key]; else process.env[key] = original; });
  }
  t.mock.method(globalThis, 'fetch', async url => {
    const publicId = url.split('/authenticated/')[1];
    return Response.json({
      resource_type: 'image', type: 'authenticated', public_id: publicId, bytes: 100,
      version: 1, format: 'png', asset_id: 'receipt', secure_url: `https://res.cloudinary.com/example-cloud/image/authenticated/${publicId}.png`,
    });
  });

  async function submitClaim(owner, reference, transferredAt, amountEgp = 200) {
    const details = invoice();
    const legacyTransfer = { reference, transferredAt, amountEgp };
    const lock = await request('ads.lockPrice', { ...details, legacyTransfer }, owner);
    assert.equal(lock.dailyPriceEgp, 100);
    assert.equal(lock.amountEgp, 200);
    assert.deepEqual((await request('ads.resumePayment', { id: details.id }, owner)).legacyTransfer, legacyTransfer);
    const { receiptSigned } = await request('ads.prepare', { ...details, receiptBytes: 100 }, owner);
    const { publicId } = receiptSigned;
    const responseSignature = createHash('sha1').update(`public_id=${publicId}&version=1test-secret`).digest('hex');
    await request('ads.submit', { id: details.id, receipt: { publicId, version: 1, responseSignature, resourceType: 'image' } }, owner);
    assert.equal((await ad(details.id).get()).get('status'), 'pending');
    return details.id;
  }

  const before = cutoff - day;
  const first = await submitClaim('earlier-one', 'LEGACY-200', before);
  const second = await submitClaim('earlier-two', 'LEGACY-200', before);
  const listed = await admin('admin.ads.list', { status: 'pending' });
  assert.ok(listed.some(item => item.id === first && item.legacyTransfer.reference === 'LEGACY-200' && item.payment.receiptUrl));
  const review = (id, data = {}) => admin('admin.ads.review', {
    id, status: 'approved', paymentConfirmed: true, transferReference: 'legacy-٢٠٠',
    receivedAmountEgp: 200, receivedAt: before, ...data,
  });
  await assert.rejects(review(first, { paymentConfirmed: false }), { code: 'payment_confirmation_required' });
  await assert.rejects(review(first, { receivedAmountEgp: 199 }), { code: 'ad_transfer_amount_mismatch' });
  await assert.rejects(review(first, { receivedAt: before - 1000 }), { code: 'ad_legacy_transfer_mismatch' });
  await assert.rejects(admin('admin.ads.review', { id: first, status: 'rejected' }), { code: 'ad_legacy_transfer_pending' });
  const results = await Promise.allSettled([review(first), review(second)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.code, 'reference_already_used');
  const statuses = await Promise.all([first, second].map(async id => (await ad(id).get()).get('status')));
  assert.deepEqual(statuses.sort(), ['approved', 'pending']);

  const late = await submitClaim('late', 'AFTER-CUTOFF', cutoff);
  await assert.rejects(review(late, { transferReference: 'AFTER-CUTOFF', receivedAt: cutoff }), { code: 'ad_legacy_transfer_after_cutoff' });
  assert.equal((await ad(late).get()).get('status'), 'pending');

  const priorSubscription = await submitClaim('prior-subscription', 'SUB-TRANSFER', before);
  const referenceKey = createHash('sha256').update('SUB-TRANSFER').digest('hex');
  await db.doc(`subscriptionPaymentReferences/${referenceKey}`).set({ requestId: 'previous-subscription' });
  await assert.rejects(review(priorSubscription, { transferReference: 'SUB-TRANSFER' }), { code: 'reference_already_used' });
  assert.equal((await ad(priorSubscription).get()).get('status'), 'pending');
});
