import assert from 'node:assert/strict';
import { classifyLocalIntent } from '../src/services/ai/localIntentRouter.ts';
import { interpretLocalFinancialRequest as interpret } from '../src/services/ai/localFinancialInterpreter.ts';
import { readFileSync } from 'node:fs';
const reference=new Date(2026,10,1,2,20,0);
const OldDate=globalThis.Date;
class FixedDate extends OldDate {
  constructor(...args){if(args.length===0)super(reference.valueOf());else super(...args);}
  static now(){return reference.valueOf();}
}
const accounts=[
{id:'cash1',name:'Cash',nameAr:'الكاش',type:'cash',currency:'EGP'},
{id:'wallet1',name:'E-wallet',nameAr:'محفظة إلكترونية',type:'wallet',currency:'EGP'}];
const categories=[
{id:'food1',name:'Food',nameAr:'طعام ومشروبات',type:'expense'},
{id:'salary1',name:'Salary',nameAr:'راتب',type:'income'}];
const request=(text,more={})=>({text,accounts,categories,currentDateTime:'2026-11-01T02:20:00.000Z',userTimezone:'Africa/Cairo',lang:'ar',...more});
const proposal={type:'expense',amount:200,currency:'EGP',accountId:'cash1',categoryId:'food1',description:'هدية',date:'2026-11-01',time:'02:20'};
const tests=[];
function test(name,action){tests.push({name,action});}
test('unknown is never a transaction',()=>{
 for(const raw of ['اهلا','200 جنيه','يا صباح الفل','Hello there']){
  const r=interpret(request(raw));assert.equal(r.intent,'UNKNOWN',raw);assert.equal(r.transaction,null,raw);
 }
});
test('expense amount, old dates, notes without account guessing',()=>{
 for(const raw of ['صرفت 200 جنيه من أربع أيام أنا جبت هدية لأخويا',
                   'صرفت 200 جنيه من 4 ايام انا جبت هدية لاخويا',
                   'صرفت 200 جنيه من خمسة وعشرين يوم هدية لأخويا']){
  const r=interpret(request(raw));assert.equal(r.intent,'CREATE_TRANSACTION',raw);
  assert.equal(r.transaction?.amount,200,raw);
  assert.equal(r.transaction?.accountId,null,raw);
  assert.ok(r.transaction?.missingFields.includes('accountId'),raw);
  assert.ok(r.transaction?.missingFields.includes('categoryId'),raw);
  assert.ok(r.confidence<0.9,raw);
 }
});
test('missing amount remains missing',()=>{
 const r=interpret(request('صرفت من الكاش عشان هدية لأخويا'));
 assert.equal(r.intent,'CREATE_TRANSACTION');
 assert.equal(r.transaction?.amount,null);
 assert.ok(r.transaction?.missingFields.includes('amount'));
});
test('only explicitly mentioned accounts are chosen',()=>{
 assert.equal(interpret(request('صرفت 200 جنيه من الكاش على أكل')).transaction?.accountId,'cash1');
 assert.equal(interpret(request('صرفت 200 جنيه أكل')).transaction?.accountId,null);
});
test('financial inquiries are never registered',()=>{
 for(const raw of ['صرفت كام الشهر ده؟','كام مصاريفي امبارح','how much did I spend this month?']){
  const r=interpret(request(raw));assert.equal(r.intent,'FINANCIAL_QUERY');assert.equal(r.transaction,null);
 }
});
test('income queries report income',()=>{
 const r=interpret(request('كام دخلي الشهر ده؟'));
 assert.equal(r.query?.metric,'total_income');
 assert.equal(r.query?.transactionType,'income');
});
test('voice save commands do not save',()=>{
 for(const raw of ['احفظ','احفظ العملية','save','تمام احفظ']){
  assert.equal(interpret(request(raw)).intent,'SAVE_REQUEST',raw);
 }
 assert.notEqual(classifyLocalIntent('سجلت 200 جنيه'),'SAVE_REQUEST');
});
test('editing notes never changes amount, account or category',()=>{
 const r=interpret(request('الملاحظات 500 جنيه صرفتهم على بنك',{currentProposal:proposal}));
 assert.equal(r.intent,'CORRECT_PROPOSAL');
 assert.equal(r.transaction?.amount,200);
 assert.equal(r.transaction?.accountId,'cash1');
 assert.equal(r.transaction?.categoryId,'food1');
 assert.equal(r.transaction?.description,'500 جنيه صرفتهم على بنك');
});
test('old date correction is independent from other fields',()=>{
 const r=interpret(request('غير التاريخ من أربع أيام',{currentProposal:proposal}));
 assert.equal(r.transaction?.date,'2026-10-28');
 assert.equal(r.transaction?.amount,200);
 assert.equal(r.transaction?.description,'هدية');
});
test('date correction stable across midnight',()=>{
 for(const clock of ['2026-11-01T00:10:00.000Z','2026-11-01T23:59:00.000Z']){
  const r=interpret(request('غير التاريخ من أربع أيام',{currentDateTime:clock,currentProposal:proposal}));
  assert.equal(r.transaction?.date,'2026-10-28');
 }
});
test('bare date-change request is not guessed',()=>{
 const r=interpret(request('غير التاريخ',{currentProposal:{...proposal,date:'2026-10-15'}}));
 assert.equal(r.transaction?.date,'2026-10-15');
});
test('changing type does not select a replacement category',()=>{
 const r=interpret(request('غير العملية لدخل',{currentProposal:proposal}));
 assert.equal(r.transaction?.type,'income');
 assert.equal(r.transaction?.categoryId,null);
});
test('free client only calls local engine',()=>{
 const file=readFileSync('src/services/ai/aiClient.ts','utf8');
 const tail=file.slice(file.lastIndexOf('export const aiClient:'));
 assert.ok(tail.includes('return interpretLocalFinancialRequest(request)'));
 assert.ok(!tail.includes('geminiClient'));
});
globalThis.Date=FixedDate;
try{
 for(const t of tests){t.action();console.log('PASS '+t.name);}
 console.log('PASS '+tests.length+' financial architecture scenarios');
}finally{globalThis.Date=OldDate;}
