import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APP_REVISION } from '../src/config/appRevision.ts';

test('release 297 uses a dedicated comparison page and one entry point without losing the draft', () => {
  const create = readFileSync('src/components/views/CreateOfferPage.tsx', 'utf8');
  const app = readFileSync('src/App.tsx', 'utf8');
  const history = readFileSync('src/utils/navigationHistory.ts', 'utf8');
  assert.equal(APP_REVISION, '#297');
  assert.match(create, /pricingOpen/);
  assert.match(create, /onChoose=\{choosePricingTier\}/);
  assert.match(create, /قارن المميزات والأسعار/);
  assert.match(create, /window\.history\.pushState/);
  assert.match(create, /window\.history\.back\(\)/);
  assert.doesNotMatch(create, /<AdTierInfoDialog|aria-haspopup="dialog"/);
  assert.match(app, /\/offers\/new\/pricing/);
  assert.match(history, /\/offers\/new\/pricing/);
});

test('comparison reads actual admin prices and free limits, not default or hard-coded rates', () => {
  const page = readFileSync('src/components/views/FeaturedAdInfoPage.tsx', 'utf8');
  assert.match(page, /'ads\.paidPrices'/);
  assert.match(page, /'ads\.freePolicy'/);
  assert.match(page, /setPrices\(data\)/);
  assert.match(page, /setPolicy\(data\)/);
  assert.match(page, /prices\[tier\]/);
  assert.match(page, /policy\.freeDurationDays/);
  assert.match(page, /policy\.freeIntervalDays/);
  assert.match(page, /إعادة المحاولة/);
  assert.doesNotMatch(page, /DEFAULT_PAID_AD_PRICES|100 جنيه|200 جنيه|<dialog|showModal\(/);
});

test('comparison displays implemented benefits and never promises VIP delivery', () => {
  const page = readFileSync('src/components/views/FeaturedAdInfoPage.tsx', 'utf8');
  assert.match(page, /30 ثانية/);
  assert.match(page, /60 ثانية/);
  assert.match(page, /حفظ في المفضلة/);
  assert.match(page, /استخدم الخريطة/);
  assert.match(page, /مش مضمون وصولها لكل جهاز/);
  assert.doesNotMatch(page, /زيارة صفحة المعلن|Visit advertiser page/);
});
