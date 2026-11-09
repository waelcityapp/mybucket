import test from 'node:test';
import assert from 'node:assert/strict';
import { cairoClock, visibleReminderAlerts, shouldShowReminderBanner } from '../src/utils/reminderAlertPolicy.ts';

const base={id:'one',kind:'obligation',title:'قسط',amount:100,currency:'EGP',dueDate:'2026-11-11',leadDays:1,remindTime:'09:00',done:false};
const now=new Date('2026-11-10T08:00:00Z');
test('alert remains visible after its original day until handled',()=>{
  assert.deepEqual(visibleReminderAlerts([base],now).map(x=>x.id),['one']);
  assert.equal(visibleReminderAlerts([base],new Date('2026-11-12T08:00:00Z')).length,1);
  assert.equal(visibleReminderAlerts([{...base,done:true}],now).length,0);
  assert.equal(visibleReminderAlerts([{...base,alertDisabled:true}],now).length,0);
  assert.equal(visibleReminderAlerts([{...base,snoozedUntil:'2026-11-11'}],now).length,0);
});
test('close hides current IDs for today, a new alert reopens the banner',()=>{
  const dismissed={day:cairoClock(now).day,ids:['one']};
  assert.equal(shouldShowReminderBanner([base],dismissed,now),false);
  assert.equal(shouldShowReminderBanner([base,{...base,id:'two'}],dismissed,now),true);
  assert.equal(shouldShowReminderBanner([base],dismissed,new Date('2026-11-11T08:00:00Z')),true);
});
test('reminder eligibility follows Cairo date and selected hour',()=>{
  assert.equal(visibleReminderAlerts([base],new Date('2026-11-10T06:59:00Z')).length,0);
  assert.equal(visibleReminderAlerts([base],new Date('2026-11-10T07:00:00Z')).length,1);
  assert.equal(cairoClock(new Date('2026-11-10T22:30:00Z')).day,'2026-11-11');
});
