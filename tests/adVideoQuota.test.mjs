import test from 'node:test';
import assert from 'node:assert/strict';
import {cairoVideoDay,nextCairoVideoDay,adVideoPlays,takeAdVideoPlay} from '../src/utils/adVideoQuota.ts';
const storage=()=>{const m=new Map(); return {getItem:k=>m.get(k)??null,setItem:(k,v)=>m.set(k,v)};};
test('each advertisement has three plays per browser per Cairo day',()=>{
 const s=storage(), day=new Date('2026-11-16T12:00:00Z');
 assert.deepEqual([takeAdVideoPlay(s,'a',day),takeAdVideoPlay(s,'a',day),takeAdVideoPlay(s,'a',day)],[2,1,0]);
 assert.equal(adVideoPlays(s,'a',day),3);
 assert.equal(takeAdVideoPlay(s,'a',day),0);
 assert.equal(adVideoPlays(s,'b',day),0);
 assert.equal(adVideoPlays(s,'a',new Date('2026-11-17T12:00:00Z')),0);
});
test('finds next Cairo midnight even across daylight-saving changes',()=>{
 assert.equal(new Date(nextCairoVideoDay(new Date('2026-11-16T12:00:00Z'))).toISOString(),'2026-11-16T22:00:00.000Z');
 assert.equal(new Date(nextCairoVideoDay(new Date('2026-06-01T12:00:00Z'))).toISOString(),'2026-06-01T21:00:00.000Z');
});
test('day changes on Cairo midnight and invalid counts fail closed',()=>{
 assert.equal(cairoVideoDay(new Date('2026-11-16T21:59:00Z')),'2026-11-16');
 assert.equal(cairoVideoDay(new Date('2026-11-16T22:00:00Z')),'2026-11-17');
 const s=storage(), now=new Date('2026-11-16T12:00:00Z');s.setItem('mybucket_ad_video_a_2026-11-16','wrong');
 assert.equal(adVideoPlays(s,'a',now),3);
});
