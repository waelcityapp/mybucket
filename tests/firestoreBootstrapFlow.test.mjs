import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertSucceeds, assertFails } from '@firebase/rules-unit-testing';
import { doc, setDoc, getDoc, Timestamp as ClientTimestamp } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { ensureTrialAccess } from '../server/trialAccessBootstrap.ts';

test('new-user bootstrap and draft rules work together on the emulator', async () => {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('local emulator required');
  const projectId = 'demo-mybucket-rules';
  const env = await initializeTestEnvironment({ projectId, firestore:{ rules:readFileSync('firestore.review.rules','utf8') } });
  const app = initializeApp({ projectId }, 'rules-bootstrap-integration');
  const admin = getFirestore(app);
  try {
    await admin.doc('appSettings/subscriptionTrials').set({ proDays:15, basicDays:72 });
    const uid = 'new_signup';
    const client = env.authenticatedContext(uid).firestore();
    const account = doc(client, `users/${uid}/accounts/cash`);
    await assertSucceeds(setDoc(doc(client, `users/${uid}`), { userId:uid, email:'new@example.test', displayName:'New', photoURL:'', lastLoginAt:new Date().toISOString() }));
    await assertFails(setDoc(account, { userId:uid, type:'cash', currency:'EGP', balance:0 }));
    const created = new Date(Date.now() - 3600_000).toISOString();
    const auth = { getUser:async () => ({ metadata:{ creationTime:created } }) };
    assert.equal(await ensureTrialAccess(uid, { db:admin, auth }), 'created');
    assert.equal((await admin.doc(`users/${uid}/billing/access`).get()).data().registeredAt.toMillis(), Date.parse(created));
    await assertSucceeds(setDoc(account, { userId:uid, type:'cash', currency:'EGP', balance:0 }));
    await assertSucceeds(setDoc(doc(client, `users/${uid}/categories/test`), { userId:uid, name:'Test', type:'expense' }));
    await assertSucceeds(setDoc(doc(client, `users/${uid}/preferences/learned_memory`), { items:[] }));
    await admin.doc(`users/${uid}/billing/access`).set({ registeredAt:Timestamp.fromMillis(Date.now()-80*86400000), paidUntil:null, schemaVersion:1 });
    await assertSucceeds(getDoc(account));
    await assertFails(setDoc(account, { userId:uid, type:'cash', currency:'EGP', balance:10 }));
    await assertFails(setDoc(doc(client, `users/${uid}/transactions/expired`), { type:'expense', amount:10 }));
    assert.equal((await admin.doc(`users/${uid}/billing/access`).get()).data().registeredAt.toMillis() < ClientTimestamp.now().toMillis(), true);
  } finally { await deleteApp(app); await env.cleanup(); }
});
