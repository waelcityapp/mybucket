import test from 'node:test';
import assert from 'node:assert/strict';
import { shiftDate, occurrenceDate, parseOccurrenceId, isoDate } from '../server/recurrence.ts';

test('monthly 31st falls back to end of short months and restores the 31st', () => {
 assert.equal(shiftDate('2027-01-31','monthly',1),'2027-02-28');
 assert.equal(shiftDate('2027-01-31','monthly',2),'2027-03-31');
 assert.equal(shiftDate('2028-01-31','monthly',1),'2028-02-29');
});
test('installments are monthly and yearly recurrence accounts for leap years', () => {
 assert.equal(shiftDate('2026-11-15','installments',12),'2027-11-15');
 assert.equal(shiftDate('2028-02-29','yearly',1),'2029-02-28');
 assert.equal(shiftDate('2028-02-29','yearly',4),'2032-02-29');
});
test('weekly schedules do not slip during month boundaries', () => {
 assert.equal(shiftDate('2026-11-29','weekly',1),'2026-12-06');
});
test('future segment updates cannot change earlier occurrences', () => {
 const changes=[{fromIndex:2,title:'Rent',amount:5500,currency:'EGP',note:'',anchorDate:'2027-03-10'}];
 assert.equal(occurrenceDate('2027-01-05','monthly',1,changes),'2027-02-05');
 assert.equal(occurrenceDate('2027-01-05','monthly',2,changes),'2027-03-10');
 assert.equal(occurrenceDate('2027-01-05','monthly',3,changes),'2027-04-10');
});
test('occurrence parsing rejects malformed IDs and validates dates', () => {
 const id='12345678-1234-1234-1234-123456789abc';
 assert.deepEqual(parseOccurrenceId(id+'__11'),{masterId:id,index:11});
 assert.equal(parseOccurrenceId(id+'___11'),null);
 assert.equal(isoDate('2027-02-29'),false);
 assert.equal(isoDate('2028-02-29'),true);
});
