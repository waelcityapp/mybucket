import test from 'node:test';
import assert from 'node:assert/strict';
import { monthlyReminderTotals } from '../server/reminderService.ts';
const base={id:'a',kind:'obligation',title:'إيجار',amount:3000,currency:'EGP',dueDate:'2026-10-15',note:'',done:false,leadDays:7,tone:1,remindTime:'09:00',repeat:'daily',alertDisabled:false,snoozedUntil:null,createdAt:0,updatedAt:0,frequency:'monthly',states:{},overrides:{},changes:[]};
test('counts current-month scheduled amounts, including completed, and isolates currencies',()=>{
 const data=[{...base,states:{'1':{done:true}}},{...base,id:'b',kind:'receivable',frequency:'none',dueDate:'2026-11-03',amount:1500},{...base,id:'c',currency:'USD',amount:20},{...base,id:'d',frequency:'none',dueDate:'2026-12-01',amount:999}];
 assert.deepEqual(monthlyReminderTotals(data,'2026-11'),{EGP:{obligations:3000,receivables:1500},USD:{obligations:20,receivables:0}});
});
test('honors cancellation, due-date overrides, amounts and future schedule changes',()=>{
 const data=[{...base,states:{'1':{cancelled:true}}},{...base,id:'b',overrides:{'1':{dueDate:'2026-12-03'},'2':{dueDate:'2026-11-29',amount:4800}}},{...base,id:'c',changes:[{fromIndex:1,anchorDate:'2026-11-20',title:'x',amount:4500,currency:'EGP',note:''}]}];
 assert.equal(monthlyReminderTotals(data,'2026-11').EGP.obligations,9300);
});
test('weekly occurrences and finite installments are counted across month and year boundaries',()=>{
 const weekly={...base,frequency:'weekly',dueDate:'2026-11-02',amount:100};
 const installments={...base,id:'b',frequency:'installments',installmentCount:2,dueDate:'2026-10-31',amount:250};
 assert.equal(monthlyReminderTotals([weekly,installments],'2026-11').EGP.obligations,750);
 assert.equal(monthlyReminderTotals([installments],'2026-12').EGP,undefined);
 assert.equal(monthlyReminderTotals([{...base,frequency:'yearly',dueDate:'2020-02-29',amount:9}],'2027-02').EGP.obligations,9);
});
test('includes older active series beyond 400 occurrences and many independent items',()=>{
 const items=Array.from({length:280},(_,i)=>({...base,id:String(i),frequency:'none',dueDate:'2026-11-01',amount:1}));
 items.push({...base,id:'old',frequency:'weekly',dueDate:'2010-01-01',amount:10});
 assert.equal(monthlyReminderTotals(items,'2026-11').EGP.obligations,320);
});
