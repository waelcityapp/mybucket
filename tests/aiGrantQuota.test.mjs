import test from 'node:test';
import assert from 'node:assert/strict';
import { reserveAiQuota, DEFAULT_AI_DAILY_LIMITS } from '../server/aiQuota.ts';
import { Timestamp } from 'firebase-admin/firestore';

function harness() {
  let data={}, chain=Promise.resolve();
  let sub={trialStartedAt:'2025-01-01T00:00:00.000Z',isPaid:false,grant:{plan:'pro',startsAt:'2026-11-01T00:00:00.000Z',endsAt:'2027-11-01T00:00:00.000Z'}};
  const db={doc:path=>({path}),runTransaction(fn){const call=chain.then(async()=>fn({get:async ref=>({exists:true,data:()=>ref.path.endsWith('/billing/access') ? (sub.grant ? {grantPlan:sub.grant.plan,grantStartsAt:Timestamp.fromDate(new Date(sub.grant.startsAt)),grantUntil:Timestamp.fromDate(new Date(sub.grant.endsAt))} : {}) : ref.path.endsWith('/billing/subscription') ? sub : ({...data})}),set(_ref,fields){for(const [key,value] of Object.entries(fields)) if(value?.constructor?.name==='NumericIncrementTransform')data[key]=(data[key]||0)+value.operand;}}));chain=call.catch(()=>{});return call;}};
  const deps={db,getSubscription:async()=>sub,getTrials:async()=>({proDays:15,basicDays:75}),getLimits:async()=>({...DEFAULT_AI_DAILY_LIMITS}),now:()=>Date.parse('2026-11-09T10:00:00.000Z')};
  return {deps,setSub:value=>{sub=value;},getData:()=>({...data})};
}

test('parallel Pro grant requests cannot exceed the daily Gemini entry limit', async () => {
  const h=harness();const results=await Promise.allSettled(Array.from({length:25},()=>reserveAiQuota('user1','دفعت 100',false,h.deps)));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,15);
  assert.equal(results.filter(r=>r.status==='rejected'&&r.reason.code==='ai_daily_limit_reached').length,10);
  assert.equal(h.getData().proGeminiEntries,15);
});

test('Basic grant cannot access Gemini, local buckets stay independent', async () => {
  const h=harness(); const basic={trialStartedAt:'2025-01-01T00:00:00.000Z',isPaid:false,grant:{plan:'basic',startsAt:'2026-11-01T00:00:00.000Z',endsAt:'2027-11-01T00:00:00.000Z'}};
  h.setSub(basic);await assert.rejects(reserveAiQuota('user1','دفعت 100',false,h.deps),e=>e.code==='pro_plan_required');
  for(let i=0;i<10;i++) await reserveAiQuota('user1','دفعت 100',true,h.deps);
  await assert.rejects(reserveAiQuota('user1','دفعت 100',true,h.deps),e=>e.code==='ai_daily_limit_reached');
  h.setSub({...basic,grant:{...basic.grant,plan:'pro'}});await reserveAiQuota('user1','دفعت 100',true,h.deps);
  assert.equal(h.getData().basicLocalEntries,10);assert.equal(h.getData().proLocalEntries,1);
  h.setSub(basic);await assert.rejects(reserveAiQuota('user1','دفعت 100',true,h.deps),e=>e.code==='ai_daily_limit_reached');
});

test('an expired grant cannot reserve a quota or call Gemini', async () => {
  const h=harness();h.setSub({trialStartedAt:'2025-01-01T00:00:00.000Z',isPaid:false,grant:{plan:'pro',startsAt:'2026-01-01T00:00:00.000Z',endsAt:'2026-11-01T00:00:00.000Z'}});
  await assert.rejects(reserveAiQuota('user1','دفعت 100',false,h.deps),e=>e.code==='subscription_expired');
  assert.deepEqual(h.getData(),{});
});

test('Pro inquiries stop at five and fallback local has its own counter', async () => {
  const h=harness();
  for(let i=0;i<5;i++) assert.equal((await reserveAiQuota('user1','كام صرفت النهاردة؟',false,h.deps)).operation,'inquiry');
  await assert.rejects(reserveAiQuota('user1','كام صرفت النهاردة؟',false,h.deps),e=>e.code==='ai_daily_limit_reached');
  const fallback=await reserveAiQuota('user1','كام صرفت النهاردة؟',true,h.deps);
  assert.equal(fallback.engine,'local');assert.equal(fallback.operation,'inquiry');
  assert.equal(h.getData().proGeminiInquiries,5);assert.equal(h.getData().proLocalInquiries,1);
});

test('administrator limits reject negative, fractional, or unbounded values', async () => {
  const { validateAiDailyLimits } = await import('../server/aiQuota.ts');
  assert.equal(validateAiDailyLimits({...DEFAULT_AI_DAILY_LIMITS,proGeminiEntries:22}).proGeminiEntries,22);
  for (const value of [-1,1.5,10001]) assert.throws(()=>validateAiDailyLimits({...DEFAULT_AI_DAILY_LIMITS,proGeminiEntries:value}),e=>e.code==='invalid_ai_daily_limits');
});

test('a grant revoked before the reservation transaction cannot authorize Gemini', async () => {
  const h=harness();
  const stale={trialStartedAt:'2025-01-01T00:00:00.000Z',isPaid:false,grant:{plan:'pro',startsAt:'2026-11-01T00:00:00.000Z',endsAt:'2027-11-01T00:00:00.000Z'}};
  h.deps.getSubscription=async()=>stale;
  h.setSub({...stale,grant:null});
  await assert.rejects(reserveAiQuota('user1','دفعت 100',false,h.deps),e=>e.code==='subscription_expired');
  assert.deepEqual(h.getData(),{});
});
