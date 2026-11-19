import test from 'node:test';
import assert from 'node:assert/strict';
import {adScheduleDate,cairoAdScheduleNow,emptyAdSchedule} from '../src/utils/adSchedule.ts';
const input={day:'29',month:'2',year:'2032',hour:'12',minute:'00',period:'am'};
test('interprets midnight and noon in Cairo regardless of device timezone', () => {
 assert.equal(adScheduleDate(input).toISOString(), '2032-02-28T22:00:00.000Z');
 assert.equal(adScheduleDate({...input,period:'pm'}).toISOString(), '2032-02-29T10:00:00.000Z');
 assert.deepEqual(cairoAdScheduleNow(new Date('2032-02-28T22:47:00Z')), {...input,minute:'47'});
});
test('handles Cairo daylight saving changes', () => {
 const summer = {...input,year:'2026',month:'7',day:'1',hour:'1',period:'pm'};
 assert.equal(adScheduleDate(summer).toISOString(), '2026-07-01T10:00:00.000Z');
 assert.equal(adScheduleDate({...input,year:'2026',month:'4',day:'24',minute:'30'}),null);
});
test('rejects impossible dates and incomplete selections',()=>{
 assert.equal(adScheduleDate(emptyAdSchedule()),null);
 assert.equal(adScheduleDate({...input,year:'2031'}),null);
 assert.equal(adScheduleDate({...input,day:'31',month:'4'}),null);
 assert.equal(adScheduleDate({...input,minute:'60'}),null);
 assert.equal(adScheduleDate({...input,hour:'0'}),null);
});
