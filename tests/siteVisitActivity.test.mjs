import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminFirestore } from '../server/firebaseAdmin.ts';
import { saveFinancialTransaction } from '../server/financialTransactions.ts';
import { readSiteVisits, recordExpenseReturn, recordSiteVisit } from '../server/siteVisits.ts';
import { siteVisitDay } from '../src/utils/siteVisitDay.ts';

if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) {
  throw new Error('Local Firestore emulator required');
}
process.env.GOOGLE_CLOUD_PROJECT = `demo-site-visits-${randomUUID().slice(0, 8)}`;
const db = getAdminFirestore();
after(() => db.terminate());

test('demo activity counts one browser once and preserves the existing visitor count', async () => {
  const browserId = randomUUID();
  const host = 'example.test';
  const origin = `https://${host}`;
  const date = siteVisitDay();
  await assert.rejects(recordSiteVisit('https://another.test', host, browserId, db, true), { code: 'invalid_origin' });
  await Promise.all([
    recordSiteVisit(origin, host, browserId, db),
    recordSiteVisit(origin, host, browserId, db, true),
    recordSiteVisit(origin, host, browserId, db, true),
  ]);
  await recordSiteVisit(origin, host, randomUUID(), db);
  assert.deepEqual(await readSiteVisits(date, db), {
    date, visitors: 2, demoUsers: 1, firstExpenseAccounts: 0, returningExpenseAccounts: 0,
  });
  assert.equal((await readSiteVisits(siteVisitDay(new Date(Date.now() - 86400000)), db)).demoUsers, 0);
});

test('only a successfully saved first expense counts, and return must be on a later Cairo day', async () => {
  const now = new Date();
  const date = siteVisitDay(now);
  const later = new Date(now.getTime() + 86400000);
  await db.doc('appSettings/subscriptionTrials').set({ basicDays: 75 });
  const registered = new Date(now.getTime() - 86400000);
  const setup = async () => {
    const uid = randomUUID();
    const user = db.collection('users').doc(uid);
    await Promise.all([
      user.collection('billing').doc('subscription').set({ trialStartedAt: registered.toISOString(), isPaid: false }),
      user.collection('billing').doc('access').set({ registeredAt: Timestamp.fromDate(registered), paidUntil: null }),
      user.collection('accounts').doc('cash').set({ id: 'cash', type: 'cash', name: 'Cash', balance: 100, currency: 'EGP' }),
    ]);
    return uid;
  };
  const entry = (type, amount) => ({
    id: randomUUID(), accountId: 'cash', type, amount, currency: 'EGP', date,
    description: 'Private data', createdAt: now.toISOString(),
  });
  const uid = await setup();
  await assert.rejects(saveFinancialTransaction(uid, { transaction: entry('expense', 1000) }), { code: 'insufficient-balance' });
  await saveFinancialTransaction(uid, { transaction: entry('income', 10) });
  assert.equal((await readSiteVisits(date, db)).firstExpenseAccounts, 0);
  const expense = entry('expense', 1);
  await Promise.all([saveFinancialTransaction(uid, { transaction: expense }), saveFinancialTransaction(uid, { transaction: entry('expense', 2) })]);
  await saveFinancialTransaction(uid, { transaction: expense });
  assert.equal((await readSiteVisits(date, db)).firstExpenseAccounts, 1);
  assert.deepEqual(await recordExpenseReturn(uid, db, now), { date, finished: false });
  assert.equal((await readSiteVisits(date, db)).returningExpenseAccounts, 0);
  await Promise.all([recordExpenseReturn(uid, db, later), recordExpenseReturn(uid, db, later)]);
  assert.equal((await readSiteVisits(date, db)).returningExpenseAccounts, 1);

  const existing = await setup();
  const oldExpense = entry('expense', 2);
  await db.doc(`users/${existing}/transactions/${oldExpense.id}`).set(oldExpense);
  await saveFinancialTransaction(existing, { transaction: entry('expense', 2) });
  await recordExpenseReturn(existing, db, later);
  assert.equal((await readSiteVisits(date, db)).firstExpenseAccounts, 1);
  assert.equal((await readSiteVisits(date, db)).returningExpenseAccounts, 1);

  const rows = (await db.collection('siteExpenseActivity').get()).docs;
  assert.deepEqual(rows.map(row => row.data()).sort((a, b) => Number(!!a.legacy) - Number(!!b.legacy)),
    [{ firstExpenseDay: date, returnedFromDay: date }, { legacy: true }]);
  assert.ok(rows.every(row => row.id !== uid && row.id !== existing));
});
