import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { brandedOfferImage, offerShareHtml } from '../server/offerShare.ts';
import { offerShareExcerpt } from '../src/utils/offerShare.ts';

test('share metadata escapes advertiser text and sends visitors to the actual ad', () => {
  const html = offerShareHtml({
    url: 'https://mybucket.example/offers/share/ar/demo-restaurant-1',
    destination: 'https://mybucket.example/offers/ad/demo-restaurant-1',
    image: 'https://mybucket.example/offers/share/ar/demo-restaurant-1/image',
    app: 'My Bucket', title: 'عرض <خاص> · "المعلن"', description: 'My Bucket · خصم & هدية', lang: 'ar',
  });
  assert.match(html, /og:title" content="عرض &lt;خاص&gt; · &quot;المعلن&quot;"/);
  assert.match(html, /og:description" content="My Bucket · خصم &amp; هدية"/);
  assert.match(html, /og:image" content="https:\/\/mybucket\.example\/offers\/share\/ar\/demo-restaurant-1\/image"/);
  assert.match(html, /href="https:\/\/mybucket\.example\/offers\/ad\/demo-restaurant-1"/);
  assert.equal(offerShareExcerpt(' عرض \n خاص '), 'عرض خاص');
  assert.ok(offerShareExcerpt('😀'.repeat(130)).endsWith('…'));
});

test('preview images have the same dimensions for photos and text-only ads', async () => {
  const logo = await readFile('public/icons/mybucket-512.png');
  const photo = await readFile('public/demo-ads/food.jpg');
  for (const image of [photo, null]) {
    const result = await sharp(await brandedOfferImage(image, logo)).metadata();
    assert.deepEqual([result.width, result.height, result.format], [1200, 630, 'jpeg']);
  }
});

test('short share paths round-trip without changing the ad identifier', async () => {
  const { compactOfferId, expandOfferId, offerSharePath } = await import('../src/utils/offerShare.ts');
  const id = '6710ba5a-fed2-4b34-84ad-55b1c0faebda';
  const compact = compactOfferId(id);
  assert.equal(compact.length, 22);
  assert.equal(expandOfferId(compact), id);
  assert.equal(offerSharePath(id, 'ar'), '/s/' + compact);
  assert.equal(offerSharePath(id, 'en'), '/s/en/' + compact);
  assert.equal(expandOfferId('demo-restaurant-1'), 'demo-restaurant-1');
  assert.equal(expandOfferId('bad-code'), null);
});
