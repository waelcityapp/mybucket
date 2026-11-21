import assert from 'node:assert/strict';
import { parseNaturalLanguageInput } from '../src/utils/naturalLanguageParser.ts';
const OriginalDate = globalThis.Date;
const reference = new OriginalDate(2026, 10, 1, 2, 20, 0);
class FakeDate extends OriginalDate {
  constructor(...args) {
    if (args.length === 0) super(reference.valueOf());
    else super(...args);
  }
  static now() { return reference.valueOf(); }
}
globalThis.Date = FakeDate;
try {
  for (const raw of [
    'صرفت 200 جنيه من 3 ايام جبت هدية لاخويا',
    'صرفت 200 جنيه من تلت ايام جبت هدية لاخويا',
    'صرفت 200 جنيه من تلات أيام جبت هدية لاخويا',
    'صرفت 200 جنيه من ثلاثة أيام جبت هدية لاخويا',
  ]) {
    const parsed = parseNaturalLanguageInput(raw, [], []);
    assert.equal(parsed.amount, 200, raw);
    assert.equal(parsed.date, '2026-10-29', raw);
    assert.equal(parsed.description, 'هدية لاخويا', raw);
    assert.equal(parsed.type, 'expense', raw);
  }
  for (const [raw, description] of [
    ['دخل لي 200 جنيه في الكاش', ''],
    ['دخل لي في الكاش ٢٠٠ جنيه', ''],
    ['دخل لي ٢٠٠ جنيه في الكاش علاوة', 'علاوة'],
    ['دخل لي ٢٠٠ جنيه في الكاش عشان شغل إضافي', 'شغل إضافي'],
  ]) {
    const parsed = parseNaturalLanguageInput(raw, [], []);
    assert.equal(parsed.amount, 200, raw);
    assert.equal(parsed.type, 'income', raw);
    assert.equal(parsed.description, description, raw);
  }
  console.log('8/8 end-to-end local transaction parsing cases passed');
} finally {
  globalThis.Date = OriginalDate;
}
