import test from 'node:test';
import assert from 'node:assert/strict';
import { cairoGrantDate, grantLastDayAfterDays, grantLastDayAfterMonths } from '../src/utils/grantDates.ts';

test('presets use Cairo calendar dates and clamp month ends', () => {
  assert.equal(grantLastDayAfterMonths(3,Date.parse('2026-11-09T10:00:00Z')),'2027-02-09');
  assert.equal(grantLastDayAfterMonths(1,Date.parse('2027-01-31T10:00:00Z')),'2027-02-28');
  assert.equal(cairoGrantDate(Date.parse('2026-11-09T22:30:00Z')),'2026-11-10');
});

test('custom grant days include today and cross calendar boundaries in Cairo', () => {
  assert.equal(grantLastDayAfterDays(1, Date.parse('2026-11-09T10:00:00Z')), '2026-11-09');
  assert.equal(grantLastDayAfterDays(3, Date.parse('2026-12-31T10:00:00Z')), '2027-01-02');
  assert.equal(grantLastDayAfterDays(2, Date.parse('2026-11-09T22:30:00Z')), '2026-11-11');
  assert.throws(() => grantLastDayAfterDays(0));
  assert.throws(() => grantLastDayAfterDays(1.5));
  assert.throws(() => grantLastDayAfterDays(3651));
});
