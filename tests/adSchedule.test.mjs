import test from 'node:test';
import assert from 'node:assert/strict';
import {adScheduleDate,emptyAdSchedule} from '../src/utils/adSchedule.ts';
const input={day:'29',month:'2',year:'2032',hour:'12',minute:'00',period:'am'};
test('interprets midnight and noon distinctly in local time',()=>{
 const midnight=adScheduleDate(input),noon=adScheduleDate({...input,period:'pm'});
 assert.equal(midnight.getHours(),0);assert.equal(noon.getHours(),12);
 assert.equal(midnight.getDate(),29);assert.equal(midnight.getMonth(),1);
 assert.equal(adScheduleDate({...input,hour:'1',minute:'47',period:'pm'}).getHours(),13);
});
test('rejects impossible dates and incomplete selections',()=>{
 assert.equal(adScheduleDate(emptyAdSchedule()),null);
 assert.equal(adScheduleDate({...input,year:'2031'}),null);
 assert.equal(adScheduleDate({...input,day:'31',month:'4'}),null);
 assert.equal(adScheduleDate({...input,minute:'60'}),null);
 assert.equal(adScheduleDate({...input,hour:'0'}),null);
});
