import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { FinancialQueryResultCard } from '../src/components/FinancialQueryResultCard.tsx';
import { executeDeterministicQuery } from '../src/services/ai/deterministicQueryEngine.ts';
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
test('spoken account expenses only include transactions paid through the named account',()=>{
 const insta={id:'insta',name:'InstaPay',nameAr:'إنستاباي',type:'wallet',currency:'EGP'};
 const bank={id:'bank',name:'Bank',nameAr:'البنك',type:'bank',currency:'EGP'};
 const raw='قل لي الحاجات اللي انا صرفتها بالانستا بي';
 const testAccounts=[...accounts,insta,bank];
 const r=interpret(request(raw,{accounts:testAccounts}));
 assert.equal(r.intent,'FINANCIAL_QUERY');
 assert.equal(r.query?.accountId,'insta');
 assert.equal(r.transaction,null);
 const base={type:'expense',amount:40,currency:'EGP',categoryId:'food1',date:'2026-11-01'};
 const result=executeDeterministicQuery(r.query,raw,[
  {...base,id:'paid',accountId:'insta',balanceAccountId:'bank'},
  {...base,id:'cash',accountId:'cash1',amount:80},
  {...base,id:'bank',accountId:'bank',amount:100},
  {...base,id:'income',accountId:'insta',type:'income',amount:500},
 ],testAccounts,categories,'ar');
 assert.equal(result.amount,40);
 assert.equal(result.transactionCount,1);
 assert.deepEqual(result.breakdown[0].transactions.map(t=>t.id),['paid']);
 assert.match(result.details,/إنستاباي/);
 assert.equal(interpret(request(raw)).intent,'UNKNOWN');
 assert.equal(interpret(request(raw,{accounts:[...testAccounts,{...insta,id:'insta2'}]})).intent,'UNKNOWN');
});
test('five expenses across three categories render as five individual transactions', () => {
 const raw = 'صرفت كام الشهر ده؟';
 const query = interpret(request(raw)).query;
 const expenses = Array.from({ length: 5 }, (_, index) => ({
  ...proposal, id: `expense-${index}`, description: `Purchase ${index + 1}`,
  categoryId: ['food1', 'transport', 'misc'][index % 3],
 }));
 const result = executeDeterministicQuery(query, raw, expenses, accounts, categories, 'ar');
 assert.equal(result.transactionCount, 5);
 assert.equal(result.breakdown.length, 3);
 const render = (value) => renderToStaticMarkup(createElement(FinancialQueryResultCard, {
  result: value, accounts, lang: 'ar', onClose() {},
 }));
 const markup = render(result);
 assert.equal((markup.match(/<li\b/g) || []).length, 5);
 for (const expense of expenses) assert.ok(markup.includes(expense.description));

 const sixth = { ...expenses[0], id: 'expense-5', description: 'An older purchase', time: '01:00' };
 const longer = executeDeterministicQuery(query, raw, [...expenses, sixth], accounts, categories, 'ar');
 assert.equal(longer.matchingTransactions.length, 6);
 assert.match(render(longer), /عرض باقي العمليات/);
 assert.doesNotMatch(render(longer), /An older purchase/);
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
