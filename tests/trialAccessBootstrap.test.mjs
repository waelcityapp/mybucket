import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { ensureTrialAccess } from '../server/trialAccessBootstrap.ts';

test('new access uses original registration, is race-safe, and preserves accounts and existing records', async () => {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('local emulator required');
  const app = initializeApp({ projectId:'demo-mybucket-rules' }, 'trial-bootstrap-test');
  const db = getFirestore(app);
  const original = '2026-09-06T13:14:15.000Z';
  const auth = { getUser: async () => ({ metadata:{ creationTime:original } }) };
  try {
    await db.doc('users/test_user/accounts/cash').set({ balance:123, currency:'EGP' });
    await db.doc('users/test_user/transactions/tx').set({ type:'expense', amount:3 });
    const deps = { db, auth };
    const results = await Promise.all([ensureTrialAccess('test_user', deps), ensureTrialAccess('test_user', deps)]);
    assert.deepEqual(results.sort(), ['created','existing']);
    const access = (await db.doc('users/test_user/billing/access').get()).data();
    assert.equal(access.registeredAt.toMillis(), Date.parse(original));
    assert.equal(access.paidUntil, null);
    assert.deepEqual((await db.doc('users/test_user/accounts/cash').get()).data(), { balance:123, currency:'EGP' });
    assert.deepEqual((await db.doc('users/test_user/transactions/tx').get()).data(), { type:'expense', amount:3 });
    await db.doc('users/existing/billing/access').set({ registeredAt:Timestamp.fromDate(new Date(original)), paidUntil:null, schemaVersion:1, marker:'preserve' });
    assert.equal(await ensureTrialAccess('existing', deps), 'existing');
    assert.equal((await db.doc('users/existing/billing/access').get()).data().marker, 'preserve');
    await db.doc('users/billing/billing/subscription').set({ isPaid:true });
    await assert.rejects(() => ensureTrialAccess('billing', deps), /existing-billing-needs-review/);
    assert.equal((await db.doc('users/billing/billing/access').get()).exists, false);
    await db.doc('users/invalid/billing/access').set({ registeredAt:'invalid' });
    await assert.rejects(() => ensureTrialAccess('invalid', deps), /existing-access-needs-review/);
    const badAuth = { getUser:async () => ({metadata:{creationTime:'invalid'}}) };
    await assert.rejects(() => ensureTrialAccess('bad_date', { db, auth:badAuth }), /registration-date-unavailable/);
  } finally { await deleteApp(app); }
});
