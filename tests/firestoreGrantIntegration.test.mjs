import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { setFreeGrant, endFreeGrant } from '../server/grantService.ts';
import { reserveAiQuota, DEFAULT_AI_DAILY_LIMITS } from '../server/aiQuota.ts';

test('real Firestore transactions preserve data, enforce concurrent limits and stop after revocation', async () => {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local Firestore emulator required');
  const app=initializeApp({projectId:'demo-mybucket-grants-integration'},'grant-integration');
  const db=getFirestore(app), uid='grant_integration_user', actor={uid:'owner',email:'waelvts@gmail.com'};
  const now=Date.parse('2026-11-09T10:00:00Z');
  const auth={getUser:async id=>({uid:id})};
  const deps={db,auth};
  const sub={trialStartedAt:'2025-01-01T00:00:00Z',isPaid:false,paidExpiresAt:null};
  const quotas={db,getSubscription:async()=>sub,getTrials:async()=>({proDays:15,basicDays:75}),getLimits:async()=>({...DEFAULT_AI_DAILY_LIMITS}),now:()=>now};
  try {
    await db.doc(`users/${uid}/billing/access`).set({registeredAt:Timestamp.fromMillis(Date.parse(sub.trialStartedAt)),paidUntil:null,schemaVersion:1});
    await db.doc(`users/${uid}/billing/subscription`).set(sub);
    await db.doc(`users/${uid}/accounts/cash`).set({balance:123,currency:'EGP'});
    await setFreeGrant(actor,{uid,plan:'pro',endsAt:'2027-02-09T12:00:00Z'},deps,()=>now);
    const results=await Promise.allSettled(Array.from({length:25},()=>reserveAiQuota(uid,'دفعت 100',false,quotas)));
    let successes=results.filter(r=>r.status==='fulfilled').length;
    assert.ok(successes<=15);
    const counter=db.doc(`users/${uid}/aiUsage/daily_2026-11-09`);
    assert.equal((await counter.get()).data()?.proGeminiEntries,successes);
    while(successes<15){await reserveAiQuota(uid,'دفعت 100',false,quotas);successes++;}
    await assert.rejects(reserveAiQuota(uid,'دفعت 100',false,quotas),e=>e.code==='ai_daily_limit_reached');
    assert.equal((await reserveAiQuota(uid,'دفعت 100',true,quotas)).engine,'local');
    await setFreeGrant(actor,{uid,plan:'basic',endsAt:'2027-05-09T12:00:00Z'},deps,()=>now+1000);
    await assert.rejects(reserveAiQuota(uid,'دفعت 100',false,{...quotas,now:()=>now+1500}),e=>e.code==='pro_plan_required');
    assert.equal((await reserveAiQuota(uid,'دفعت 100',true,{...quotas,now:()=>now+1500})).plan,'basic');
    await setFreeGrant(actor,{uid,plan:'pro',endsAt:'2027-05-09T12:00:00Z'},deps,()=>now+2000);
    await assert.rejects(reserveAiQuota(uid,'دفعت 100',false,{...quotas,now:()=>now+3000}),e=>e.code==='ai_daily_limit_reached');
    await endFreeGrant(actor,{uid},deps,()=>now+4000);
    await assert.rejects(reserveAiQuota(uid,'دفعت 100',false,{...quotas,now:()=>now+5000}),e=>e.code==='subscription_expired');
    assert.deepEqual((await db.doc(`users/${uid}/accounts/cash`).get()).data(),{balance:123,currency:'EGP'});
    assert.deepEqual((await db.doc(`users/${uid}/billing/subscription`).get()).data(),sub);
  } finally { await deleteApp(app); }
});

test('granting and ending Basic preserves an existing paid entitlement', async () => {
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw new Error('Local Firestore emulator required');
  const app=initializeApp({projectId:'demo-mybucket-paid-overlap'},'paid-grant-integration');
  const db=getFirestore(app), uid='paid_user', now=Date.parse('2026-11-09T10:00:00Z'), actor={uid:'owner',email:'waelvts@gmail.com'};
  const paidUntil=Timestamp.fromDate(new Date('2027-12-01T00:00:00Z'));
  const sub={trialStartedAt:'2025-01-01T00:00:00Z',isPaid:true,paidExpiresAt:'2027-12-01T00:00:00Z'};
  const deps={db,auth:{getUser:async id=>({uid:id})}};
  const quota={db,getSubscription:async()=>sub,getTrials:async()=>({proDays:15,basicDays:75}),getLimits:async()=>({...DEFAULT_AI_DAILY_LIMITS}),now:()=>now+1000};
  try {
    await db.doc(`users/${uid}/billing/access`).set({registeredAt:Timestamp.fromDate(new Date(sub.trialStartedAt)),paidUntil,schemaVersion:1});
    await db.doc(`users/${uid}/billing/subscription`).set(sub);
    await setFreeGrant(actor,{uid,plan:'basic',endsAt:'2027-05-09T12:00:00Z'},deps,()=>now);
    assert.equal((await reserveAiQuota(uid,'دفعت 100',false,quota)).plan,'pro');
    await endFreeGrant(actor,{uid},deps,()=>now+2000);
    assert.equal((await db.doc(`users/${uid}/billing/access`).get()).data().paidUntil.toMillis(),paidUntil.toMillis());
    assert.deepEqual((await db.doc(`users/${uid}/billing/subscription`).get()).data(),sub);
  } finally {await deleteApp(app);}
});
