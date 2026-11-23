import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { after, test } from 'node:test';
import { deleteApp, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { applyAffiliateCode, getOrCreateSubscription } from '../server/subscriptionService.ts';
import { listTrialSettingsHistory, readTrialSettings, saveTrialSettings, trialSettingsResponse } from '../server/trialSettings.ts';

if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) {
  throw new Error('Local Firestore emulator required');
}
const app = initializeApp({ projectId: `demo-basic-${randomUUID().slice(0, 8)}` });
const db = getFirestore(app);
after(async () => {
  await db.terminate();
  await deleteApp(app);
});
const settings = db.doc('appSettings/subscriptionTrials');

test('only Basic controls trial settings and legacy Pro data remains stored', async () => {
  await settings.set({ basicDays: 24, proDays: 100 });
  assert.equal((await readTrialSettings()).basicDays, 24);
  assert.equal('proDays' in await readTrialSettings(), false);
  assert.deepEqual(trialSettingsResponse({ basicDays: 24 }), { basicDays: 24, proDays: 1 });
  await assert.rejects(saveTrialSettings({ basicDays: 0 }, 'admin'), { code: 'invalid_trial_duration' });
  assert.equal((await saveTrialSettings({ basicDays: 1 }, 'admin')).basicDays, 1);
  assert.equal((await settings.get()).get('proDays'), 100);
  const [change] = await listTrialSettingsHistory();
  assert.deepEqual(change.previous, { basicDays: 24 });
  assert.deepEqual(change.next, { basicDays: 1 });
  await saveTrialSettings({ basicDays: 20 }, 'admin');
});

test('server-only discount preserves historical dates and manual grant', async () => {
  const uid = 'legacy';
  const start = new Date(Date.now() - 5 * 86400000).toISOString();
  const getRegistration = async () => start;
  const profile = db.doc(`users/${uid}`);
  const billing = profile.collection('billing').doc('subscription');
  const access = profile.collection('billing').doc('access');
  await profile.set({ prototypeAffiliateCode: 'PROTOTYPE' });
  const original = { trialStartedAt: start, trialExpiresAt: '2099-01-01T00:00:00.000Z', totalTrialDays: 35, isPaid: false, monthlyPriceEgp: 180 };
  await billing.set(original);
  await access.set({
    grantPlan: 'pro',
    grantStartsAt: Timestamp.fromMillis(Date.now() - 60000),
    grantUntil: Timestamp.fromMillis(Date.now() + 86400000),
  });
  await assert.rejects(applyAffiliateCode(uid, 'PROTOTYPE', getRegistration), { code: 'affiliate_code_invalid' });
  assert.deepEqual((await billing.get()).data(), original);
  assert.equal((await profile.get()).get('prototypeAffiliateCode'), 'PROTOTYPE');
  const code = db.doc('affiliateCodes/VALIDCODE');
  await code.set({ active: true, redemptionCount: 0, maxRedemptions: null, monthlyPriceEgp: 120, totalTrialDays: 35 });
  const result = await applyAffiliateCode(uid, 'validcode', getRegistration);
  assert.equal(result.totalTrialDays, 20);
  assert.equal(result.trialStartedAt, start);
  assert.equal(result.grant.plan, 'pro');
  assert.equal(result.isPaid, false);
  assert.equal((await billing.get()).get('trialExpiresAt'), original.trialExpiresAt);
  assert.equal((await billing.get()).get('totalTrialDays'), original.totalTrialDays);
  assert.equal((await code.get()).get('redemptionCount'), 1);
  await assert.rejects(applyAffiliateCode(uid, 'VALIDCODE', getRegistration), { code: 'affiliate_code_already_applied' });

  const newAccount = await applyAffiliateCode('new-user', 'VALIDCODE', getRegistration);
  assert.equal(newAccount.totalTrialDays, 20);
  assert.equal(newAccount.trialStartedAt, start);
  assert.equal(newAccount.grant, null);
  assert.equal(newAccount.isPaid, false);
  assert.equal((await getOrCreateSubscription('new-user')).trialExpiresAt, newAccount.trialExpiresAt);
});
