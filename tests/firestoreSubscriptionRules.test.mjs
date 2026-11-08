// Run ONLY against Firebase Emulator, never production.
// Setup: npm install --no-save @firebase/rules-unit-testing firebase-tools
// firebase emulators:exec --only firestore --project demo-mybucket-rules `node --test tests/firestoreSubscriptionRules.test.mjs`
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, deleteDoc, writeBatch, Timestamp } from 'firebase/firestore';

test('draft subscription rules: owner expiry, global changes, cross-account and paid access', async () => {
  const env = await initializeTestEnvironment({
    projectId: 'demo-mybucket-rules',
    firestore: { rules: readFileSync('firestore.subscription-draft.rules', 'utf8') }
  });
  try {
    const alice = env.authenticatedContext('alice').firestore();
    const bob = env.authenticatedContext('bob').firestore();
    const guest = env.unauthenticatedContext().firestore();
    const account = doc(alice, 'users/alice/accounts/cash');
    const transaction = doc(alice, 'users/alice/transactions/tx1');
    const profile = doc(alice, 'users/alice');
    await assertSucceeds(setDoc(profile, {
      userId: 'alice', email: 'alice@example.com', displayName: 'Alice',
      photoURL: '', lastLoginAt: new Date().toISOString()
    }));
    await assertSucceeds(setDoc(profile, { displayName: 'Alicia', updatedAt: new Date().toISOString() }, { merge: true }));
    await assertFails(setDoc(profile, { isAdmin: true }, { merge: true }));
    await assertFails(setDoc(profile, { role: 'owner' }, { merge: true }));
    await assertFails(deleteDoc(profile));
    await assertFails(setDoc(doc(alice, 'users/alice/aiUsage/daily_2026-11-08'), { expenseAiCount: 0 }));

    const yesterday40 = Timestamp.fromMillis(Date.now() - 40 * 86400000);
    const paidFuture = Timestamp.fromMillis(Date.now() + 10 * 86400000);

    await env.withSecurityRulesDisabled(async ctx => {
      const admin = ctx.firestore();
      await setDoc(doc(admin, 'appSettings/subscriptionTrials'), { proDays: 15, basicDays: 75 });
      await setDoc(doc(admin, 'users/alice/billing/access'), { registeredAt: yesterday40, paidUntil: null, schemaVersion: 1 });
      await setDoc(doc(admin, 'users/alice/accounts/cash'), { userId:'alice', balance:100 });
      await setDoc(doc(admin, 'users/alice/transactions/tx1'), { userId:'alice', amount:25 });
    });

    await assertSucceeds(getDoc(account));
    await assertFails(getDoc(doc(bob, 'users/alice/accounts/cash')));
    await assertFails(getDoc(doc(guest, 'users/alice/accounts/cash')));
    await assertFails(setDoc(doc(bob, 'users/alice/accounts/cash'), {balance:1000}));
    await assertFails(setDoc(doc(alice, 'users/alice/billing/access'), {registeredAt: Timestamp.now()}));
    await assertFails(setDoc(doc(alice, 'appSettings/subscriptionTrials'), {basicDays:365,proDays:15}));
    await assertSucceeds(setDoc(doc(alice, 'users/alice/transactions/current'), {amount:1}));

    // Admin reduces Basic from 75 to 30 for ALL accounts: expiry applies immediately.
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'appSettings/subscriptionTrials'), { proDays: 15, basicDays: 30 });
    });
    await assertSucceeds(getDoc(account));
    await assertSucceeds(getDoc(transaction));
    await assertFails(setDoc(doc(alice, 'users/alice/transactions/current'), {amount:2}));
    await assertFails(setDoc(doc(alice, 'users/alice/accounts/cash'), {balance:101}));
    await assertFails(deleteDoc(transaction));
    await assertFails(setDoc(doc(alice, 'users/alice/categories/new'), {name:'new'}));
    await assertFails(setDoc(doc(alice, 'users/alice/preferences/test'), {notes:'new'}));
    const batch = writeBatch(alice);
    batch.set(doc(alice, 'users/alice/transactions/tx2'), {amount:2});
    batch.set(account, {balance:98});
    await assertFails(batch.commit());

    // Trusted, server-written paid term restores write access.
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'users/alice/billing/access'), { registeredAt: yesterday40, paidUntil: paidFuture, schemaVersion: 1 });
    });
    await assertSucceeds(setDoc(doc(alice, 'users/alice/transactions/paid'), {amount:3}));
    await env.withSecurityRulesDisabled(async ctx => {
      await setDoc(doc(ctx.firestore(), 'users/alice/billing/access'), { registeredAt: yesterday40, paidUntil: null, schemaVersion: 1 });
    });
    await assertFails(setDoc(doc(alice, 'users/alice/transactions/denied'), {amount:4}));

    // Missing trusted access document must fail closed, but reads stay available.
    await env.withSecurityRulesDisabled(async ctx => {
      await deleteDoc(doc(ctx.firestore(), 'users/alice/billing/access'));
    });
    await assertFails(setDoc(doc(alice, 'users/alice/transactions/denied2'), {amount:5}));
    await assertSucceeds(getDoc(account));
    assert.ok(true);
  } finally {
    await env.cleanup();
  }
});
