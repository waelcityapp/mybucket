import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTrialAccessCommit } from '../scripts/trial-access-commit-plan.mjs';

test('commit plan creates only absent access records, checks billing and settings, and preserves dates', () => {
  const record = { uid:'example', registeredAt:'2026-09-06T13:14:15.000Z', paidUntil:null, schemaVersion:1 };
  const args = { records:[record], expectedCount:1, settingsUpdateTime:'2026-11-07T22:19:03.811Z' };
  const plan = buildTrialAccessCommit(args);
  assert.equal(plan.writes.length, 3);
  assert.match(plan.writes[0].verify, /appSettings\/subscriptionTrials$/);
  assert.deepEqual(plan.writes[1].currentDocument, { exists:false });
  assert.match(plan.writes[1].verify, /billing\/subscription$/);
  assert.deepEqual(plan.writes[2].currentDocument, { exists:false });
  assert.match(plan.writes[2].update.name, /billing\/access$/);
  assert.equal(plan.writes[2].update.fields.registeredAt.timestampValue, record.registeredAt);
  assert.equal(plan.writes[2].update.fields.paidUntil.nullValue, null);
  assert.throws(() => buildTrialAccessCommit({ ...args, expectedCount:2 }), /unexpected-count/);
  assert.throws(() => buildTrialAccessCommit({ ...args, records:[record, record], expectedCount:2 }), /invalid-user/);
  assert.throws(() => buildTrialAccessCommit({ ...args, records:[{ ...record, registeredAt:'invalid' }] }), /invalid-date/);
  assert.throws(() => buildTrialAccessCommit({ ...args, records:[{ ...record, paidUntil:'anything' }] }), /invalid-record/);
});
