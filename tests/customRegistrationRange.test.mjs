import test from 'node:test';
import assert from 'node:assert/strict';
import { customRegistrationRange } from '../server/registrationPeriod.ts';

test('date range includes the entire last day in Cairo', () => {
  assert.deepEqual(customRegistrationRange('2026-11-01','2026-11-10'), {start:'2026-10-31T22:00:00.000Z',endExclusive:'2026-11-10T22:00:00.000Z'});
});
test('reject invalid or reversed dates', () => {
  assert.throws(() => customRegistrationRange('2026-02-30','2026-03-01'));
  assert.throws(() => customRegistrationRange('2026-11-11','2026-11-10'));
});
