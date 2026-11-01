import assert from 'node:assert/strict';
import {findRelativeDayPhrase} from '../src/utils/relativeDayPhrase.ts';
import {parseNaturalLanguageInput} from '../src/utils/naturalLanguageParser.ts';
import {extractTransactionDescription} from '../src/utils/transactionDescription.ts';
const OriginalDate=globalThis.Date;
const reference = new OriginalDate(2026,10,1,11,30,0);
class FixedDate extends OriginalDate {
  constructor(...args) { if(args.length===0)super(reference.valueOf());else super(...args); }
  static now(){return reference.valueOf();}
}
globalThis.Date=FixedDate;
try {
  const dayNumbers=[...Array.from({length:365},(_,i)=>i+1), 500, 999, 1000, 1234, 3650, 5000];
  for (const number of dayNumbers) {
    const input='صرفت 200 جنيه من '+number+' يوم هدية لأخويا';
    const actual=parseNaturalLanguageInput(input,[],[]);
    const expected=new OriginalDate(2026,10,1,11,30,0);
    expected.setDate(expected.getDate()-number);
    const iso=[expected.getFullYear(),String(expected.getMonth()+1).padStart(2,'0'),String(expected.getDate()).padStart(2,'0')].join('-');
    assert.equal(actual.date,iso,input);
    assert.equal(actual.amount,200,input);
    assert.equal(actual.description,'هدية لأخويا',input);
  }
  const wordCases=[
    ['أربع',4],['أربعة',4],['اربعه',4],['تلت',3],['تلاتة',3],['اثنين',2],
    ['خمسة وعشرين',25],['مية وخمسة وعشرين',125],['مئة وعشرين',120],
    ['تلاتين',30],['تلاته وتلاتين',33],['اتنين و عشرين',22],['الف',1000],
    ['thirty five',35],['twenty-five',25],['one hundred twenty five',125],
    ['fifty',50],['three',3]
  ];
  for(const [words,days] of wordCases) {
    const english=/[a-z]/i.test(words);
    const text=english?'I spent 200 EGP '+words+' days ago for a gift':'صرفت 200 جنيه من '+words+' يوم هدية لأخويا';
    const duration=findRelativeDayPhrase(text);
    assert.equal(duration?.days,days,words);
    const draft=parseNaturalLanguageInput(text,[],[]);
    const expected=new OriginalDate(reference);
    expected.setDate(expected.getDate()-days);
    assert.equal(draft.date,[expected.getFullYear(),String(expected.getMonth()+1).padStart(2,'0'),String(expected.getDate()).padStart(2,'0')].join('-'),text);
    assert.equal(draft.amount,200,text);
    assert.equal(draft.description,english?'for a gift':'هدية لأخويا',text);
  }
  assert.equal(findRelativeDayPhrase('صرفت 200 على أربع هدايا'),null);
  assert.equal(findRelativeDayPhrase('اشتريت 3 تذاكر قبل الرحلة'),null);
  assert.equal(extractTransactionDescription('صرفت 200 جنيه من أربع أيام أنا جبت هدية لأخويا',200),'هدية لأخويا');
  assert.equal(extractTransactionDescription('صرفت 200 جنيه على أربع هدايا',200),'أربع هدايا');
  console.log('Regression passed: '+dayNumbers.length+' numeric day counts, '+wordCases.length+' compound/spoken day counts, negative date guards');
} finally {
  globalThis.Date=OriginalDate;
}
