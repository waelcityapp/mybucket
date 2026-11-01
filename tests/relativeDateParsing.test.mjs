import assert from 'node:assert/strict';
import { parseNaturalDateTime } from '../src/utils/dateTime.ts';
const reference = new Date(2026, 10, 1, 14, 0, 0);
for (const phrase of ['أول امبارح', 'اول امبارح', 'أول أمس', 'قبل امبارح', 'من أول امبارح', 'day before yesterday', 'two days ago']) {
  assert.equal(parseNaturalDateTime(phrase, reference).date, '2026-10-30', phrase);
}
console.log('7/7 relative-date test cases passed');

const threeDaysAgo = [
  'من 3 ايام', 'من ٣ أيام', 'من تلت ايام', 'من تلات أيام',
  'من ثلاثة أيام', 'من ثلاث أيام', 'قبل ثلاثه ايام', 'منذ تلت أيام',
  'three days ago', '3 days ago',
];
for (const phrase of threeDaysAgo) {
  assert.equal(parseNaturalDateTime(phrase, reference).date, '2026-10-29', phrase);
}
console.log('10/10 spoken-three-days date test cases passed');
