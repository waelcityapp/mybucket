import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminFirestore } from '../server/firebaseAdmin.ts';
import { saveFinancialCollection } from '../server/financialCollections.ts';
import { saveFinancialTransaction } from '../server/financialTransactions.ts';
import { readSiteVisits, recordExpenseReturn, recordInteractiveActivity, recordSiteVisit } from '../server/siteVisits.ts';
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
  await Promise.all(Array.from({ length: 10 }, () => recordSiteVisit(origin, host, browserId, db)));
  await recordSiteVisit(origin, host, randomUUID(), db);
  assert.deepEqual(await readSiteVisits(date, db), {
    date, visitors: 2, demoUsers: 1, activeAccounts: 0, activityReportingStart: '2026-11-25', firstExpenseAccounts: 0, returningExpenseAccounts: 0,
  });
  assert.equal((await readSiteVisits(siteVisitDay(new Date(Date.now() - 86400000)), db)).demoUsers, 0);
});

test('daily activity counts any supported action once, while first expense and return stay separate', async () => {
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
  assert.equal((await readSiteVisits(date, db)).activeAccounts, 0);
  await saveFinancialTransaction(uid, { transaction: entry('income', 10) });
  assert.equal((await readSiteVisits(date, db)).firstExpenseAccounts, 0);
  assert.equal((await readSiteVisits(date, db)).activeAccounts, 1);
  const expense = entry('expense', 1);
  await Promise.all([saveFinancialTransaction(uid, { transaction: expense }), saveFinancialTransaction(uid, { transaction: entry('expense', 2) })]);
  await saveFinancialTransaction(uid, { transaction: expense });
  assert.equal((await readSiteVisits(date, db)).firstExpenseAccounts, 1);
  assert.equal((await readSiteVisits(date, db)).activeAccounts, 1);
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

  assert.equal((await readSiteVisits(date, db)).activeAccounts, 2);
  assert.equal((await readSiteVisits('2026-11-24', db)).activeAccounts, null);

  const newAccountUser = await setup();
  const bank = { id: 'bank', type: 'bank', name: 'Bank', nameAr: 'بنك', balance: 0, currency: 'EGP', createdAt: now.toISOString() };
  await saveFinancialCollection(newAccountUser, 'financial.accounts.save', { items: [bank] });
  assert.equal((await readSiteVisits(date, db)).activeAccounts, 3);
  const transferUser = await setup();
  await db.doc(`users/${transferUser}/accounts/bank`).set(bank);
  await saveFinancialTransaction(transferUser, { transaction: { ...entry('transfer', 10), toAccountId: 'bank' } });
  assert.equal((await readSiteVisits(date, db)).activeAccounts, 4);
  const searchUser = await setup();
  await Promise.all([recordInteractiveActivity(searchUser, db), recordInteractiveActivity(searchUser, db)]);
  await saveFinancialTransaction(searchUser, { transaction: entry('income', 1) });
  assert.equal((await readSiteVisits(date, db)).activeAccounts, 5);

  const rows = (await db.collection('siteExpenseActivity').get()).docs;
  assert.deepEqual(rows.map(row => row.data()).sort((a, b) => Number(!!a.legacy) - Number(!!b.legacy)),
    [{ firstExpenseDay: date, returnedFromDay: date }, { legacy: true }]);
  assert.ok(rows.every(row => row.id !== uid && row.id !== existing));
});
