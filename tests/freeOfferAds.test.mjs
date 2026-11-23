import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import {
  purgeExpiredOffers,
  readMyOfferAds,
  readOfferForRenewal,
  readPublicOfferAds,
  readPublishedOffers,
  removeExpiredOffer,
  reviewOfferAds,
  sendOfferAd,
  setOfferReaction,
} from '../server/offerAds.ts';
import { offerShareCacheControl } from '../server/offerShare.ts';

if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) {
  throw new Error('Local Firestore emulator required for free offer integration tests');
}

const app = initializeApp({ projectId: `demo-free-${randomUUID().slice(0, 8)}` }, 'free-offer-tests');
const db = getFirestore(app);
after(async () => {
  await db.terminate();
  await deleteApp(app);
});

const DAY = 86400000;
const details = {
  categorySlug: 'food-beverages', title: 'Breakfast offer',
  description: 'Try our new menu', merchant: 'Local cafe', contact: '',
};
const settings = db.doc('offerAdSettings/policy');
const ad = id => db.doc(`offerAds/${id}`);
const ledger = uid => db.doc(`offerAdApprovalLedger/${uid}`);
const request = (action, uid, payload = {}) => sendOfferAd(action, uid, payload, db);
const review = (id, status, options = {}) => reviewOfferAds('admin.ads.review', 'admin', { id, status, ...options }, db);
const policy = (payload = {}) => reviewOfferAds('admin.ads.policy', 'admin', payload, db);
const prepare = (uid, id, payload = {}) => request('ads.prepare', uid, { ...details, id, resourceType: null, ...payload });
const storedAd = (ownerId, status, overrides = {}) => ({
  ...details, ownerId, status, startsAt: 0, endsAt: 0, media: null, mediaType: null,
  rejectionReason: '', submittedAt: Date.now(), ...overrides,
});

test('free publication starts on approval, follows policy, and expires from public reads and share cache', async () => {
  await settings.set({ freeIntervalDays: 3, uploadsPaused: false });
  assert.deepEqual(await request('ads.freePolicy', 'first'), { freeDurationDays: 7, freeIntervalDays: 14 });
  const id = randomUUID();
  await prepare('first', id, { startsAt: Date.now() + DAY, endsAt: Date.now() + 2 * DAY });
  await request('ads.submit', 'first', { id });
  assert.equal((await ad(id).get()).get('startsAt'), 0);
  assert.equal(await readPublicOfferAds('ads.detail', { id }, db), null);
  assert.equal((await request('ads.freeEligibility', 'first')).status, 'pending');
  await assert.rejects(prepare('first', randomUUID()), { code: 'ad_pending_exists' });

  const before = Date.now();
  await review(id, 'approved');
  const published = (await ad(id).get()).data();
  assert.ok(published.startsAt >= before && published.startsAt <= Date.now());
  assert.equal(published.reviewedAt, published.startsAt);
  assert.equal(published.endsAt, published.startsAt + 7 * DAY);
  assert.equal(published.publishedUntil, published.endsAt);
  await review(id, 'approved');
  assert.equal((await ad(id).get()).get('startsAt'), published.startsAt);
  assert.ok((await readPublishedOffers(false, db, published.endsAt - 1)).some(item => item.id === id));
  assert.ok(!(await readPublishedOffers(false, db, published.endsAt)).some(item => item.id === id));
  await ad(id).update({ endsAt: Date.now() - 1, publishedUntil: Date.now() - 1 });
  assert.deepEqual(await readPublicOfferAds('ads.detail', { id }, db), { expired: true });
  assert.equal((await readOfferForRenewal('first', { id }, db)).title, details.title);
  assert.equal(offerShareCacheControl(6500, 1000), 'public, max-age=0, s-maxage=5');
  assert.equal(offerShareCacheControl(1500, 1000), 'no-store');
  assert.equal(offerShareCacheControl(undefined, 1000), 'public, max-age=0, s-maxage=60');
});

test('admin policy changes are independent and an old pending schedule does not block approval', async () => {
  assert.deepEqual(await policy({ freeDurationDays: 20 }), { freeDurationDays: 20, freeIntervalDays: 14 });
  assert.deepEqual(await policy({ freeIntervalDays: 4 }), { freeDurationDays: 20, freeIntervalDays: 4 });
  await assert.rejects(policy({ freeDurationDays: 0, freeIntervalDays: 10 }), { code: 'invalid_ad_policy' });
  await assert.rejects(policy({ freeIntervalDays: 90.5 }), { code: 'invalid_ad_policy' });
  assert.deepEqual(await policy(), { freeDurationDays: 20, freeIntervalDays: 4 });

  const id = randomUUID();
  await ad(id).set(storedAd('legacy', 'pending', { startsAt: Date.now() - 2 * DAY, endsAt: Date.now() - DAY }));
  await review(id, 'approved');
  const approved = (await ad(id).get()).data();
  assert.equal(approved.endsAt - approved.startsAt, 20 * DAY);
  await ledger('legacy').set({ lastApproval: Date.now() - 5 * DAY });
  await ad(id).update({ reviewedAt: Date.now() - 5 * DAY });
  assert.equal((await request('ads.freeEligibility', 'legacy')).status, 'active');
  await assert.rejects(prepare('legacy', randomUUID()), { code: 'ad_active_exists' });
  const other = randomUUID();
  await ad(other).set(storedAd('legacy', 'pending'));
  await assert.rejects(review(other, 'approved'), { code: 'ad_active_exists' });
  await review(other, 'rejected');
  await policy({ freeDurationDays: 7, freeIntervalDays: 14 });
});

