import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, updateDoc, writeBatch, runTransaction, Timestamp } from 'firebase/firestore';

test('realistic setup, linked transfer, legacy profile, expiry and owner isolation', async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Firestore emulator is required');
  const env = await initializeTestEnvironment({ projectId:'demo-mybucket-rules', firestore:{ rules:readFileSync('firestore.review.rules','utf8') } });
  try {
    const db = env.authenticatedContext('alice').firestore();
    const other = env.authenticatedContext('bob').firestore();
    await env.withSecurityRulesDisabled(async ctx => {
      const admin = ctx.firestore();
      await setDoc(doc(admin,'appSettings/subscriptionTrials'), { proDays:15, basicDays:72 });
      await setDoc(doc(admin,'users/alice/billing/access'), { registeredAt:Timestamp.fromMillis(Date.now()-10*86400000), paidUntil:null, schemaVersion:1 });
      await setDoc(doc(admin,'users/alice'), { userId:'alice', email:'a@example.test', legacyExtra:'keep', prototypeAffiliateCode:'OLD_CODE' });
    });
    await assertSucceeds(setDoc(doc(db,'users/alice'), { userId:'alice', email:'a@example.test', displayName:'Alice', photoURL:'', lastLoginAt:new Date().toISOString() }, { merge:true }));
    assert.equal((await getDoc(doc(db,'users/alice'))).data().legacyExtra,'keep');
    await assertFails(setDoc(doc(db,'users/alice'), { isAdmin:true }, { merge:true }));
    const newcomer = env.authenticatedContext('new_user').firestore();
    await assertSucceeds(setDoc(doc(newcomer,'users/new_user'), { userId:'new_user', email:'n@example.test', displayName:'New', photoURL:'', lastLoginAt:new Date().toISOString() }, { merge:true }));
    await assertFails(setDoc(doc(newcomer,'users/new_user/accounts/cash'), { userId:'new_user', type:'cash', currency:'EGP', balance:0 }));
    await env.withSecurityRulesDisabled(async ctx => setDoc(doc(ctx.firestore(),'users/new_user/billing/access'), { registeredAt:Timestamp.now(), paidUntil:null, schemaVersion:1 }));
    await assertSucceeds(setDoc(doc(newcomer,'users/new_user/accounts/cash'), { userId:'new_user', type:'cash', currency:'EGP', balance:0 }));
    const setup = writeBatch(db);
    setup.set(doc(db,'users/alice/accounts/cash'), { userId:'alice', type:'cash', currency:'EGP', balance:100 });
    setup.set(doc(db,'users/alice/accounts/bank'), { userId:'alice', type:'bank', currency:'EGP', balance:50 });
    setup.set(doc(db,'users/alice/accounts/card'), { userId:'alice', type:'card', linkedBankId:'bank', currency:'EGP', balance:0 });
    await assertSucceeds(setup.commit());
    await assertSucceeds(runTransaction(db, async t => {
      const refs = Array.from({ length:10 }, (_, i) => doc(db,`users/alice/categories/c${i}`));
      const snapshots = await Promise.all(refs.map(ref => t.get(ref)));
      snapshots.forEach((snapshot, i) => { if (!snapshot.exists()) t.set(refs[i], { userId:'alice', type:'expense', name:'test' }); });
    }));
    await assertSucceeds(setDoc(doc(db,'users/alice/preferences/learned_memory'), { items:[] }));
    const cash = doc(db,'users/alice/accounts/cash'), bank = doc(db,'users/alice/accounts/bank');
    const tx = doc(db,'users/alice/transactions/t1');
    await assertSucceeds(runTransaction(db, async t => {
      const [from,to] = await Promise.all([t.get(cash),t.get(bank)]);
      t.update(cash,{ balance:from.data().balance-10 });
      t.update(bank,{ balance:to.data().balance+10 });
      t.set(tx,{ userId:'alice', type:'transfer', amount:10, currency:'EGP', accountId:'cash', toAccountId:'card', balanceAccountId:'cash', toBalanceAccountId:'bank' });
    }));
    assert.equal((await getDoc(cash)).data().balance,90);
    assert.equal((await getDoc(bank)).data().balance,60);
    await assertFails(getDoc(doc(other,'users/alice/accounts/cash')));
    await assertFails(updateDoc(doc(other,'users/alice/accounts/cash'), { balance:0 }));
    await env.withSecurityRulesDisabled(async ctx => setDoc(doc(ctx.firestore(),'users/alice/billing/access'), { registeredAt:Timestamp.fromMillis(Date.now()-80*86400000), paidUntil:null, schemaVersion:1 }));
    await assertSucceeds(getDoc(cash));
    await assertSucceeds(getDoc(tx));
    await assertFails(updateDoc(cash,{balance:80}));
    await assertFails(setDoc(doc(db,'users/alice/transactions/blocked'),{ type:'expense', amount:10 }));
    await assertSucceeds(getDoc(doc(db,'users/alice/preferences/learned_memory')));
    await assertFails(setDoc(doc(db,'users/alice/preferences/learned_memory'), { items:['preserved'] }));
  } finally { await env.cleanup(); }
});
