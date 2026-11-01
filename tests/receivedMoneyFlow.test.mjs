import assert from 'node:assert/strict';
import { interpretLocalFinancialRequest as interpret } from '../src/services/ai/localFinancialInterpreter.ts';
import { parseNaturalLanguageInput } from '../src/utils/naturalLanguageParser.ts';
import { classifyLocalIntent } from '../src/services/ai/localIntentRouter.ts';

const accounts = [
  {id:'cash1',name:'Cash',nameAr:'كاش',type:'cash',currency:'EGP'},
  {id:'bank1',name:'Bank',nameAr:'حساب بنكي',type:'bank',currency:'EGP'},
];
const categories = [
  {id:'salary1',name:'Salary',nameAr:'راتب',type:'income'},
  {id:'food1',name:'Food',nameAr:'طعام ومشروبات',type:'expense'},
];
const ref=new Date(2026,10,1,4,45);
const request=(text)=>({text,accounts,categories,currentDateTime:'2026-11-01T04:45:00.000Z',userTimezone:'Africa/Cairo',lang:'ar'});

const received = [
  ['النهارده اخدت 200 جنيه من بيبو كان واخدهم مني',200,'من بيبو كان واخدهم مني'],
  ['النهاردة أخدت 200 جنيه من بيبو كان واخدهم مني',200,'من بيبو كان واخدهم مني'],
  ['خدت 200 جنيه من بيبو',200,'من بيبو'],
  ['أنا اخدت من بيبو 200 جنيه',200,'من بيبو'],
  ['أخدت من أحمد ٢٠٠ جنيه كان مستلفهم مني',200,'من أحمد كان مستلفهم مني'],
  ['استرديت 200 جنيه من بيبو',200,'من بيبو'],
  ['بيبو رجعلي 200 جنيه',200,'بيبو'],
];
for(const [raw,amount,note] of received.slice(0,7)){
  const intent=classifyLocalIntent(raw);
  assert.equal(intent,'CREATE_TRANSACTION',raw);
  const parsed=parseNaturalLanguageInput(raw,accounts,categories,ref);
  assert.equal(parsed.type,'income',raw);
  assert.equal(parsed.amount,amount,raw);
  assert.equal(parsed.description,note,raw);
  const result=interpret(request(raw));
  assert.equal(result.intent,'CREATE_TRANSACTION',raw);
  assert.equal(result.transaction?.type,'income',raw);
  assert.equal(result.transaction?.amount,amount,raw);
  assert.equal(result.transaction?.description,note,raw);
  assert.equal(result.transaction?.accountId,null,raw);
  assert.equal(result.transaction?.categoryId,null,raw);
  assert.ok(result.transaction?.missingFields.includes('accountId'),raw);
  assert.ok(result.transaction?.missingFields.includes('categoryId'),raw);
  assert.equal(result.transaction?.date,'2026-11-01',raw);
}
for(const raw of [
  'اخدت تاكسي 100 جنيه',
  'خدت دواء 50 جنيه',
  'اخدت شنطة ب200 جنيه',
  'اخدت 200 جنيه تذكرة سينما',
  'أنا اخدت كتاب بـ 200 جنيه من بيبو',
]){
  const result=interpret(request(raw));
  assert.notEqual(result.transaction?.type,'income',raw);
}
for(const raw of ['ماخدتش 200 جنيه من بيبو','رجعت لبيبو 200 جنيه']){
  assert.notEqual(parseNaturalLanguageInput(raw,accounts,categories,ref).type,'income',raw);
}
console.log('PASS received debt repayment vs buying goods contrast');
