import test from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import { getFreeGrant, setFreeGrant, endFreeGrant } from '../server/grantService.ts';

function fakeDeps(initial={}) {
  const docs = new Map(Object.entries(initial)); let audit=0;
  const db = {
    doc: path => ({ path, async get(){const value=docs.get(path); return {exists:value!==undefined,data:()=>value};} }),
    collection: name => ({ doc: () => ({ path:`${name}/audit${++audit}` }) }),
    async runTransaction(fn) {
      const writes=[];
      const tx={
        async get(ref) { const value=docs.get(ref.path);return {exists:value!==undefined,data:()=>value}; },
        update(ref,value){writes.push(['update',ref.path,value]);}, set(ref,value){writes.push(['set',ref.path,value]);}, create(ref,value){writes.push(['create',ref.path,value]);},
      };
      const result = await fn(tx);
      for (const [kind,path,value] of writes) {
        const next={...(kind==='create'?{}:docs.get(path)||{})};
        for (const [key,item] of Object.entries(value)) if (item?.constructor?.name === 'DeleteTransform') delete next[key]; else next[key]=item;
        docs.set(path,next);
      }
      return result;
    },
  };
  const auth={async getUser(uid){if(uid==='missing')throw new Error('not found');return {uid};}};
  return {deps:{db,auth},docs};
}
const owner={uid:'owner',email:'waelvts@gmail.com'}, now=Date.parse('2026-11-09T12:00:00Z');

test('grant and revocation never change paid expiry, account registration or financial documents', async () => {
  const paid=Timestamp.fromDate(new Date('2027-12-01T00:00:00Z')), registered=Timestamp.fromDate(new Date('2026-01-01T00:00:00Z'));
  const {deps,docs}=fakeDeps({'users/user1/billing/access':{registeredAt:registered,paidUntil:paid,schemaVersion:1},'users/user1/accounts/cash':{balance:123}});
  await setFreeGrant(owner,{uid:'user1',plan:'pro',endsAt:'2027-02-09T12:00:00Z',reason:'فريق'},deps,()=>now);
  assert.equal(docs.get('users/user1/billing/access').grantPlan,'pro');
  assert.equal(docs.get('users/user1/billing/access').paidUntil,paid);
  assert.equal(docs.get('users/user1/billing/access').registeredAt,registered);
  assert.deepEqual(docs.get('users/user1/accounts/cash'),{balance:123});
  await endFreeGrant(owner,{uid:'user1'},deps,()=>now+1000);
  assert.equal(docs.get('users/user1/billing/access').grantPlan,undefined);
  assert.equal(docs.get('users/user1/billing/access').paidUntil,paid);
  assert.equal(docs.get('adminGrants/user1').active,false);
  assert.equal([...docs.keys()].filter(k=>k.startsWith('adminGrantAudit/')).length,2);
});

test('unauthorized or invalid grants make no changes', async () => {
  const {deps,docs}=fakeDeps();
  await assert.rejects(setFreeGrant({uid:'x',email:'other@example.com'},{uid:'user1',plan:'pro',endsAt:'2027-01-01'},deps,()=>now),e=>e.code==='admin_only');
  await assert.rejects(setFreeGrant(owner,{uid:'user1',plan:'bogus',endsAt:'2027-01-01'},deps,()=>now),e=>e.code==='invalid_grant_plan');
  await assert.rejects(setFreeGrant(owner,{uid:'user1',plan:'basic',endsAt:'2026-01-01'},deps,()=>now),e=>e.code==='invalid_grant_expiry');
  await assert.rejects(setFreeGrant(owner,{uid:'user1',plan:'basic',endsAt:'2027-01-01'},deps,()=>now),e=>e.code==='access_record_missing');
  assert.equal(docs.size,0);
});

test('extending the same active grant preserves its original start', async () => {
  const {deps,docs}=fakeDeps({'users/user1/billing/access':{registeredAt:Timestamp.fromMillis(now-100000),paidUntil:null,schemaVersion:1}});
  const first=await setFreeGrant(owner,{uid:'user1',plan:'basic',endsAt:'2027-02-09T12:00:00Z'},deps,()=>now);
  const second=await setFreeGrant(owner,{uid:'user1',plan:'basic',endsAt:'2027-05-09T12:00:00Z'},deps,()=>now+86400000);
  assert.equal(first.startsAt,second.startsAt);
  assert.equal(docs.get('users/user1/billing/access').grantStartsAt.toMillis(),now);
  const changed=await setFreeGrant(owner,{uid:'user1',plan:'pro',endsAt:'2027-05-09T12:00:00Z'},deps,()=>now+2*86400000);
  assert.notEqual(changed.startsAt,first.startsAt);
});

test('only the owner can read private grant details', async () => {
  const {deps,docs}=fakeDeps({'users/user1/billing/access':{registeredAt:Timestamp.fromMillis(now-1000),paidUntil:null,schemaVersion:1}});
  await setFreeGrant(owner,{uid:'user1',plan:'pro',endsAt:'2027-02-09T12:00:00Z',reason:'فريق'},deps,()=>now);
  const result=await getFreeGrant(owner,{uid:'user1'},deps);
  assert.equal(result.grant.reason,'فريق');assert.equal(result.grant.plan,'pro');
  await assert.rejects(getFreeGrant({uid:'x',email:'other@example.com'},{uid:'user1'},deps),e=>e.code==='admin_only');
  assert.equal(docs.get('users/user1/billing/access').reason,undefined);
});

test('grant end date includes the entire last Cairo day', async () => {
  const {deps}=fakeDeps({'users/user1/billing/access':{registeredAt:Timestamp.fromMillis(now-1000),paidUntil:null,schemaVersion:1}});
  const result=await setFreeGrant(owner,{uid:'user1',plan:'pro',endDate:'2027-02-09'},deps,()=>now);
  assert.equal(result.endsAt,'2027-02-09T22:00:00.000Z');
});
