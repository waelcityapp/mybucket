import assert from 'node:assert/strict';
import { parseNaturalDateTime } from '../src/utils/dateTime.ts';
const reference = new Date(2026, 10, 1, 14, 0, 0);
for (const phrase of ['أول امبارح', 'اول امبارح', 'أول أمس', 'قبل امبارح', 'من أول امبارح', 'day before yesterday', 'two days ago']) {
  assert.equal(parseNaturalDateTime(phrase, reference).date, '2026-10-30', phrase);
}
console.log('7/7 relative-date test cases passed');
