import test from 'node:test';
import assert from 'node:assert/strict';
import { subscriptionPayment } from '../server/subscriptionPayments.ts';

const id = '11111111-1111-4111-8111-111111111111';
const otherId = '22222222-2222-4222-8222-222222222222';
const admin = { uid: 'admin', email: 'waelvts@gmail.com' };
const approve = (requestId, db, actor = admin) =>
  subscriptionPayment('admin.subscriptionPayment.review', actor, { id: requestId, decision: 'approve' }, db);

function fixture() {
  const requests = 'subscriptionPaymentRequests/';
  const billing = 'users/member/billing/subscription';
  const records = new Map([
    [billing, { isPaid: false }],
    ['users/member/billing/access', { paidUntil: null }],
    [requests + id, { status: 'pending', uid: 'member', plan: 'basic', amount: 80, code: 'CODE', reference: 'REF123' }],
    [requests + otherId, { status: 'pending', uid: 'member', plan: 'basic', amount: 80, code: 'CODE', reference: 'REF123' }],
  ]);
  const db = {
    doc: path => path,
    collection: path => ({ doc: key => path + '/' + key }),
    runTransaction: async work => {
      const pending = [];
      const value = await work({
        get: async path => ({ exists: records.has(path), data: () => records.get(path), get: key => records.get(path)?.[key] }),
        create: (path, data) => pending.push([path, data]),
        update: (path, data) => pending.push([path, { ...records.get(path), ...data }]),
      });
      pending.forEach(([path, data]) => records.set(path, data));
      return value;
    },
  };
  return { db, records, requests, billing };
}

test('approval sets paid Basic, records the first commission and refuses a reused reference', async () => {
  const { db, records, requests, billing } = fixture();
  assert.equal((await approve(id, db)).status, 'approved');
  assert.equal(records.get(billing).paidPlan, 'basic');
  assert.equal(records.get(requests + id).commission, 25);
  const expiry = records.get(billing).paidExpiresAt;
  assert.equal((await approve(id, db)).status, 'approved');
  assert.equal(records.get(billing).paidExpiresAt, expiry);
  await assert.rejects(approve(otherId, db), { code: 'reference_already_used' });
  assert.equal(records.get(requests + otherId).status, 'pending');
  records.get(requests + otherId).reference = 'REF456';
  assert.equal((await approve(otherId, db)).status, 'approved');
  assert.equal(records.get(requests + otherId).commission, 10);
  assert.equal(Date.parse(records.get(billing).paidExpiresAt) - Date.parse(expiry), 30 * 86400000);
});

test('a regular user cannot approve a payment', async () => {
  const { db, records, requests } = fixture();
  await assert.rejects(approve(id, db, { uid: 'member', email: 'member@example.com' }), { code: 'admin_only' });
  assert.equal(records.get(requests + id).status, 'pending');
});
