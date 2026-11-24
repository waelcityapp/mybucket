import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { editOwnOfferAd, readPublicOfferAds, reviewOfferAds, sendOfferAd } from '../server/offerAds.ts';

if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) {
  throw new Error('Local Firestore emulator required');
}
const app = initializeApp({ projectId: `demo-content-${randomUUID().slice(0, 8)}` });
const db = getFirestore(app);
after(async () => { await db.terminate(); await deleteApp(app); });

const uid = 'advertiser';
const request = (action, data) => sendOfferAd(action, uid, data, db);
const ref = id => db.doc(`offerAds/${id}`);
const details = (overrides = {}) => {
  const startsAt = Date.now();
  return { id: randomUUID(), tier: 'featured', title: 'Local offer', merchant: 'Shop', description: 'Details',
    contact: '', categorySlug: 'food-beverages', resourceType: null, paymentPhone: '01012345678', amountEgp: 100,
    startsAt, endsAt: startsAt + 86400000, ...overrides };
};

test('server rejects external links, malformed contact fields and Free video before signing media or storing a draft', async () => {
  for (const key of ['title', 'merchant', 'description', 'contact']) {
    for (const tier of ['free', 'featured', 'vip']) {
      const data = details({ tier, ...(tier === 'vip' && { vipDurationDays: 1 }), [key]: 'Visit example.com', resourceType: 'image' });
      await assert.rejects(request(tier === 'free' ? 'ads.prepare' : 'ads.lockPrice', data), { code: 'ad_external_link' });
      assert.equal((await ref(data.id).get()).exists, false);
    }
  }
  for (const [key, value, code] of [['callPhone', '12345', 'ad_invalid_call_phone'],
    ['whatsappPhone', '+442079460958', 'ad_invalid_whatsapp_phone'],
    ['mapsUrl', 'https://example.com/maps', 'ad_invalid_maps_url']]) {
    await assert.rejects(request('ads.lockPrice', details({ [key]: value })), { code });
  }
  await assert.rejects(request('ads.prepare', details({ tier: 'free', resourceType: 'video' })), { code: 'ad_free_image_only' });
  const legacyDraft = details({ tier: 'free', description: 'Visit example.com' });
  await ref(legacyDraft.id).set({ ...legacyDraft, ownerId: uid, status: 'draft', mediaType: null });
  await assert.rejects(request('ads.submit', { id: legacyDraft.id }), { code: 'ad_external_link' });
});

test('a paid invoice retains independent contact values through resume and prepare, while legacy public data is unchanged', async () => {
  await reviewOfferAds('admin.ads.prices', 'admin', { featured: 0, vip: 0 }, db);
  const contact = { callPhone: '02 2345 6789', whatsappPhone: '01012345678', mapsUrl: 'https://maps.app.goo.gl/Share123' };
  const data = details({ amountEgp: 0, ...contact });
  await request('ads.lockPrice', data);
  const restored = await request('ads.resumePayment', { id: data.id });
  assert.equal(restored.callPhone, '+20223456789');
  assert.equal(restored.whatsappPhone, '+201012345678');
  assert.equal(restored.mapsUrl, contact.mapsUrl);
  await assert.rejects(request('ads.prepare', { ...data, callPhone: undefined }), { code: 'ad_invoice_mismatch' });
  await request('ads.prepare', data);
  await request('ads.submit', { id: data.id });
  await reviewOfferAds('admin.ads.review', 'admin', { id: data.id, status: 'approved' }, db);
  const publicAd = await readPublicOfferAds('ads.detail', { id: data.id }, db);
  assert.equal(publicAd.callPhone, restored.callPhone);
  assert.equal(publicAd.whatsappPhone, restored.whatsappPhone);
  assert.equal(publicAd.mapsUrl, restored.mapsUrl);

  const old = details({ contact: '01012345678', description: 'Historical example.com' });
  await ref(old.id).set({ ...old, ownerId: uid, status: 'approved', startsAt: Date.now() - 1000,
    mediaType: null, payment: { method: 'instapay', amountEgp: 100 } });
  const published = await readPublicOfferAds('ads.detail', { id: old.id }, db);
  assert.equal(published.contact, old.contact);
  assert.equal(published.description, old.description);
  assert.equal(published.whatsappPhone, undefined);
});

