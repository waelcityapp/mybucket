import test from 'node:test';
import assert from 'node:assert/strict';
import { countFilteredUsers } from '../server/adminUsers.ts';

const actor = {uid:'admin',email:'waelvts@gmail.com'};
function setup() {
  const users = Array.from({length: 330}, (_,i) => ({uid:`u${i}`, name:`user ${i}`, email:`user${i}@example.com`, disabled:i % 13 === 0, createdAt:'2026-11-01T00:00:00Z'}));
  let docReads = 0;
  const db = {
    collection() { const q = { where(){return q;}, orderBy(){return q;}, count(){return {get:async()=>({data:()=>({count:users.length})})};} }; return q; },
    doc(path) { return {path, async get(){ return {data:()=>({count:4})}; }}; },
    async getAll(...refs) { docReads += refs.length; return refs.map(ref => ({exists:true, data:()=>({isPaid: Number(ref.path.match(/u(\d+)/)[1]) % 10 === 0, paidExpiresAt:'2099-01-01T00:00:00Z',trialStartedAt:'2026-11-01T00:00:00Z'})})); },
  };
  const readPage = async (_actor, params) => {const start = params.cursor ? users.findIndex(u=>u.uid===params.cursor)+1 : 0; const page = users.slice(start,start+25); return {users:page,nextCursor:start+page.length<users.length?page.at(-1).uid:null};};
  return {users, deps:{db,readPage,readSettings:async()=>({proDays:15,basicDays:75})}, reads:()=>docReads};
}

test('count all uses aggregation rather than loading user details', async () => {
  const x=setup(); const result=await countFilteredUsers(actor,{filter:'all'},x.deps);
  assert.equal(result.count,330); assert.equal(result.nextCursor,null); assert.equal(x.reads(),0);
});

test('counts a sparse status through all pages beyond 200', async () => {
  const x=setup(); let cursor=null, total=0;
  do {const page=await countFilteredUsers(actor,{filter:'disabled',cursor},x.deps); total+=page.count; cursor=page.nextCursor;} while(cursor);
  assert.equal(total,x.users.filter(u=>u.disabled).length); assert.equal(x.reads(),0);
});

test('paid status consults only subscription summaries', async () => {
  const x=setup(); let cursor=null,total=0;
  do {const page=await countFilteredUsers(actor,{filter:'paid',cursor},x.deps); total+=page.count;cursor=page.nextCursor;} while(cursor);
  assert.equal(total,33); assert.equal(x.reads(),330);
});

test('non-admin cannot request a count', async () => {
  const x=setup(); await assert.rejects(countFilteredUsers({uid:'other',email:'other@example.com'},{},x.deps),e=>e.code==='admin_only');
});

test('trial plan filters distinguish Basic and Pro', async () => {
  const x=setup();
  x.deps.db.getAll = async (...refs) => refs.map(ref => ({exists:true, data:()=>({isPaid:false, trialStartedAt:new Date(Date.now() - (Number(ref.path.match(/u(\d+)/)[1]) % 2 === 0 ? 5 : 30) * 86400000).toISOString()})}));
  for (const [filter,expected] of [['trial_pro',165],['trial_basic',165]]) {
    let cursor=null,total=0;
    do {const page=await countFilteredUsers(actor,{filter,cursor},x.deps);total+=page.count;cursor=page.nextCursor;} while(cursor);
    assert.equal(total,expected);
  }
});

test('unfiltered custom-period count uses Cairo bounds in an aggregation', async () => {
  const x=setup(); const conditions=[];
  x.deps.db.collection = () => { const q={where(field,op,value){conditions.push([field,op,value]);return q;},orderBy(){return q;},count(){return {get:async()=>({data:()=>({count:330})})};}}; return q; };
  const result=await countFilteredUsers(actor,{filter:'all',period:'custom',from:'2026-11-01',to:'2026-11-10'},x.deps);
  assert.equal(result.count,330);
  assert.deepEqual(conditions,[['createdAtSort','>=','2026-10-31T22:00:00.000Z'],['createdAtSort','<','2026-11-10T22:00:00.000Z']]);
  assert.equal(x.reads(),0);
});
