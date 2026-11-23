import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('regular paid ad approval is solely an admin decision with no banking fields', () => {
  const ui = readFileSync('src/components/views/AdminOfferAds.tsx', 'utf8');
  assert.match(ui, /عدد أيام النشر المطلوبة/);
  assert.match(ui, /Requested publication days/);
  assert.match(ui, /قرار الموافقة والنشر في إيدك/);
  assert.match(ui, /تأكيد الموافقة والنشر/);
  assert.match(ui, /ad\.payment && !ad\.legacyTransfer/);
  assert.match(ui, /!!ad\.legacyTransfer && !!ad\.payment/);
  assert.match(ui, /ad\?\.legacyTransfer \? \{/);
});

test('server accepts admin reviewed trial image while retaining special old-transfer validation', () => {
  const server = readFileSync('server/offerAds.ts', 'utf8');
  assert.match(server, /requiresPaidReceipt\(ad\.payment\) && !ad\.receipt/);
  assert.match(server, /ad\.legacyTransfer && payload\.paymentConfirmed !== true/);
  assert.match(server, /status === 'approved' && ad\.legacyTransfer && ad\.payment/);
  assert.match(server, /payload\.receivedAmountEgp !== ad\.payment\.amountEgp/);
  assert.match(server, /reference_already_used/);
});