test('trusted Cloudinary duration enforces 30/60 and an older locked Featured invoice keeps its original limit', async t => {
  for (const [key, value] of Object.entries({
    CLOUDINARY_CLOUD_NAME: 'example-cloud', CLOUDINARY_API_KEY: 'test-key',
    CLOUDINARY_API_SECRET: 'test-secret', CLOUDINARY_UPLOAD_PRESET: 'test-preset',
  })) {
    const original = process.env[key];
    process.env[key] = value;
    t.after(() => { if (original === undefined) delete process.env[key]; else process.env[key] = original; });
  }
  let duration = 30.01;
  t.mock.method(globalThis, 'fetch', async url => {
    const publicId = new URL(url).pathname.split('/authenticated/')[1];
    return Response.json({ resource_type: 'video', type: 'authenticated', public_id: publicId, bytes: 100,
      version: 1, format: 'mp4', asset_id: 'video', video_duration: duration,
      secure_url: `https://res.cloudinary.com/example-cloud/video/authenticated/${publicId}.mp4` });
  });
  const proof = id => {
    const publicId = `mybucket/ads/submissions/${uid}/${id}`;
    return { id, resourceType: 'video', publicId, version: 1,
      responseSignature: createHash('sha1').update(`public_id=${publicId}&version=1test-secret`).digest('hex') };
  };
  for (const [tier, limit] of [['featured', 30], ['vip', 60]]) {
    const data = details({ tier, ...(tier === 'vip' && { vipDurationDays: 1 }), amountEgp: 0, resourceType: 'video', bytes: 100 });
    await request('ads.lockPrice', data);
    await request('ads.prepare', data);
    duration = limit + 0.01;
    await assert.rejects(request('ads.submit', { ...proof(data.id), duration: 1 }), { code: 'invalid_video_duration' });
    assert.equal((await ref(data.id).get()).get('status'), 'draft');
    duration = limit;
    await request('ads.submit', proof(data.id));
  }

  const old = details({ amountEgp: 0, description: 'Historical example.com', resourceType: 'video' });
  await ref(old.id).set({ ...old, ownerId: uid, status: 'draft', mediaType: 'video', uploadDay: '2026-11-23',
    priceLockedAt: Date.now() - 1000, payment: { method: 'instapay', tier: 'featured', amountEgp: 0, dailyPriceEgp: 0, phone: '+201012345678' } });
  assert.equal((await request('ads.resumePayment', { id: old.id })).videoLimit, 60);
  duration = 45;
  await request('ads.submit', proof(old.id));
  assert.equal((await ref(old.id).get()).get('description'), old.description);
});

test('admin upload summary counts direct edit files and pauses new permits without removing live ads', async t => {
  for (const [key, value] of Object.entries({
    CLOUDINARY_CLOUD_NAME: 'example-cloud', CLOUDINARY_API_KEY: 'test-key',
    CLOUDINARY_API_SECRET: 'test-secret', CLOUDINARY_UPLOAD_PRESET: 'test-preset',
  })) {
    const original = process.env[key];
    process.env[key] = value;
    t.after(() => { if (original === undefined) delete process.env[key]; else process.env[key] = original; });
  }
  t.mock.method(globalThis, 'fetch', async url => {
    const publicId = new URL(url).pathname.split('/authenticated/')[1];
    return Response.json({ resource_type: 'image', type: 'authenticated', public_id: publicId, bytes: 250_000,
      version: 1, format: 'jpg', asset_id: 'image',
      secure_url: `https://res.cloudinary.com/example-cloud/image/authenticated/${publicId}.jpg` });
  });
  const owner = randomUUID();
  const ad = details({ startsAt: Date.now() - 1000 });
  await ref(ad.id).set({ ...ad, ownerId: owner, status: 'approved', media: null });
  const upload = { ...ad, resourceType: 'image', bytes: 250_000, editRevision: '' };
  const summary = (payload = {}) => reviewOfferAds('admin.ads.uploadStats', owner, payload, db);
  const prepare = () => editOwnOfferAd('admin.ads.edit.prepare', owner, upload, db);
  const initial = await summary();
  let authorized;
  for (let index = 0; index < 4; index++) authorized = await prepare();
  const opened = await summary();
  assert.equal(opened.issued, initial.issued + 4);
  assert.equal(opened.verified, initial.verified);
  assert.equal(opened.limitedAccounts, initial.limitedAccounts);
  const { publicId } = authorized.signed;
  await editOwnOfferAd('admin.ads.edit.save', owner, {
    ...upload, editId: authorized.editId, publicId, mediaAction: 'replace', version: 1,
    responseSignature: createHash('sha1').update(`public_id=${publicId}&version=1test-secret`).digest('hex'),
  }, db);
  const verified = await summary();
  assert.equal(verified.verified, initial.verified + 1);
  assert.equal(verified.bytes, initial.bytes + 250_000);
  try {
    assert.equal((await summary({ uploadsPaused: true })).uploadsPaused, true);
    await assert.rejects(editOwnOfferAd('admin.ads.edit.prepare', owner,
      { ...upload, editRevision: authorized.editId }, db), { code: 'ad_upload_paused' });
    await assert.rejects(sendOfferAd('ads.prepare', randomUUID(),
      details({ tier: 'free', resourceType: 'image', bytes: 250_000 }), db), { code: 'ad_upload_paused' });
    assert.equal((await readPublicOfferAds('ads.detail', { id: ad.id }, db)).id, ad.id);
  } finally {
    assert.equal((await summary({ uploadsPaused: false })).uploadsPaused, false);
  }
});
