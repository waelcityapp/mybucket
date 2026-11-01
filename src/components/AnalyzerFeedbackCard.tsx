import { useEffect, useState } from 'react';
import { CheckCircle2, MessageSquareWarning, ShieldCheck, Send } from 'lucide-react';
import type { Language } from '../types';
import {
  AnalyzerFeedbackContext, FeedbackConfig, FeedbackErrorSource, FeedbackRating, feedbackRequest,
} from '../services/ai/analyzerFeedbackClient';
import { auth } from '../lib/firebase';

type Props={ lang:Language; context:AnalyzerFeedbackContext };
const options:{value:FeedbackRating;labelAr:string;labelEn:string;icon:string}[]=[
  {value:'bad',labelAr:'سيئ',labelEn:'Bad',icon:'😞'},
  {value:'acceptable',labelAr:'مقبول',labelEn:'Acceptable',icon:'😐'},
  {value:'good',labelAr:'جيد',labelEn:'Good',icon:'🙂'},
  {value:'very_good',labelAr:'جيد جدًا',labelEn:'Very good',icon:'😃'},
];
const isLow=(value:FeedbackRating)=>value==='bad'||value==='acceptable';
const seenIds = new Set<string>();

export function AnalyzerFeedbackCard({lang,context}:Props) {
  const isAr=lang==='ar';
  const [enabled,setEnabled]=useState(false);
  const [adminStatus,setAdminStatus]=useState<'none'|'off'|'error'>('none');
  const [rating,setRating]=useState<FeedbackRating|null>(null);
  const [errorSource,setErrorSource]=useState<FeedbackErrorSource>('analysis');
  const [correction,setCorrection]=useState('');
  const [spokenCorrection,setSpokenCorrection]=useState('');
  const [consent,setConsent]=useState(false);
  const [sending,setSending]=useState(false);
  const [sent,setSent]=useState(false);
  const [error,setError]=useState('');

  useEffect(()=>{
    let alive=true;
    setEnabled(false);setAdminStatus('none');setRating(null);setCorrection('');setSpokenCorrection('');setConsent(false);
    setSent(false);setError('');setErrorSource('analysis');
    const apply=async()=>{
      try {
        const config=await feedbackRequest<FeedbackConfig>('feedback.config');
        if(!alive)return;
        if(!config.active) {
          if(auth.currentUser?.email?.trim().toLowerCase()==='waelvts@gmail.com')setAdminStatus('off');
          return;
        }
        if(seenIds.has(context.analysisId))return;
        // Frequency is per device/account and never prevents saving transactions.
        const key='mybucket:feedback-count:'+auth.currentUser?.uid;
        const count=Number.parseInt(localStorage.getItem(key)||'0',10)||0;
        const next=count+1;
        localStorage.setItem(key,String(next));
        seenIds.add(context.analysisId);
        if(next % config.frequency === 0 && alive)setEnabled(true);
      }catch {
        // Non-blocking: but show useful diagnostics to the administrator.
        if(alive&&auth.currentUser?.email?.trim().toLowerCase()==='waelvts@gmail.com')setAdminStatus('error');
      }
    };
    void apply();
    return ()=>{alive=false;};
  },[context.analysisId]);

  const sendRating=async(value:FeedbackRating)=>{
    if(sending||sent)return;
    setRating(value);setError('');
    if(isLow(value))return;
    setSending(true);
    try {
      await feedbackRequest('feedback.submit',{rating:value,appRevision:context.appRevision});
      setSent(true);
    }catch(e) {setError(e instanceof Error && e.message==='feedback_disabled'?(isAr?'انتهت فترة التقييم. يمكنك الحفظ بشكل طبيعي.':'Feedback period has ended.'):(isAr?'تعذر إرسال التقييم، يمكنك المحاولة مرة أخرى.':'Could not send rating. Please retry.'));}
    finally {setSending(false);}
  };
  const sendDetails=async()=>{
    if(!rating||!isLow(rating)||!consent||!correction.trim()||sending)return;
    setSending(true);setError('');
    try {
      await feedbackRequest('feedback.submit',{
        rating,consent:true,
        errorSource:context.inputSource==='text'?'analysis':errorSource,
        inputSource:context.inputSource,
        originalText:context.originalText,
        analyzedText:context.analyzedText,
        correction:correction.trim(),
        spokenCorrection:context.inputSource==='voice'?spokenCorrection.trim():'',
        appRevision:context.appRevision,
      });
      setSent(true);
    }catch(e) {setError(e instanceof Error && e.message==='feedback_disabled'?(isAr?'انتهت فترة التقييم. يمكنك الحفظ بشكل طبيعي.':'Feedback period has ended.'):(isAr?'تعذر إرسال البلاغ، حاول مرة أخرى.':'Could not send report. Please retry.'));}
    finally {setSending(false);}
  };
  if(!enabled) return adminStatus==='none' ? null : <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
    {adminStatus==='off'
      ? (isAr?'وضع الإدارة: طلبات تقييم المحلل متوقفة حاليًا. لتجربتها افتح الإعدادات ← تقييمات المحلل المحلي، ثم فعّل الحملة وحدد مدتها.':'Admin: Feedback prompts are currently off. Open Settings → Local analyzer feedback to enable a pilot.')
      : (isAr?'وضع الإدارة: تعذر تحميل إعدادات التقييم. راجع صفحة الإدارة أو اتصال الخادم.':'Admin: Feedback settings could not be loaded. Check the admin page and server connection.')}
  </p>;
  if(sent) return <div role="status" className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800 flex gap-2 items-center">
    <CheckCircle2 className="h-4 w-4 shrink-0"/> {isAr?'شكرًا! تم إرسال تقييمك للمساعدة في تحسين المحلل المحلي.':'Thank you! Your feedback was sent.'}
  </div>;
  return <section aria-label={isAr?'تقييم المحلل المحلي':'Local parser feedback'} className="rounded-2xl border border-slate-200 bg-slate-50/90 p-3 sm:p-4 space-y-3">
    <div className="flex items-start gap-2">
      <MessageSquareWarning className="h-4 w-4 mt-0.5 text-emerald-700 shrink-0"/>
      <div>
        <h3 className="font-extrabold text-sm text-slate-900">{isAr?'هل فهم المحلل كلامك بشكل صحيح؟':'How well did the parser understand you?'}</h3>
        <p className="text-[11px] text-slate-500">{isAr?'تقييم اختياري خلال فترة التحسين. يمكنك الحفظ مباشرة دون تقييم.':'Optional during our improvement period. You can save without rating.'}</p>
      </div>
    </div>
    <div className="grid grid-cols-4 gap-1.5">
      {options.map(opt=><button key={opt.value} type="button" onClick={()=>void sendRating(opt.value)}
        disabled={sending} aria-pressed={rating===opt.value}
        className={'rounded-xl border px-1 py-2 text-center transition-colors disabled:opacity-60 '+(rating===opt.value?'bg-emerald-50 border-emerald-500 text-emerald-900':'bg-white border-slate-200 text-slate-700 hover:border-emerald-400')}>
        <span aria-hidden="true" className="block text-xl leading-6">{opt.icon}</span>
        <span className="block mt-1 text-[11px] font-bold">{isAr?opt.labelAr:opt.labelEn}</span>
      </button>)}
    </div>
    {rating && isLow(rating) && <div className="space-y-3 border-t border-slate-200 pt-3">
      <p className="text-xs font-bold text-slate-700">{isAr?'وضح لنا الخطأ لتحسين الخدمة. لن تتغير العملية المالية بسبب هذا البلاغ.':'Tell us what went wrong. Your transaction will not be changed by this report.'}</p>
      <div className="space-y-1">
        <label className="text-[11px] font-semibold text-slate-600">{isAr?(context.inputSource==='voice'?'النص الأصلي الذي كتبه المتصفح (للقراءة فقط)':'النص الأصلي الذي أدخلته (للقراءة فقط)'):'Original input (read-only)'}</label>
        <div dir="auto" className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 whitespace-pre-wrap break-words max-h-32 overflow-y-auto">{context.originalText}</div>
      </div>
      {context.inputSource==='voice'&&context.originalText!==context.analyzedText&&<div className="space-y-1">
        <label className="text-[11px] font-semibold text-slate-600">{isAr?'النص الذي تم تحليله بعد مراجعتك':'Text sent to the parser'}</label>
        <div dir="auto" className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 whitespace-pre-wrap break-words">{context.analyzedText}</div>
      </div>}
      {context.inputSource==='voice'&&<fieldset className="space-y-2">
        <legend className="text-[11px] font-bold text-slate-700">{isAr?'مصدر الخطأ':'What went wrong?'}</legend>
        <div className="flex flex-wrap gap-2">
          {([{value:'speech',ar:'المتصفح كتب غلط',en:'Speech recognition'},
            {value:'analysis',ar:'المحلل فهم غلط',en:'Parser'},
            {value:'both',ar:'الاتنين',en:'Both'}] as const).map(opt=><label key={opt.value} className="inline-flex items-center gap-1.5 text-xs text-slate-700">
            <input type="radio" name={'feedback-source-'+context.analysisId} value={opt.value} checked={errorSource===opt.value} onChange={()=>setErrorSource(opt.value)} className="accent-emerald-600"/>
            {isAr?opt.ar:opt.en}
          </label>)}
        </div>
      </fieldset>}
      {context.inputSource==='voice'&&(errorSource==='speech'||errorSource==='both')&&<label className="block space-y-1">
        <span className="text-[11px] font-bold text-slate-700">{isAr?'إنت قلت إيه فعليًا؟ (اختياري)':'What did you actually say? (optional)'}</span>
        <textarea maxLength={1500} value={spokenCorrection} onChange={e=>setSpokenCorrection(e.target.value)} rows={2} dir="auto" className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"/>
      </label>}
      <label className="block space-y-1">
        <span className="text-[11px] font-bold text-slate-700">{isAr?'إيه اللي كان غلط وإيه التصحيح الصحيح؟':'What was wrong and what is correct?'}</span>
        <textarea maxLength={1500} value={correction} onChange={e=>setCorrection(e.target.value)} rows={3} dir="auto" placeholder={isAr?'مثال: التاريخ الصحيح 28 أكتوبر، والملاحظات هدية لأخويا':'Describe the expected correction'} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"/>
      </label>
      <label className="flex items-start gap-2 text-[11px] text-slate-600 leading-5">
        <input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} className="mt-1 accent-emerald-600"/>
        <span>{isAr?'أوافق على إرسال النص الأصلي والنص الذي تم تحليله وتصحيحي إلى إدارة التطبيق لغرض تحسين المحلل فقط. لا تُرسل حساباتي أو أرصدتي أو بقية العمليات.':'I agree to send these texts and my correction to the app administrator to improve the parser. My accounts, balances and other transactions are not sent.'}</span>
      </label>
      <button type="button" onClick={()=>void sendDetails()} disabled={sending||!consent||!correction.trim()} className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-emerald-700 text-white font-bold text-xs disabled:opacity-50">
        <Send className="w-3.5 h-3.5"/>{isAr?'إرسال البلاغ للإدارة':'Send report'}
      </button>
    </div>}
    {error&&<p role="alert" className="text-xs text-rose-700">{error}</p>}
    <p className="flex items-center justify-center gap-1.5 text-[10px] text-slate-500"><ShieldCheck className="w-3 h-3"/>{isAr?'يمكنك تجاهل التقييم وتأكيد وحفظ العملية في أي وقت.':'You may skip feedback and save at any time.'}</p>
  </section>;
}
