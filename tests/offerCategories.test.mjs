import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { rankOfferCategories } from '../src/data/offerAds.ts';
import { manageOfferCategories, readOfferCategories } from '../server/offerCategories.ts';
import { sendOfferAd } from '../server/offerAds.ts';

test('categories rank by live volume, then newest publication, then the selected alphabet', () => {
  const category = (id, ar, en, archived) => ({ id, ar, en, archived });
  const ad = (categorySlug, startsAt) => ({ categorySlug, startsAt });
  const categories = [
    category('a', 'زيتون', 'Apple'), category('b', 'أرز', 'Zebra'),
    category('volume', 'ح', 'Volume'), category('old', 'ج', 'Old'), category('recent', 'ي', 'Recent'),
    category('hidden', 'د', 'Hidden', true), category('draining', 'ت', 'Draining', true),
  ];
  const ads = [ad('volume', 1), ad('volume', 2), ad('old', 3), ad('recent', 8), ad('draining', 5)];
  const rank = lang => rankOfferCategories(categories, ads, lang).map(item => item.id);
  assert.deepEqual(rank('ar'), ['volume', 'recent', 'draining', 'old', 'b', 'a']);
  assert.deepEqual(rank('en'), ['volume', 'recent', 'draining', 'old', 'a', 'b']);
});

test('catalog updates preserve category IDs and archive prevents new submissions', async () => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST ?? '', /^(127\.0\.0\.1|localhost):\d+$/);
  const app = initializeApp({ projectId: `demo-cat-${randomUUID().slice(0, 8)}` });
  const db = getFirestore(app);
  try {
    const seed = await readOfferCategories(db);
    assert.ok(seed.some(item => item.id === 'food-beverages'));
    const [added] = (await manageOfferCategories({ operation: 'add', ar: 'كتب', en: 'Books' }, db)).slice(-1);
    await manageOfferCategories({ operation: 'rename', id: added.id, ar: 'مكتبات', en: 'Bookshops' }, db);
    assert.equal((await readOfferCategories(db)).find(item => item.id === added.id).en, 'Bookshops');

    const payload = () => ({ id: randomUUID(), tier: 'free', categorySlug: added.id,
      title: 'Book sale', description: 'Books for sale', merchant: 'A shop', resourceType: null });
    await sendOfferAd('ads.prepare', 'active-owner', payload(), db);
    await manageOfferCategories({ operation: 'archive', id: added.id }, db);
    assert.equal((await readOfferCategories(db)).find(item => item.id === added.id).archived, true);
    await assert.rejects(sendOfferAd('ads.prepare', 'new-owner', payload(), db), { code: 'ad_category_unavailable' });
    await manageOfferCategories({ operation: 'restore', id: added.id }, db);
    await sendOfferAd('ads.prepare', 'new-owner', payload(), db);
  } finally {
    await db.terminate();
    await deleteApp(app);
  }
});
