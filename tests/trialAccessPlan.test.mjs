import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrialAccessPlan } from '../scripts/trial-access-plan.mjs';

test('preview preserves dates, skips existing records, and flags uncertain cases', () => {
  const now = Date.parse('2026-11-09T12:00:00Z');
  const account = { uid: 'one', creationTime: '2026-09-06T12:34:56Z', billingExists: false, accessExists: false };
  const result = buildTrialAccessPlan([account, { ...account, uid: 'existing', accessExists: true },
    { ...account, uid: 'billing', billingExists: true }, { ...account, uid: 'bad', creationTime: 'invalid' },
    { ...account, uid: 'future', creationTime: '2030-01-01' }, account], now);
  assert.deepEqual(result.summary, { total: 6, toCreate: 1, alreadyPresent: 1, needsReview: 4 });
  assert.deepEqual(result.records[0], { uid: 'one', registeredAt: '2026-09-06T12:34:56.000Z', paidUntil: null, schemaVersion: 1 });
});
