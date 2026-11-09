import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationPeriodStart } from '../server/registrationPeriod.ts';

test('Cairo calendar filters use local midnight, week begins Saturday', () => {
  const now = Date.parse('2026-11-09T10:00:00Z');
  assert.equal(registrationPeriodStart('today', now), '2026-11-08T22:00:00.000Z');
  assert.equal(registrationPeriodStart('week', now), '2026-11-06T22:00:00.000Z');
  assert.equal(registrationPeriodStart('month', now), '2026-10-31T22:00:00.000Z');
  assert.equal(registrationPeriodStart('all', now), null);
});

test('summer offset and Cairo date near UTC midnight', () => {
  const now = Date.parse('2026-07-01T21:30:00Z');
  assert.equal(registrationPeriodStart('today', now), '2026-07-01T21:00:00.000Z');
  assert.equal(registrationPeriodStart('month', now), '2026-06-30T21:00:00.000Z');
});
