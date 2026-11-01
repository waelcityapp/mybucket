import assert from 'node:assert/strict';
import { parseNaturalDateTime } from '../src/utils/dateTime.ts';
import { parseNaturalLanguageInput } from '../src/utils/naturalLanguageParser.ts';
import { hasTodayDateExpression, removeTodayDateExpression } from '../src/utils/todayDateExpression.ts';
import { interpretLocalFinancialRequest } from '../src/services/ai/localFinancialInterpreter.ts';

const today = new Date(2026, 9, 31, 15, 40, 0);
const expected = '2026-10-31';
const accounts = [{id:'cash',type:'cash',name:'Cash',nameAr:'كاش',currency:'EGP'}];
const categories = [];
const request = (text, currentProposal) => ({text,accounts,categories,lang:'ar',userTimezone:'Africa/Cairo',
  currentDateTime:'2026-10-31T15:40:00.000Z', ...(currentProposal ? {currentProposal} : {})});

for(const variant of ['النهاردة','النهارده','النهاردا','النهرده','اليوم','today']) {
  assert.equal(hasTodayDateExpression('صرفت 100 جنيه '+variant+' صيانة السيارة'),true,variant);
  assert.equal(removeTodayDateExpression('صيانة '+variant+' العربية').trim(),'صيانة  العربية',variant);
  assert.equal(parseNaturalDateTime('صرفت 100 جنيه '+variant+' صيانة السيارة',today).date,expected,variant);
  const parsed = parseNaturalLanguageInput('صرفت 100 جنيه '+variant+' صيانة السيارة',accounts,categories,today);
  assert.equal(parsed.amount,100,variant);
  assert.equal(parsed.description,'صيانة السيارة',variant);
}
for(const notADate of ['النهاردةيات','اليوميات','todaycare','ماالنهارده','النهاردهية']){
  assert.equal(hasTodayDateExpression(notADate),false,notADate);
  assert.equal(removeTodayDateExpression(notADate),notADate,notADate);
}
for(const variant of ['النهارده','النهاردة','النهاردا','اليوم']){
  const tx=interpretLocalFinancialRequest(request('صرفت 100 جنيه '+variant+' صيانة السيارة'));
  assert.equal(tx.intent,'CREATE_TRANSACTION',variant);
  assert.equal(tx.transaction?.date,expected,variant);
  assert.equal(tx.transaction?.description,'صيانة السيارة',variant);
  const qry=interpretLocalFinancialRequest(request('صرفت كام '+variant+'؟'));
  assert.equal(qry.intent,'FINANCIAL_QUERY',variant);
  assert.equal(qry.query?.period,'today',variant);
  const proposal={type:'expense',amount:100,currency:'EGP',accountId:'cash',date:'2026-10-25',time:'12:00',description:'صيانة السيارة'};
  const fix=interpretLocalFinancialRequest(request('غير التاريخ '+variant,proposal));
  assert.equal(fix.intent,'CORRECT_PROPOSAL',variant);
  assert.equal(fix.transaction?.date,expected,variant);
}
console.log('PASS Egyptian today spellings are dates, not notes, for transactions, queries and corrections');
