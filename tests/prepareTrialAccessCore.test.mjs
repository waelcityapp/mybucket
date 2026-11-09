import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareTrialAccess } from '../scripts/prepare-trial-access-core.mjs';

function fixture() {
  let commits = 0;
  const users = Array.from({ length:5 }, (_, i) => ({ uid:`fixture_${i}`, creationTime:'2026-09-06T12:34:56.000Z' }));
  return { users, get commits() { return commits; }, adapter:{
    readSettings: async () => ({ proDays:15, basicDays:72, updateTime:'2026-11-07T22:19:03.811Z' }),
    listUsers: async () => users,
    readBillingState: async () => ({ billingExists:false, accessExists:false }),
    commit: async body => { assert.equal(body.writes.length, 11); commits++; },
  } };
}
test('preview never writes and apply commits the five guarded records once', async () => {
  const f = fixture();
  assert.equal((await prepareTrialAccess({ adapter:f.adapter })).mode, 'preview');
  assert.equal(f.commits, 0);
  assert.equal((await prepareTrialAccess({ adapter:f.adapter, execute:true })).mode, 'committed');
  assert.equal(f.commits, 1);
});
test('changed settings, changed account count, existing records, or invalid dates stop before writes', async () => {
  const f = fixture();
  f.adapter.readSettings = async () => ({ proDays:15, basicDays:73, updateTime:'2026-11-07T22:19:03.811Z' });
  await assert.rejects(() => prepareTrialAccess({ adapter:f.adapter, execute:true }), /settings-changed/);
  f.adapter.readSettings = async () => ({ proDays:15, basicDays:72, updateTime:'2026-11-07T22:19:03.811Z' });
  f.users.pop();
  await assert.rejects(() => prepareTrialAccess({ adapter:f.adapter, execute:true }), /account-count-changed/);
  f.users.push({ uid:'five', creationTime:'2026-09-06T12:34:56.000Z' });
  f.adapter.readBillingState = async () => ({ billingExists:true, accessExists:false });
  await assert.rejects(() => prepareTrialAccess({ adapter:f.adapter, execute:true }), /review-required/);
  f.adapter.readBillingState = async () => ({ billingExists:false, accessExists:false });
  f.users[0].creationTime = 'invalid';
  await assert.rejects(() => prepareTrialAccess({ adapter:f.adapter, execute:true }), /review-required/);
  assert.equal(f.commits, 0);
});
