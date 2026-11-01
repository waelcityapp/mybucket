/**
 * Shared recognition of explicit "N days ago" phrases.
 * Works for any reasonable numeric N, plus spoken Arabic/English compound
 * numbers (not just a hand-picked 1-10 list). Only consume phrases with an
 * unambiguous duration unit. Leave ambiguous words unchanged.
 */
export interface RelativeDayPhrase {
  days: number;
  start: number;
  end: number;
}
const units: Record<string, number> = {
  واحد:1, واحده:1, واحدة:1, وحده:1,
  اتنين:2, اثنين:2, اثنان:2, اثنتين:2,
  تلت:3, تلات:3, تلاته:3, تلاتة:3, ثلثت:3, ثلاث:3, ثلاثه:3, ثلاثة:3,
  اربع:4, اربعه:4, اربعة:4,
  خمس:5, خمسه:5, خمسة:5,
  ست:6, سته:6, ستة:6,
  سبع:7, سبعه:7, سبعة:7,
  تمان:8, تمانيه:8, تمانية:8, ثمان:8, ثمانيه:8, ثمانية:8,
  تسع:9, تسعه:9, تسعة:9,
  عشر:10, عشرة:10, عشره:10,
  حداشر:11, حداشره:11, احداشر:11, احدعشر:11, احدعشره:11,
  اتناشر:12, اتناشره:12, اثناشر:12, اثناعشر:12,
  تلتاشر:13, تلاتاشر:13, ثلاثتاشر:13,
  اربعتاشر:14, اربعتشر:14, خمستاشر:15, خمستشر:15,
  ستاشر:16, ستتاشر:16, سبعتاشر:17, تمنتاشر:18, تمانتاشر:18, تسعتاشر:19,
};
const tens: Record<string, number> = {
  عشرين:20, تلاتين:30, ثلاثين:30, اربعين:40,
  خمسين:50, ستين:60, سبعين:70, تمانين:80, ثمانين:80, تسعين:90,
};
const hundreds: Record<string, number> = { مية:100, ميه:100, مائه:100, مئة:100, ميتين:200, مئتين:200 };
const englishUnits: Record<string,number> = {
  one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,
  eleven:11,twelve:12,thirteen:13,fourteen:14,fifteen:15,sixteen:16,
  seventeen:17,eighteen:18,nineteen:19
};
const englishTens: Record<string,number> = {twenty:20,thirty:30,forty:40,fifty:50,sixty:60,seventy:70,eighty:80,ninety:90};

function normalizeArabic(s:string):string {
  return s.toLowerCase().replace(/[أإآٱ]/g,'ا')
    .replace(/[٠-٩]/g, c => String('٠١٢٣٤٥٦٧٨٩'.indexOf(c)))
    .replace(/[۰-۹]/g, c => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(c)))
    .replace(/[\u064B-\u065Fـ]/g,'');
}
function parseCount(raw:string, english:boolean):number|null {
  const normalized = normalizeArabic(raw).trim().replace(/-/g,' ');
  if (/^\d+$/.test(normalized)) return Number(normalized);
  const words=normalized.split(/\s+/).filter(Boolean);
  if (!words.length || words.length > 8) return null;
  let subtotal=0, total=0;
  for (let word of words) {
    if (word === 'و' || word === 'and') continue;
    if (english) {
      if (word.startsWith('and') && word.length>3) word=word.slice(3);
      const n=englishUnits[word] ?? englishTens[word];
      if (n) {subtotal+=n;continue;}
      if(word==='hundred') {subtotal=(subtotal||1)*100;continue;}
      if(word==='thousand') {total+=(subtotal||1)*1000;subtotal=0;continue;}
      return null;
    }
    // Keep "واحد" intact; separate conjunction "و" from "وعشرين".
    if (!(word in units) && !(word in tens) && !(word in hundreds) && word.startsWith('و')) word=word.slice(1);
    const n=units[word] ?? tens[word];
    if(n) {subtotal+=n;continue;}
    const hundred=hundreds[word];
    if(hundred) {subtotal=(subtotal||1)*hundred;continue;}
    if(word==='الف' || word==='الاف') {total+=(subtotal||1)*1000;subtotal=0;continue;}
    return null;
  }
  const result=total+subtotal;
  return Number.isInteger(result)&&result>0&&result<=36500?result:null;
}

const arabicDuration=/(?:^|[\s،,])(?:من|قبل|منذ)\s+([\p{L}\p{N}]+(?:\s+[\p{L}\p{N}]+){0,7})\s+(?:أيام|ايام|يوم)(?=$|[\s،,.:؛!?؟])/giu;
const englishCountWords = [
  ...Object.keys(englishUnits), ...Object.keys(englishTens), 'hundred', 'thousand', 'and',
].sort((a,b) => b.length-a.length).join('|');
const englishDuration = new RegExp(
  '\\b((?:\\d+|' + englishCountWords + ')(?:[-\\s]+(?:' + englishCountWords + ')){0,7})\\s+days?\\s+ago\\b',
  'gi'
);

export function findRelativeDayPhrase(text:string):RelativeDayPhrase|null {
  const possible:RelativeDayPhrase[]=[];
  for(const m of text.matchAll(arabicDuration)) {
    const n=parseCount(m[1],false);
    if(n) possible.push({days:n,start:m.index,end:m.index+m[0].length});
  }
  for(const m of text.matchAll(englishDuration)) {
    const n=parseCount(m[1],true);
    if(n) possible.push({days:n,start:m.index,end:m.index+m[0].length});
  }
  return possible.sort((a,b)=>a.start-b.start)[0]??null;
}
export function removeRelativeDayPhrase(text:string):string {
  const match=findRelativeDayPhrase(text);
  if(!match)return text;
  return text.slice(0,match.start)+' '+text.slice(match.end);
}
