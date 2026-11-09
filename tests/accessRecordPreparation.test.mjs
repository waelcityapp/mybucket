// Synthetic fixtures only; never connect this test to a real project.
import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, runTransaction, Timestamp } from 'firebase/firestore';

test('prepare trial access for five synthetic accounts without resetting dates or balances', async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Firestore emulator is required');
  const env = await initializeTestEnvironment({ projectId: 'demo-mybucket-rules' });
  try {
    await env.withSecurityRulesDisabled(async context => {
      const db = context.firestore();
      const originalDates = ['2026-09-06T13:14:15.000Z', '2026-10-31T10:00:00.000Z', '2026-11-03T12:00:00.000Z', '2026-11-07T09:00:00.000Z', '2026-11-08T17:00:00.000Z'];
      const users = originalDates.map((created, i) => ({ uid: `fixture_${i}`, created }));
      for (const user of users) {
        await setDoc(doc(db, 'users', user.uid, 'accounts', 'fixture'), { balance: 123, currency: 'EGP' });
        await setDoc(doc(db, 'users', user.uid, 'transactions', 'fixture'), { amount: 3, type: 'expense' });
      }
      const prepare = async user => {
        const date = Date.parse(user.created);
        if (!Number.isFinite(date) || date > Date.now()) throw new Error('invalid registration');
        const access = doc(db, 'users', user.uid, 'billing', 'access');
        return runTransaction(db, async tx => {
          if ((await tx.get(access)).exists()) return false;
          tx.set(access, { registeredAt: Timestamp.fromMillis(date), paidUntil: null, schemaVersion: 1 });
          return true;
        });
      };
      for (const user of users) assert.equal(await prepare(user), true);
      for (const user of users) {
        assert.equal(await prepare(user), false);
        const access = (await getDoc(doc(db, 'users', user.uid, 'billing', 'access'))).data();
        const account = (await getDoc(doc(db, 'users', user.uid, 'accounts', 'fixture'))).data();
        const movement = (await getDoc(doc(db, 'users', user.uid, 'transactions', 'fixture'))).data();
        assert.equal(access.registeredAt.toMillis(), Date.parse(user.created));
        assert.equal(access.paidUntil, null);
        assert.deepEqual(account, { balance: 123, currency: 'EGP' });
        assert.deepEqual(movement, { amount: 3, type: 'expense' });
      }
      await assert.rejects(() => prepare({ uid: 'invalid', created: 'invalid' }), /invalid registration/);
    });
  } finally { await env.cleanup(); }
});