test('only one concurrent free submission succeeds and approval checks other legacy pending requests', async () => {
  const ids = [randomUUID(), randomUUID()];
  for (const id of ids) await prepare('concurrent', id);
  const results = await Promise.allSettled(ids.map(id => request('ads.submit', 'concurrent', { id })));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.find(result => result.status === 'rejected').reason.code, 'ad_pending_exists');
  const pendingId = ids[results.findIndex(result => result.status === 'fulfilled')];
  const other = randomUUID();
  await ad(other).set(storedAd('concurrent', 'pending'));
  await assert.rejects(review(pendingId, 'approved'), { code: 'ad_pending_exists' });
  await review(other, 'rejected');
  await review(pendingId, 'approved');
});

test('the approval ledger survives owner deletion and the waiting rule opens after fourteen days', async () => {
  const id = randomUUID();
  const uid = 'owner-delete';
  const reviewedAt = Date.now() - 2 * DAY;
  const endsAt = reviewedAt + 7 * DAY;
  const publicId = `mybucket/ads/submissions/${uid}/${id}`;
  await ad(id).set(storedAd(uid, 'approved', {
    startsAt: reviewedAt, reviewedAt, endsAt, publishedUntil: endsAt, mediaType: 'image',
    media: { publicId, resourceType: 'image', version: 1, format: 'png' },
  }));
  const removed = [];
  const destroy = async (owner, payload) => { removed.push([owner, payload]); };
  await assert.rejects(removeExpiredOffer('different-owner', id, db, destroy), { code: 'invalid_ad_id' });
  assert.deepEqual(removed, []);
  await assert.rejects(removeExpiredOffer(uid, id, db, async () => { throw new Error('provider unavailable'); }), /provider unavailable/);
  assert.equal((await ad(id).get()).get('status'), 'deleting');
  assert.equal(await readPublicOfferAds('ads.detail', { id }, db), null);
  await removeExpiredOffer(uid, id, db, destroy);
  assert.equal((await ad(id).get()).exists, false);
  assert.deepEqual(removed, [[uid, { publicId, resourceType: 'image' }]]);
  const eligibility = await request('ads.freeEligibility', uid);
  assert.equal(eligibility.status, 'interval');
  assert.equal(eligibility.availableAt, reviewedAt + 14 * DAY);
  await assert.rejects(prepare(uid, randomUUID()), { code: 'ad_free_interval' });
  await ledger(uid).set({ lastApproval: Date.now() - 14 * DAY });
  assert.equal((await request('ads.freeEligibility', uid)).status, 'available');
});

test('legacy video is blocked, and its owner can resubmit the same details after correction', async () => {
  const id = randomUUID();
  const uid = 'legacy-video';
  const publicId = `mybucket/ads/submissions/${uid}/${id}`;
  const oldVideo = { publicId, resourceType: 'video', format: 'mp4', version: 1 };
  await assert.rejects(prepare(uid, randomUUID(), { resourceType: 'video', bytes: 25 }), { code: 'ad_free_image_only' });
  await ad(id).set(storedAd(uid, 'draft', { mediaType: 'video' }));
  await assert.rejects(request('ads.submit', uid, { id }), { code: 'ad_free_image_only' });
  await ad(id).set(storedAd(uid, 'pending', { mediaType: 'video', media: oldVideo }));
  await assert.rejects(review(id, 'approved'), { code: 'ad_free_image_only' });
  await assert.rejects(readOfferForRenewal(uid, { id, correction: true }, db), { code: 'ad_correction_unavailable' });
  await review(id, 'rejected', { reason: 'Use an image' });
  assert.equal((await readMyOfferAds(uid, db))[0].requiresVideoCorrection, true);
  const source = await readOfferForRenewal(uid, { id, correction: true }, db);
  assert.equal(source.title, details.title);
  assert.equal(source.media, undefined);
  await assert.rejects(readOfferForRenewal('different-owner', { id, correction: true }, db), { code: 'ad_correction_unavailable' });
  const corrected = randomUUID();
  await prepare(uid, corrected, { correctionId: id });
  const submit = destroy => sendOfferAd('ads.submit', uid, { id: corrected }, db, false, destroy);
  await assert.rejects(submit(async () => { throw new Error('provider unavailable'); }), /provider unavailable/);
  assert.equal((await ad(corrected).get()).get('status'), 'draft');
  assert.deepEqual((await ad(id).get()).get('media'), oldVideo);
  const removed = [];
  const destroy = async (owner, payload) => { removed.push([owner, payload]); };
  await submit(destroy);
  await submit(destroy);
  assert.deepEqual(removed, [[uid, { publicId, resourceType: 'video' }]]);
  assert.equal((await ad(id).get()).get('description'), details.description);
  assert.equal((await ad(id).get()).get('media'), null);
  assert.equal((await ad(id).get()).get('correctedBy'), corrected);
  assert.equal((await ad(corrected).get()).get('status'), 'pending');
  await review(corrected, 'approved');
});

