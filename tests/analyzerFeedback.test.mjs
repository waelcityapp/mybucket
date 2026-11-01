import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isFeedbackActive, normalizeSettings } from '../server/analyzerFeedback.ts';

const cases=[];
function test(name,fn){cases.push({name,fn});}
const when=(x)=>new Date(x);
test('settings are off until explicitly enabled by admin',()=>{
 const c=normalizeSettings({});
 assert.equal(c.enabled,false);
 assert.equal(c.startDate,'');
 assert.equal(isFeedbackActive(c,when('2026-11-01T10:00:00Z')),false);
});
test('start date cannot activate before campaign begins',()=>{
 const c=normalizeSettings({enabled:true,startDate:'2026-11-03',durationDays:14,frequency:1});
 assert.equal(isFeedbackActive(c,when('2026-11-01T23:00:00Z')),false);
});
test('Cairo date controls exact start at local midnight',()=>{
 const c=normalizeSettings({enabled:true,startDate:'2026-11-01',durationDays:14,frequency:1});
 assert.equal(isFeedbackActive(c,when('2026-10-31T21:59:59Z')),false);
 assert.equal(isFeedbackActive(c,when('2026-10-31T22:00:00Z')),true);
});
test('14 day period includes day 14 and stops on day 15',()=>{
 const c=normalizeSettings({enabled:true,startDate:'2026-11-01',durationDays:14,frequency:1});
 assert.equal(isFeedbackActive(c,when('2026-11-14T21:59:59Z')),true);
 assert.equal(isFeedbackActive(c,when('2026-11-14T22:00:00Z')),false);
});
test('manual indefinite duration has no automatic end',()=>{
 const c=normalizeSettings({enabled:true,startDate:'2026-11-01',durationDays:0,frequency:3});
 assert.equal(isFeedbackActive(c,when('2031-11-01T12:00:00Z')),true);
 assert.equal(isFeedbackActive({...c,enabled:false},when('2031-11-01T12:00:00Z')),false);
});
test('custom durations 1 to 365 remain selectable',()=>{
 for(const days of [1,2,7,14,30,45,90,365]){
  const c=normalizeSettings({enabled:true,startDate:'2026-11-01',durationDays:days,frequency:5});
  assert.equal(c.durationDays,days);
 }
});
test('invalid dates and durations normalize to safe fallback',()=>{
 for(const date of ['2026-11-31','2026-02-29','not-a-date','2026-11-1']){
  assert.equal(normalizeSettings({enabled:true,startDate:date,durationDays:14,frequency:1}).startDate,'');
 }
 for(const days of [-1,1.5,999,'30']){
  assert.equal(normalizeSettings({durationDays:days}).durationDays,14);
 }
});
test('frequency normalized to safe 1, 3, 5 only',()=>{
 for(const num of [1,3,5])assert.equal(normalizeSettings({frequency:num}).frequency,num);
 assert.equal(normalizeSettings({frequency:8}).frequency,1);
});
test('feedback service uses a runtime-compatible Firebase Admin ES module import',()=>{
 const s=readFileSync('server/analyzerFeedback.ts','utf8');
 assert.match(s,/from ['"]\.\/firebaseAdmin\.js['"]/);
 assert.doesNotMatch(s,/from ['"]\.\/firebaseAdmin['"]/);
});
test('rating endpoints only available from authenticated gateway',()=>{
 for(const file of ['server.ts','api/gateway.ts']){
  const s=readFileSync(file,'utf8');
  assert.ok(s.indexOf('verifyAuthenticatedUser(')<s.indexOf("case 'feedback.submit'"),file);
  assert.ok(s.includes("case 'feedback.config'"),file);
  assert.ok(s.includes("case 'admin.feedbackReports'"),file);
  assert.ok(s.includes("case 'admin.feedbackSettings'"),file);
  assert.ok(s.includes("case 'admin.feedbackUpdateStatus'"),file);
  assert.ok(s.includes("user.email?.trim().toLowerCase() !== 'waelvts@gmail.com'"),file);
 }
});
test('detailed rating requires explicit consent',()=>{
 const s=readFileSync('server/analyzerFeedback.ts','utf8');
 assert.ok(s.includes("payload?.consent !== true"));
 assert.ok(s.includes("feedback_details_and_consent_required"));
});
test('reports never store user ID nor financial account/balance arrays',()=>{
 const s=readFileSync('server/analyzerFeedback.ts','utf8');
 const report=s.slice(s.indexOf('  const report = {'),s.indexOf('  const db=getAdminFirestore()'));
 assert.ok(!/uid|accountId|accounts|balance|transactions/i.test(report));
});
test('ratings do not trigger an automatic save',()=>{
 const s=readFileSync('src/components/AnalyzerFeedbackCard.tsx','utf8');
 assert.ok(!s.includes('onSaveTransaction'));
 assert.ok(s.includes("if(!enabled) return adminStatus==='none' ? null :"));
});
test('feedback fields cannot block native save form validation',()=>{
 const s=readFileSync('src/components/AnalyzerFeedbackCard.tsx','utf8');
 assert.ok(!/\<textarea[^>]*required/.test(s));
 assert.ok(!/\<input[^>]*required/.test(s));
 assert.ok(s.includes('type="button"'));
});
test('raw speech transcript is passed separately from parsed text',()=>{
 const s=readFileSync('src/components/VoiceNaturalInput.tsx','utf8');
 assert.ok(s.includes("originalText:inputSource==='voice' ? (originalTranscript.trim() || text) : text"));
 assert.ok(s.includes("void processInputWithAI(text, 'voice', segmentBaseRef.current)"));
});
test('new Firestore collections remain inaccessible from client rules',()=>{
 const rules=readFileSync('firestore.rules','utf8');
 assert.ok(rules.includes('allow read, write: if false;'));
 assert.ok(!rules.includes('match /analyzerFeedback/{'));
});
for(const c of cases){try{c.fn();console.log('PASS',c.name)}catch(e){console.error('FAIL',c.name);throw e;}}
console.log('PASS '+cases.length+' feedback scenarios');
