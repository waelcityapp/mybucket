import test from 'node:test';
import assert from 'node:assert/strict';
import { activeGrant } from '../src/config/grantPolicy.ts';

test('Basic and Pro grants are valid only during their own interval', () => {
  const start='2026-11-09T12:00:00.000Z', end='2027-05-09T12:00:00.000Z';
  for (const plan of ['basic','pro']) {
    const grant={plan,startsAt:start,endsAt:end};
    assert.equal(activeGrant(grant, Date.parse(start)-1),null);
    assert.equal(activeGrant(grant, Date.parse(start))?.plan,plan);
    assert.equal(activeGrant(grant, Date.parse(end)-1)?.plan,plan);
    assert.equal(activeGrant(grant, Date.parse(end)),null);
  }
});
test('invalid or unknown grants never enable access', () => {
  assert.equal(activeGrant({plan:'paid',startsAt:'2026-01-01',endsAt:'2027-01-01'}),null);
  assert.equal(activeGrant({plan:'pro',startsAt:'bad',endsAt:'2027-01-01'}),null);
  assert.equal(activeGrant({plan:'pro',startsAt:'2027-01-01',endsAt:'2026-01-01'}),null);
});

test('grant extends only its plan and restores previous status after expiry', async () => {
  const { stageFor } = await import('../src/config/subscriptionPolicy.ts');
  const now=Date.parse('2026-11-09T12:00:00Z');
  const sub={trialStartedAt:'2026-01-01T00:00:00Z',isPaid:false,grant:{plan:'basic',startsAt:'2026-11-09T00:00:00Z',endsAt:'2027-05-09T00:00:00Z'}};
  assert.equal(stageFor(sub,now),'basic-free');
  assert.equal(stageFor({...sub,grant:{...sub.grant,plan:'pro'}},now),'pro-trial');
  assert.equal(stageFor(sub,Date.parse('2027-05-09T00:00:00Z')),'expired');
  assert.equal(stageFor({...sub,isPaid:true,paidExpiresAt:'2027-12-01T00:00:00Z'},now),'paid');
});

test('access decoding keeps a grant separate from paid subscription fields', async () => {
  const { Timestamp } = await import('firebase-admin/firestore');
  const { grantFromAccess } = await import('../src/config/grantPolicy.ts');
  const result=grantFromAccess({grantPlan:'pro',grantStartsAt:Timestamp.fromMillis(Date.parse('2026-11-09T12:00:00.123Z')),grantUntil:Timestamp.fromMillis(Date.parse('2027-02-10T22:00:00Z')),paidUntil:null});
  assert.deepEqual(result,{plan:'pro',startsAt:'2026-11-09T12:00:00.123Z',endsAt:'2027-02-10T22:00:00.000Z'});
  assert.equal(grantFromAccess({grantPlan:'pro',grantStartsAt:'2026-11-09',grantUntil:'2027-01-01'}),null);
});
