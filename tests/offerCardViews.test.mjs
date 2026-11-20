import assert from 'node:assert/strict';
import test from 'node:test';
import gateway from '../api/gateway.ts';
import { readPublicOfferAds, readPublishedOffers, recordOfferCardView } from '../server/offerAds.ts';

const id = '00000000-0000-4000-8000-000000000001';
const now = Date.now();
const activeAd = { status: 'approved', startsAt: now - 60000, endsAt: now + 60000, viewCount: 7 };

function offerDatabase(ad) {
  const snapshot = { id, data: () => ad };
  const reference = { get: async () => snapshot };
  const updates = [];
  const db = {
    collection: () => ({
      where: () => ({ get: async () => ({ docs: [snapshot] }) }),
      doc: () => reference,
    }),
    runTransaction: async callback => callback({
      get: async () => snapshot,
      update: (ref, fields) => updates.push({ ref, fields }),
    }),
  };
  return { db, updates };
}

test('only the administrator list includes views and older ads start at zero', async () => {
  const { db } = offerDatabase(activeAd);
  const [publicAd] = await readPublicOfferAds('ads.list', {}, db);
  const detail = await readPublicOfferAds('ads.detail', { id }, db);
  const [adminAd] = await readPublishedOffers(true, db);
  const [olderAd] = await readPublishedOffers(true, offerDatabase({ ...activeAd, viewCount: undefined }).db);

  assert.equal('viewCount' in publicAd, false);
  assert.equal('viewCount' in detail, false);
  assert.equal(adminAd.viewCount, 7);
  assert.equal(olderAd.viewCount, 0);
});

test('only currently published ads can record a card view', async () => {
  const { db, updates } = offerDatabase(activeAd);
  await recordOfferCardView({ id }, db);
  assert.equal(updates.length, 1);
  assert.equal(updates[0].fields.viewCount.operand, 1);
  for (const ad of [undefined, { ...activeAd, status: 'pending' }, { ...activeAd, endsAt: now }, { ...activeAd, startsAt: now + 60000 }]) {
    const inactive = offerDatabase(ad);
    await recordOfferCardView({ id }, inactive.db);
    assert.equal(inactive.updates.length, 0);
  }
  await assert.rejects(recordOfferCardView({ id: 'demo' }, db), { code: 'invalid_ad_id' });
});

test('the counts endpoint requires authentication', async () => {
  let status;
  let body;
  await gateway({ method: 'POST', headers: {}, body: { action: 'admin.ads.listWithViews' } }, {
    status(code) { status = code; return this; },
    json(result) { body = result; },
  });
  assert.equal(status, 401);
  assert.equal(body.error, 'authentication_required');
});

test('public totals count each account once and removal updates the correct total', async () => {
  const { setOfferReaction } = await import('../server/offerAds.ts');
  const records = new Map();
  function collection(path) {
    return { doc: key => ({ path: `${path}/${key}`, collection: child => collection(`${path}/${key}/${child}`) }) };
  }
  const db = {
    collection,
    runTransaction: callback => callback({
      get: async ref => ({ data: () => records.get(ref.path) }),
      set: (ref, value, options) => records.set(ref.path, options?.merge ? { ...records.get(ref.path), ...value } : value),
      delete: ref => records.delete(ref.path),
    }),
  };
  records.set(`offerAds/${id}`, activeAd);
  const react = (uid, reaction, active) => setOfferReaction(uid, { id, reaction, active }, db);
  assert.equal((await react('a', 'liked', true)).engagement.likeCount, 1);
  assert.equal((await react('a', 'liked', true)).engagement.likeCount, 1);
  assert.equal((await react('b', 'liked', true)).engagement.likeCount, 2);
  assert.deepEqual((await react('a', 'saved', true)).engagement, { likeCount: 2, favoriteCount: 1 });
  assert.deepEqual((await react('a', 'liked', false)).engagement, { likeCount: 1, favoriteCount: 1 });
  assert.deepEqual((await react('a', 'saved', false)).engagement, { likeCount: 1, favoriteCount: 0 });
  assert.equal(records.has(`offerAdReactions/a/ads/${id}`), false);
  await assert.rejects(setOfferReaction('a', { id: 'not-a-demo', reaction: 'liked', active: true }, db), { code: 'invalid_ad_id' });
});
