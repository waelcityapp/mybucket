import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { editOwnOfferAd, readMyOfferAds, readPublicOfferAds, reviewOfferAdEdits } from '../server/offerAds.ts';

if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) {
  throw new Error('Local Firestore emulator required');
}
const app = initializeApp({ projectId: `demo-edit-${randomUUID().slice(0, 8)}` });
const db = getFirestore(app);
after(async () => { await db.terminate(); await deleteApp(app); });

async function seed(tier = 'vip') {
  const id = randomUUID();
  const uid = randomUUID();
  const now = Date.now();
  const doc = db.collection('offerAds').doc(id);
  const original = {
    ownerId: uid, status: 'approved', title: 'Original', description: 'Original description', merchant: 'Shop', contact: '',
    categorySlug: 'food-beverages', startsAt: now - 1000, endsAt: now + 60_000, publishedUntil: now + 60_000,
    submittedAt: now - 1000, rejectionReason: '', media: null, mediaType: null, likeCount: 2, favoriteCount: 1,
    ...(tier !== 'free' && { payment: { tier, amountEgp: 200 }, receipt: { publicId: 'receipt' } }),
  };
  await doc.set(original);
  const details = (overrides = {}) => ({
    id, title: 'Proposed', description: 'Edited details', merchant: original.merchant, categorySlug: original.categorySlug,
    mediaAction: 'keep', editId: randomUUID(), editRevision: '', ...overrides,
  });
  const save = data => editOwnOfferAd('ads.edit.save', uid, data, db);
  const review = (request, status, extra = {}) => reviewOfferAdEdits('admin.ads.editRequests.review',
    { id, requestId: request.editId, status, ...extra }, db);
  return { id, uid, doc, original, details, save, review };
}

test('two submitted requests per ad, including rejection, with one pending and atomic concurrent submission', async () => {
  const ad = await seed();
  const data = ad.details();
  await assert.rejects(editOwnOfferAd('ads.edit.read', 'other', { id: ad.id }, db), { code: 'ad_edit_unavailable' });
  const outcomes = await Promise.allSettled([ad.save(data), ad.save(ad.details())]);
  assert.equal(outcomes.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(outcomes.find(result => result.status === 'rejected').reason.code, 'ad_edit_request_pending');
  const first = (await ad.doc.get()).get('editRequest.id');
  assert.deepEqual(await ad.save({ ...data, editId: first }), { saved: true });
  const publicAd = await readPublicOfferAds('ads.detail', { id: ad.id }, db);
  assert.equal(publicAd.title, ad.original.title);
  assert.equal(publicAd.editRequest, undefined);
  const request = (await reviewOfferAdEdits('admin.ads.editRequests.list', {}, db)).find(item => item.original.id === ad.id);
  assert.equal(request.proposed.title, data.title);
  await ad.review({ editId: first }, 'rejected', { reason: 'Keep original' });
  const [mine] = await readMyOfferAds(ad.uid, db);
  assert.equal(mine.editRequestsUsed, 1);
  assert.equal(mine.editRequestStatus, 'rejected');
  assert.equal(mine.editRejectionReason, 'Keep original');
  assert.equal((await ad.doc.get()).get('title'), ad.original.title);

  const second = ad.details({ tier: 'free', payment: null, endsAt: ad.original.endsAt + 86400000 });
  await ad.save(second);
  await assert.rejects(ad.review({ editId: first }, 'approved'), { code: 'ad_edit_request_unavailable' });
  await ad.review(second, 'approved');
  await ad.review(second, 'approved');
  const updated = (await ad.doc.get()).data();
  assert.equal(updated.title, second.title);
  for (const key of ['payment', 'receipt', 'startsAt', 'endsAt', 'publishedUntil', 'likeCount', 'favoriteCount', 'status']) {
    assert.deepEqual(updated[key], ad.original[key]);
  }
  assert.equal(updated.editRequestsUsed, 2);
  assert.equal((await readPublicOfferAds('ads.detail', { id: ad.id }, db)).tier, 'vip');
  await assert.rejects(ad.save(ad.details({ editRevision: second.editId })), { code: 'ad_edit_request_limit' });
});

test('approval preserves Free and Featured tiers; approved requests expire with the ad', async () => {
  for (const tier of ['free', 'featured']) {
    const ad = await seed(tier);
    const data = ad.details({ tier: 'vip' });
    await ad.save(data);
    await ad.review(data, 'approved');
    assert.equal((await readPublicOfferAds('ads.detail', { id: ad.id }, db)).tier, tier);
    const pending = ad.details({ editRevision: data.editId });
    await ad.save(pending);
    await ad.doc.update({ endsAt: Date.now() - 1 });
    await assert.rejects(ad.review(pending, 'approved'), { code: 'ad_edit_request_unavailable' });
    assert.equal((await reviewOfferAdEdits('admin.ads.editRequests.list', {}, db)).some(item => item.original.id === ad.id), false);
  }
});

test('admin direct edits remain unlimited and retain the ad type', async () => {
  const ad = await seed('featured');
  let editRevision = '';
  for (let index = 0; index < 3; index++) {
    const draft = ad.details({ title: `Admin edit ${index}`, editRevision });
    await editOwnOfferAd('admin.ads.edit.save', ad.uid, draft, db);
    editRevision = draft.editId;
  }
  const result = (await ad.doc.get()).data();
  assert.equal(result.title, 'Admin edit 2');
  assert.equal(result.editRequestsUsed, undefined);
  assert.equal(result.editRequest, undefined);
  assert.equal(result.payment.tier, 'featured');
});

test('replacement media appears only on approval; rejection schedules only proposed media for removal', async () => {
  const ad = await seed('featured');
  const previous = { publicId: `mybucket/ads/submissions/${ad.uid}/${ad.id}`, resourceType: 'image', format: 'jpg', version: 1 };
  await ad.doc.update({ media: previous, mediaType: 'image' });
  for (const status of ['rejected', 'approved']) {
    const editId = randomUUID();
    const media = { ...previous, publicId: `mybucket/ads/submissions/${ad.uid}/${editId}` };
    const staged = db.collection('offerAds').doc(editId);
    await staged.set({ ownerId: ad.uid, status: 'cancelled', editTarget: ad.id, mediaType: 'image', uploadCleanupAt: Date.now() + 60000 });
    const data = ad.details({ ...media, editId, mediaAction: 'replace' });
    await editOwnOfferAd('ads.edit.save', ad.uid, data, db, async () => ({ ...media, bytes: 100 }));
    assert.deepEqual((await ad.doc.get()).get('media'), previous);
    assert.equal((await staged.get()).exists, false);
    await ad.review(data, status);
    const target = status === 'approved' ? previous : media;
    const queued = await db.collection('offerAds').where('cleanupPublicId', '==', target.publicId).get();
    assert.equal(queued.size, 1);
    assert.deepEqual((await ad.doc.get()).get('media'), status === 'approved' ? media : previous);
  }
});
