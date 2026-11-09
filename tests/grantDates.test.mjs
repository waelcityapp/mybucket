import test from 'node:test';
import assert from 'node:assert/strict';
import { cairoGrantDate, grantLastDayAfterMonths } from '../src/utils/grantDates.ts';

test('presets use Cairo calendar dates and clamp month ends', () => {
  assert.equal(grantLastDayAfterMonths(3,Date.parse('2026-11-09T10:00:00Z')),'2027-02-09');
  assert.equal(grantLastDayAfterMonths(1,Date.parse('2027-01-31T10:00:00Z')),'2027-02-28');
  assert.equal(cairoGrantDate(Date.parse('2026-11-09T22:30:00Z')),'2026-11-10');
});
