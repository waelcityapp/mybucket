import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { reminderAction } from '../server/reminderService.ts';

test('real reminder transactions isolate one edit, replace future edits and preserve financial records', async()=>{
  if(!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST||'')) throw Error('Local emulator required');
  const app=initializeApp({projectId:'demo-reminder-workspace'});const db=getFirestore(app);const uid='workspace-user';
  const fields={kind:'obligation',category:'rent',title:'إيجار',amount:3000,currency:'EGP',dueDate:'2026-11-15',note:'',frequency:'monthly',leadDays:7,tone:1,remindTime:'09:00',repeat:'daily'};
  try {
    await db.doc(`users/${uid}/accounts/cash`).set({balance:12345});
    const {reminder}=await reminderAction(uid,'reminders.create',fields);const id=reminder.id;const ref=db.doc(`users/${uid}/reminders/${id}`);
    await reminderAction(uid,'reminders.toggle',{id:id+'__0',done:true});
    await reminderAction(uid,'reminders.update',{...fields,id:id+'__2',amount:6000,dueDate:'2027-01-15',scope:'once'});
    await reminderAction(uid,'reminders.update',{...fields,id:id+'__3',amount:8000,dueDate:'2027-02-15',scope:'future'});
    await reminderAction(uid,'reminders.update',{...fields,id:id+'__1',amount:4000,dueDate:'2026-12-15',scope:'future'});
    const updated=(await ref.get()).data();assert.deepEqual(updated.changes.map(x=>x.fromIndex),[1]);assert.deepEqual(updated.overrides,{});assert.equal(updated.states['0'].done,true);assert.equal(updated.changes[0].amount,4000);
    await reminderAction(uid,'reminders.delete',{id:id+'__1'});assert.equal((await ref.get()).data().states['1'].cancelled,true);
    await reminderAction(uid,'reminders.delete',{id});assert.equal((await ref.get()).exists,false);
    assert.deepEqual((await db.doc(`users/${uid}/accounts/cash`).get()).data(),{balance:12345});
  } finally {await deleteApp(app);}
});
