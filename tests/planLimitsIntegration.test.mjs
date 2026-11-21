import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminFirestore } from '../server/firebaseAdmin.ts';
import { savePlanLimitsDraft, publishPlanLimits, readPublishedPlanLimits } from '../server/planLimits.ts';
import { saveFinancialTransaction, issueAiEntryTicket } from '../server/financialTransactions.ts';
import { saveFinancialCollection } from '../server/financialCollections.ts';
import { readOwnAiQuota, reserveAiQuota } from '../server/aiQuota.ts';
import { reserveReportExport } from '../server/reportExport.ts';
import { DEFAULT_PLAN_LIMITS } from '../src/config/planLimits.ts';

test('published limits coordinate the gateway, the Firestore write boundary and existing records', async () => {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) {
    throw new Error('Local Firestore emulator required');
  }
  const projectId = 'demo-mybucket-plan-limits';
  process.env.GOOGLE_CLOUD_PROJECT = projectId;
  const rules = readFileSync('firestore.grants-draft.rules', 'utf8');
  const env = await initializeTestEnvironment({ projectId, firestore: { rules } });
  const db = getAdminFirestore();
  const now = new Date();
  const day = now.toLocaleDateString('sv-SE', { timeZone: 'Africa/Cairo' });
  const register = new Date(now.getTime() - 86400000);
  const account = { id: 'cash', type: 'cash', name: 'Cash', nameAr: 'كاش', balance: 100, currency: 'EGP' };
  const entry = id => ({ id, accountId: 'cash', type: 'expense', amount: 10, currency: 'EGP', date: day, description: '', createdAt: now.toISOString() });

  try {
    await env.clearFirestore();
    await db.doc('appSettings/subscriptionTrials').set({ basicDays: 75, proDays: 15 });
    for (const uid of ['basic', 'pro']) {
      const user = db.collection('users').doc(uid);
      await user.collection('billing').doc('subscription').set({ trialStartedAt: register.toISOString(), isPaid: false });
      await user.collection('billing').doc('access').set({
        registeredAt: Timestamp.fromDate(register),
        paidUntil: null,
        ...(uid === 'pro' ? {
          grantPlan: 'pro', grantStartsAt: Timestamp.fromDate(register),
          grantUntil: Timestamp.fromMillis(now.getTime() + 86400000),
        } : {}),
      });
      await user.collection('accounts').doc('cash').set(account);
    }

    const client = env.authenticatedContext('basic').firestore();
    const transactionRef = id => doc(client, `users/basic/transactions/${id}`);
    await assertSucceeds(setDoc(transactionRef('old'), entry('old')));
    const limits = { ...DEFAULT_PLAN_LIMITS, basicEntries: 1, basicAccounts: 1, proAiEntries: 1, proAdditionalEntries: 1, proExports: 1, proInquiries: 1 };
    const copy = { entries: { order: 1, ar: { title: 'تسجيل', detail: '' }, en: { title: 'Entries', detail: '' } } };
    const draft = await savePlanLimitsDraft({ limits, copy, revision: 0 }, 'owner');
    assert.equal((await readPublishedPlanLimits()).limits.basicEntries, 15);
    assert.equal((await readPublishedPlanLimits()).active, false);
    await assert.rejects(publishPlanLimits({ revision: 0 }, 'owner'), { code: 'plan_limits_draft_changed' });
    assert.deepEqual(await publishPlanLimits({ revision: draft.revision }, 'owner'), { limits, copy, active: true });
    assert.deepEqual(await readPublishedPlanLimits(), { limits, copy, active: true });

    await assertFails(setDoc(transactionRef('direct'), entry('direct')));
    await assertFails(setDoc(doc(client, 'users/basic/accounts/direct'), account));
    await assertFails(setDoc(doc(client, 'users/basic/categories/direct'), { type: 'expense' }));
    await assertSucceeds(getDoc(transactionRef('old')));
    await assertSucceeds(updateDoc(transactionRef('old'), { description: 'edited' }));
    await assertFails(getDoc(doc(env.authenticatedContext('other').firestore(), 'users/basic/transactions/old')));

    const saved = await Promise.allSettled(['first', 'second'].map(id => saveFinancialTransaction('basic', { transaction: entry(id) })));
    assert.equal(saved.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(saved.find(result => result.status === 'rejected').reason.code, 'plan_entry_limit');
    const winner = saved[0].status === 'fulfilled' ? 'first' : 'second';
    await saveFinancialTransaction('basic', { transaction: entry(winner) });
    assert.equal((await db.doc('users/basic/accounts/cash').get()).get('balance'), 90);
    await assert.rejects(saveFinancialCollection('basic', 'financial.accounts.save', { items: [{ ...account, id: 'extra' }] }), { code: 'plan_accounts_limit' });
    await assert.rejects(reserveReportExport('basic', 'csv'), { code: 'pro_plan_required' });

    await assert.rejects(saveFinancialTransaction('pro', { transaction: entry('manual') }), { code: 'pro_ai_allowance_first' });
    const reservation = await reserveAiQuota('pro', 'صرفت عشرة جنيه');
    assert.equal(reservation.remaining, 0);
    await assert.rejects(reserveAiQuota('pro', 'صرفت عشرة جنيه'), { code: 'ai_daily_limit_reached' });
    const ticket = await issueAiEntryTicket('pro', day);
    await saveFinancialTransaction('pro', { transaction: entry('manual') });
    await saveFinancialTransaction('pro', { transaction: entry('voice'), ticket });
    await assert.rejects(saveFinancialTransaction('pro', { transaction: entry('another') }), { code: 'plan_entry_limit' });
    const inquiry = 'كام صرفت النهاردة؟';
    const inquiryId = '04fffd58-7251-43a7-89b4-8ce02ca0b42a';
    await reserveAiQuota('pro', inquiry, false, undefined, inquiryId);
    await reserveAiQuota('pro', inquiry, true, undefined, inquiryId);
    await assert.rejects(reserveAiQuota('pro', inquiry, true, undefined, inquiryId), { code: 'plan_inquiry_limit' });
    assert.deepEqual((await readOwnAiQuota('basic')).savedEntries.basic, { used: 1, limit: 1, remaining: 0 });
    assert.deepEqual((await readOwnAiQuota('pro')).savedEntries, {
      proAi: { used: 1, limit: null, remaining: null },
      geminiAttempts: { used: 1, limit: 1, remaining: 0 },
      proAdditional: { used: 1, limit: 1, remaining: 0 },
    });
    await reserveReportExport('pro', 'csv');
    await assert.rejects(reserveReportExport('pro', 'pdf'), { code: 'report_export_limit' });
  } finally {
    await env.cleanup();
  }
});
