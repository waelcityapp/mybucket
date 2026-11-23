import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('admin approval clearly presents VIP days and real payment verification', () => {
  const ui = readFileSync('src/components/views/AdminOfferAds.tsx', 'utf8');
  assert.match(ui, /عدد أيام النشر المطلوبة/);
  assert.match(ui, /Requested publication days/);
  assert.match(ui, /رقم عملية التحويل المستلمة/);
  assert.match(ui, /المبلغ المطلوب التأكد من وصوله/);
  assert.match(ui, /راجعت حساب الاستلام بنفسي/);
  assert.match(ui, /رقم العملية غير صالح/);
  assert.match(ui, /الزر متوقف لحد ما تدخل رقم العملية الحقيقي/);
  assert.doesNotMatch(ui, /المبلغ المستلم \(ج\.م\.\)|المرجع في سجل الاستلام الفعلي/);
});

test('admin review derives amount from locked invoice but still requires human bank confirmation and valid reference', () => {
  const ui = readFileSync('src/components/views/AdminOfferAds.tsx', 'utf8');
  const server = readFileSync('server/offerAds.ts', 'utf8');
  assert.match(ui, /paymentConfirmed \? ad\?\.payment\?\.amountEgp \?\? null : null/);
  assert.doesNotMatch(ui, /setReceivedAmount|receivedAmount\.trim\(\)/);
  assert.match(ui, /normalizeAdTransferReference\(transferReference\)/);
  assert.match(ui, /!paymentConfirmed \|\| !ad\.payment\.receiptUrl/);
  assert.match(server, /payload\.paymentConfirmed !== true/);
  assert.match(server, /payload\.receivedAmountEgp !== ad\.payment\.amountEgp/);
  assert.match(server, /reference_already_used/);
});
