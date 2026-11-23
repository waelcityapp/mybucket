import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editOwnOfferAd } from '../server/offerAds.ts';
import { OFFER_CATEGORY_IDS } from '../src/data/offerAds.ts';

const id = '3a495cb5-e97a-4b35-a5d5-ca1c23356abe';
const editId = 'cc4c59df-2c5e-44cc-86a3-0ac89d5d990b';
const ownerId = 'admin';
const fields = { id, editId, editRevision: '', categorySlug: OFFER_CATEGORY_IDS[0],
  title: 'New title', description: 'New details', merchant: 'Business', mediaAction: 'keep' };
const original = { ownerId, title: 'Old title', status: 'approved', startsAt: 1000, endsAt: 2000,
  publishedUntil: 2000, payment: { tier: 'vip', amountEgp: 200 }, vipDurationDays: 1,
  receipt: { publicId: 'receipt' }, media: { publicId: 'original-media', resourceType: 'image' },
  mediaType: 'image', likeCount: 3 };

function memoryDb(initial = original) {
  const ads = new Map([[id, initial]]);
  const tx = {
    get: ref => ref.get(),
    update: (ref, changes) => ads.set(ref.id, { ...ads.get(ref.id), ...changes }),
    create: (ref, data) => ads.set(ref.id, data),
    delete: ref => ads.delete(ref.id),
  };
  const db = {
    collection(name) {
      assert.equal(name, 'offerAds');
      return { doc: (key = 'cleanup') => ({ id: key, get: async () => ({ data: () => ads.get(key) }) }) };
    },
    runTransaction: fn => fn(tx),
  };
  return { db, ads };
}

test('in-place edit preserves approval, paid schedule, receipt, and media', async () => {
  const { db, ads } = memoryDb();
  await editOwnOfferAd('admin.ads.edit.save', ownerId, fields, db);
  assert.deepEqual(ads.get(id), { ...original, title: fields.title, merchant: fields.merchant,
    description: fields.description, categorySlug: fields.categorySlug, contact: '', mapsUrl: '',
    callPhone: '', whatsappPhone: '', editRevision: editId });
  assert.equal(ads.size, 1);
  assert.deepEqual(await editOwnOfferAd('admin.ads.edit.save', ownerId, fields, db), { saved: true });
});

test('only the owner can edit an approved ad, with validated text and current revision', async () => {
  const { db, ads } = memoryDb();
  await assert.rejects(editOwnOfferAd('admin.ads.edit.read', 'other', { id }, db), { code: 'ad_edit_unavailable' });
  await assert.rejects(editOwnOfferAd('admin.ads.edit.save', ownerId, { ...fields, description: 'https://example.com' }, db), { code: 'ad_external_link' });
  await assert.rejects(editOwnOfferAd('admin.ads.edit.save', ownerId, { ...fields, editRevision: 'stale' }, db), { code: 'ad_edit_conflict' });
  ads.set(id, { ...original, status: 'deleting' });
  await assert.rejects(editOwnOfferAd('admin.ads.edit.save', ownerId, fields, db), { code: 'ad_edit_unavailable' });
});

test('verified media replacement updates the ad and queues the previous asset for cleanup', async () => {
  const { db, ads } = memoryDb();
  const publicId = `mybucket/ads/submissions/${ownerId}/${editId}`;
  ads.set(editId, { ownerId, status: 'cancelled', editTarget: id, mediaType: 'image', uploadCleanupAt: Date.now() + 10000 });
  const media = { publicId, resourceType: 'image', format: 'jpg', version: 1 };
  await editOwnOfferAd('admin.ads.edit.save', ownerId, { ...fields, ...media, mediaAction: 'replace' }, db,
    async () => media);
  assert.deepEqual(ads.get(id).media, media);
  assert.equal(ads.get('cleanup').cleanupPublicId, original.media.publicId);
  assert.equal(ads.has(editId), false);
});
