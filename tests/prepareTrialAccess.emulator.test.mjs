import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { prepareTrialAccessEmulator } from '../server/prepareTrialAccessEmulator.mjs';

test('emulator-only preparation preserves registration and financial documents', async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Firestore emulator is required');
  const app = initializeApp({ projectId: 'demo-mybucket-rules' }, 'trial-access-test');
  const db = getFirestore(app);
  const dates = ['2026-09-06T13:14:15.000Z','2026-10-31T10:00:00.000Z','2026-11-03T12:00:00.000Z','2026-11-07T09:00:00.000Z','2026-11-08T17:00:00.000Z'];
  const users = dates.map((created, i) => ({ uid: `test_user_${i}`, metadata: { creationTime: created } }));
  const auth = { getUser: async uid => users.find(u => u.uid === uid) || { metadata: { creationTime: 'invalid' } } };
  try {
    for (const u of users) {
      await db.doc(`users/${u.uid}/accounts/cash`).set({ balance: 123, currency: 'EGP' });
      await db.doc(`users/${u.uid}/transactions/item`).set({ amount: 3, type: 'expense' });
    }
    for (const u of users) assert.equal(await prepareTrialAccessEmulator({ db, auth, uid: u.uid }), 'created');
    for (const u of users) {
      assert.equal(await prepareTrialAccessEmulator({ db, auth, uid: u.uid }), 'already-exists');
      const access = (await db.doc(`users/${u.uid}/billing/access`).get()).data();
      assert.equal(access.registeredAt.toMillis(), Date.parse(u.metadata.creationTime));
      assert.equal(access.paidUntil, null);
      assert.deepEqual((await db.doc(`users/${u.uid}/accounts/cash`).get()).data(), { balance:123, currency:'EGP' });
      assert.deepEqual((await db.doc(`users/${u.uid}/transactions/item`).get()).data(), { amount:3, type:'expense' });
    }
    await db.doc('users/billing_case/billing/subscription').set({ isPaid: true });
    const reviewAuth = { getUser: async () => ({ metadata: { creationTime: dates[0] } }) };
    assert.equal(await prepareTrialAccessEmulator({ db, auth: reviewAuth, uid:'billing_case' }), 'review-billing');
    assert.equal((await db.doc('users/billing_case/billing/access').get()).exists, false);
    await assert.rejects(() => prepareTrialAccessEmulator({ db, auth, uid:'invalid' }), /invalid-registration/);
    const prior = process.env.FIRESTORE_EMULATOR_HOST;
    delete process.env.FIRESTORE_EMULATOR_HOST;
    try { await assert.rejects(() => prepareTrialAccessEmulator({ db, auth, uid:users[0].uid }), /emulator-only/); }
    finally { process.env.FIRESTORE_EMULATOR_HOST = prior; }
  } finally { await deleteApp(app); }
});