test('one verified image is accepted for a free ad', async t => {
  const uid = 'one-image';
  const id = randomUUID();
  const config = {
    CLOUDINARY_CLOUD_NAME: 'test-cloud', CLOUDINARY_API_KEY: 'test-key',
    CLOUDINARY_API_SECRET: 'test-secret', CLOUDINARY_UPLOAD_PRESET: 'test-preset',
  };
  for (const [key, value] of Object.entries(config)) {
    const previous = process.env[key];
    process.env[key] = value;
    t.after(() => { if (previous === undefined) delete process.env[key]; else process.env[key] = previous; });
  }
  const { signed } = await prepare(uid, id, { resourceType: 'image', bytes: 100 });
  assert.equal(signed.resourceType, 'image');
  const version = 1;
  const publicId = signed.publicId;
  const responseSignature = createHash('sha1')
    .update(`public_id=${publicId}&version=${version}${config.CLOUDINARY_API_SECRET}`).digest('hex');
  t.mock.method(globalThis, 'fetch', async url => {
    assert.equal(url, `https://api.cloudinary.com/v1_1/test-cloud/resources/image/authenticated/${publicId}`);
    return Response.json({
      public_id: publicId, resource_type: 'image', type: 'authenticated', version, bytes: 100, format: 'png',
      asset_id: 'image-asset', secure_url: `https://res.cloudinary.com/test-cloud/image/authenticated/${publicId}.png`,
    });
  });
  await assert.rejects(request('ads.submit', uid, { id, publicId, version, responseSignature, resourceType: 'video' }), { code: 'invalid_upload_request' });
  await request('ads.submit', uid, { id, publicId, version, responseSignature, resourceType: 'image' });
  assert.deepEqual((await ad(id).get()).get('media'), { publicId, resourceType: 'image', version, format: 'png' });
  await review(id, 'approved');
});

test('featured and VIP retain their paid approval and favorites, free retains likes only', async () => {
  const uid = 'paid-advertiser';
  const requestedStart = Date.now() - DAY;
  const endsAt = requestedStart + 2 * DAY;
  for (const tier of ['featured', 'vip']) {
    const id = randomUUID();
    await ad(id).set(storedAd(uid, 'pending', {
      startsAt: requestedStart, endsAt, mediaType: 'video',
      payment: { tier, method: 'instapay', amountEgp: 100, phone: '01012345678' },
      receipt: { publicId: 'test', resourceType: 'image', version: 1, format: 'png' },
    }));
    await assert.rejects(review(id, 'approved'), { code: 'payment_confirmation_required' });
    await review(id, 'approved', { paymentConfirmed: true, transferReference: `TEST-${tier}`, receivedAmountEgp: 100 });
    const approved = (await ad(id).get()).data();
    assert.equal(approved.endsAt - approved.startsAt, 2 * DAY);
    assert.equal(approved.mediaType, 'video');
    assert.equal((await setOfferReaction(uid, { id, reaction: 'saved', active: true }, db)).state.saved, true);
  }
  assert.equal((await request('ads.freeEligibility', uid)).status, 'available');
  const freeId = randomUUID();
  await prepare(uid, freeId);
  await request('ads.submit', uid, { id: freeId });
  await review(freeId, 'approved');
  await assert.rejects(setOfferReaction(uid, { id: freeId, reaction: 'saved', active: true }, db), { code: 'ad_favorites_unavailable' });
  assert.equal((await setOfferReaction(uid, { id: freeId, reaction: 'liked', active: true }, db)).state.liked, true);
});

test('the existing cleanup retains free ads for ten days and still deletes older records', async () => {
  const retained = randomUUID();
  const expired = randomUUID();
  const now = Date.now();
  for (const [id, endsAt] of [[retained, now - 9 * DAY], [expired, now - 11 * DAY]]) {
    await ad(id).set(storedAd('retention', 'approved', {
      startsAt: endsAt - 7 * DAY, endsAt, publishedUntil: endsAt,
    }));
  }
  assert.equal((await readMyOfferAds('retention', db)).length, 1);
  await assert.rejects(readOfferForRenewal('retention', { id: expired }, db), { code: 'ad_renewal_unavailable' });
  assert.deepEqual(await purgeExpiredOffers(db), { removed: 1, failed: 0 });
  assert.equal((await ad(retained).get()).exists, true);
  assert.equal((await ad(expired).get()).exists, false);
});
