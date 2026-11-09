import test from 'node:test';
import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import { readOwnAiQuota, DEFAULT_AI_DAILY_LIMITS } from '../server/aiQuota.ts';

const now = Date.parse('2026-11-09T10:00:00Z');
function harness(plan='basic', usage={}) {
  const reads=[];
  const docs={
    'users/alice/billing/access': { grantPlan:plan, grantStartsAt:Timestamp.fromMillis(now-1000), grantUntil:Timestamp.fromMillis(now+100000) },
    'users/alice/billing/subscription': {trialStartedAt:'2025-01-01T00:00:00Z',isPaid:false},
    'users/alice/aiUsage/daily_2026-11-09': usage,
  };
  const db={doc(path){reads.push(path);return {async get(){return {exists:docs[path]!==undefined,data:()=>docs[path]};}};}};
  return {reads,deps:{db,now:()=>now,getTrials:async()=>({proDays:15,basicDays:75}),getLimits:async()=>({...DEFAULT_AI_DAILY_LIMITS}),getRegistration:async()=>{throw Error('unexpected registration lookup');}}};
}
test('Basic usage reads only the signed-in user and exposes its local counters',async()=>{
  const h=harness('basic',{basicLocalEntries:3,basicLocalInquiries:1,proGeminiEntries:9});
  const value=await readOwnAiQuota('alice',h.deps);
  assert.equal(value.plan,'basic');assert.deepEqual(value.local.entries,{used:3,limit:10,remaining:7});
  assert.deepEqual(value.local.inquiries,{used:1,limit:2,remaining:1});assert.equal(value.gemini,undefined);
  assert.ok(h.reads.every(path=>path.startsWith('users/alice/')));
});
test('Pro shows independent Gemini and local fallback quotas',async()=>{
  const h=harness('pro',{proGeminiEntries:15,proLocalEntries:2,proGeminiInquiries:1});
  const value=await readOwnAiQuota('alice',h.deps);
  assert.equal(value.plan,'pro');assert.equal(value.gemini.entries.remaining,0);
  assert.equal(value.local.entries.remaining,28);assert.equal(value.gemini.inquiries.remaining,4);
});
test('invalid stored counters never appear as valid usage',async()=>{
  const h=harness('basic',{basicLocalEntries:-1});
  await assert.rejects(readOwnAiQuota('alice',h.deps),e=>e.code==='invalid_quota_counter');
});
test('without a billing document the recorded registration date determines the trial',async()=>{
  const paths=[];
  const db={doc(path){paths.push(path);return {async get(){return {exists:path.endsWith('/billing/access'),data:()=>({})};}};}};
  const value=await readOwnAiQuota('alice',{db,now:()=>now,getTrials:async()=>({proDays:15,basicDays:75}),getLimits:async()=>({...DEFAULT_AI_DAILY_LIMITS}),getRegistration:async()=>new Date(now-86400000).toISOString()});
  assert.equal(value.plan,'pro');assert.equal(value.gemini.entries.remaining,15);assert.equal(paths.length,3);
});
test('expired accounts do not display a usable daily allowance',async()=>{
  const h=harness('basic');h.deps.now=()=>Date.parse('2027-11-09T10:00:00Z');
  const value=await readOwnAiQuota('alice',h.deps);
  assert.equal(value.plan,'expired');assert.equal(value.local,undefined);
});
