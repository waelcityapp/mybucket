import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc, updateDoc, Timestamp } from 'firebase/firestore';
import { grantFromAccess } from '../src/config/grantPolicy.ts';
import { stageFor } from '../src/config/subscriptionPolicy.ts';

test('grant rules protect financial writes and server-owned access', async () => {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local Firestore emulator required');
  const env = await initializeTestEnvironment({projectId:'demo-mybucket-grants',firestore:{rules:readFileSync('firestore.grants-draft.rules','utf8')}});
  const now=Date.now(), old=Timestamp.fromMillis(now-200*86400000), past=Timestamp.fromMillis(now-86400000), future=Timestamp.fromMillis(now+86400000);
  try {
    await env.withSecurityRulesDisabled(async ctx => {
      const db=ctx.firestore();
      await setDoc(doc(db,'appSettings/subscriptionTrials'),{basicDays:75});
      for (const uid of ['basic','pro','expired','future','none','trial','paid']) {
        const grant = uid==='basic'||uid==='pro' ? {grantPlan:uid,grantStartsAt:past,grantUntil:future} : uid==='expired' ? {grantPlan:'pro',grantStartsAt:old,grantUntil:past} : uid==='future' ? {grantPlan:'basic',grantStartsAt:future,grantUntil:Timestamp.fromMillis(now+2*86400000)} : {};
        await setDoc(doc(db,`users/${uid}/billing/access`),{registeredAt:uid==='trial'?Timestamp.fromMillis(now-10*86400000):old,paidUntil:uid==='paid'?future:null,schemaVersion:1,...grant});
        await setDoc(doc(db,`users/${uid}/accounts/cash`),{balance:10,currency:'EGP'});
      }
    });
    for (const uid of ['basic','pro']) {
      const db=env.authenticatedContext(uid).firestore();
      await assertSucceeds(updateDoc(doc(db,`users/${uid}/accounts/cash`),{balance:11}));
      await assertSucceeds(setDoc(doc(db,`users/${uid}/transactions/expense1`),{type:'expense',amount:1,currency:'EGP'}));
      await assertSucceeds(setDoc(doc(db,`users/${uid}/categories/category1`),{name:'test'}));
      await assertSucceeds(setDoc(doc(db,`users/${uid}/preferences/main`),{language:'ar'}));
      const access = await assertSucceeds(getDoc(doc(db,`users/${uid}/billing/access`)));
      const decoded = grantFromAccess(access.data());
      assert.equal(stageFor({trialStartedAt:new Date(old.toMillis()).toISOString(),isPaid:false,grant:decoded},now), uid==='pro'?'pro-trial':'basic-free');
      await assertFails(updateDoc(doc(db,`users/${uid}/billing/access`),{grantUntil:Timestamp.fromMillis(now+10*86400000)}));
      await assertFails(setDoc(doc(db,`users/${uid}/aiUsage/daily_2026-11-09`),{proGeminiEntries:0}));
      await assertFails(getDoc(doc(db,`adminGrants/${uid}`)));
    }
    for (const uid of ['trial','paid']) {
      const db=env.authenticatedContext(uid).firestore();
      await assertSucceeds(updateDoc(doc(db,`users/${uid}/accounts/cash`),{balance:11}));
    }
    for (const uid of ['expired','future','none']) {
      const db=env.authenticatedContext(uid).firestore();
      await assertSucceeds(getDoc(doc(db,`users/${uid}/accounts/cash`)));
      await assertFails(updateDoc(doc(db,`users/${uid}/accounts/cash`),{balance:11}));
      await assertFails(setDoc(doc(db,`users/${uid}/transactions/expense1`),{type:'expense',amount:1,currency:'EGP'}));
      await assertFails(setDoc(doc(db,`users/${uid}/categories/category1`),{name:'test'}));
      await assertFails(setDoc(doc(db,`users/${uid}/preferences/main`),{language:'ar'}));
    }
    await assertFails(getDoc(doc(env.authenticatedContext('other').firestore(),'users/basic/accounts/cash')));
  } finally { await env.cleanup(); }
  assert.ok(true);
});
