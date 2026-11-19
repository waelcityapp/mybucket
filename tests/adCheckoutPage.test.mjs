import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { adRunDays, isPaymentContactPhoneValid, isReceiptImageAllowed, MAX_RECEIPT_IMAGE_BYTES } from '../src/utils/adCheckout.ts';

test('payment contact accepts Egyptian mobile formats and rejects malformed numbers', () => {
  assert.equal(isPaymentContactPhoneValid('01012345678'), true);
  assert.equal(isPaymentContactPhoneValid('+201012345678'), true);
  assert.equal(isPaymentContactPhoneValid('010-1234-5678'), true);
  assert.equal(isPaymentContactPhoneValid('٠١٥١٢٣٤٥٦٧٨'), true);
  assert.equal(isPaymentContactPhoneValid('00201112345678'), true);
  assert.equal(isPaymentContactPhoneValid('123'), false);
  assert.equal(isPaymentContactPhoneValid('0111234567'), false);
});

test('advertisement duration is derived from valid start/end times', () => {
  assert.equal(adRunDays(new Date('2026-11-20T00:00:00Z'), new Date('2026-11-21T00:00:00Z')), 1);
  assert.equal(adRunDays(new Date('2026-11-20T00:00:00Z'), new Date('2026-11-21T00:01:00Z')), 2);
  assert.equal(adRunDays(new Date('invalid'), new Date()), null);
  assert.equal(adRunDays(new Date('2026-11-21T00:00:00Z'), new Date('2026-11-20T00:00:00Z')), null);
});

test('receipt preview only accepts correctly typed size-limited images', () => {
  assert.equal(isReceiptImageAllowed('image/png', 1000), true);
  assert.equal(isReceiptImageAllowed('image/webp', MAX_RECEIPT_IMAGE_BYTES), true);
  assert.equal(isReceiptImageAllowed('image/jpeg', MAX_RECEIPT_IMAGE_BYTES + 1), false);
  assert.equal(isReceiptImageAllowed('image/svg+xml', 1024), false);
  assert.equal(isReceiptImageAllowed('image/png', 0), false);
});

test('ad checkout uses a real route and keeps payment submission disabled', () => {
  const app = readFileSync('src/App.tsx', 'utf8');
  const create = readFileSync('src/components/views/CreateOfferPage.tsx', 'utf8');
  const checkout = readFileSync('src/components/views/AdPaymentCheckout.tsx', 'utf8');
  assert.match(app, /\/offers\/new\/payment/);
  assert.match(create, /offerPaymentPreview/);
  assert.match(create, /<AdPaymentCheckout/);
  assert.match(checkout, /Invoice Summary/);
  assert.match(checkout, /InstaPay/);
  assert.doesNotMatch(checkout, /Vodafone Cash|Copy transfer number/);
  assert.match(checkout, /type="button" disabled/);
  assert.doesNotMatch(checkout, /\/api\/gateway|localStorage|fetch\s*\(/);
});
