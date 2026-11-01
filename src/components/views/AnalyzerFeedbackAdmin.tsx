import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, CheckCircle2, ClipboardList, Clock3, EyeOff, RefreshCw, Save, ShieldCheck } from 'lucide-react';
import type { Language } from '../../types';
import { AnalyzerFeedbackReport, FeedbackConfig, FeedbackStatus, feedbackRequest } from '../../services/ai/analyzerFeedbackClient';

type Props={ lang: Language; onBack:()=>void };
const ratings:Record<string,string>={bad:'سيئ',acceptable:'مقبول',good:'جيد',very_good:'جيد جدًا'};
const sources:Record<string,string>={speech:'تحويل صوت',analysis:'التحليل',both:'الصوت والتحليل',unspecified:'غير محدد'};
const statuses:Record<FeedbackStatus,string>={new:'جديد',reviewing:'قيد المراجعة',resolved:'تمت المعالجة'};
type ConfigForm={enabled:boolean;startDate:string;durationDays:number;frequency:1|3|5};
const todayCairo=()=>{
  const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const get=(t:string)=>parts.find(p=>p.type===t)?.value||'';
  return get('year')+'-'+get('month')+'-'+get('day');
};
const btn='rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:border-emerald-400 disabled:opacity-60';
function expireDate(settings:ConfigForm):string {
  if(!settings.startDate||settings.durationDays===0)return 'حتى الإيقاف اليدوي';
  const d=new Date(settings.startDate+'T12:00:00Z');
  d.setUTCDate(d.getUTCDate()+settings.durationDays);
  // End is exclusive. Last eligible calendar day is start + duration - 1.
  d.setUTCDate(d.getUTCDate()-1);
  return d.toLocaleDateString('ar-EG',{timeZone:'UTC',day:'numeric',month:'long',year:'numeric'});
}
export function AnalyzerFeedbackAdmin({lang,onBack}:Props){
  const ar=lang==='ar';
  const [config,setConfig]=useState<ConfigForm>({enabled:false,startDate:todayCairo(),durationDays:14,frequency:1});
  const [active,setActive]=useState(false);
  const [reports,setReports]=useState<AnalyzerFeedbackReport[]>([]);
  const [tab,setTab]=useState<'reports'|'settings'>('reports');
  const [filter,setFilter]=useState<'all'|'needs_review'|'bad'|'acceptable'|'good'|'very_good'>('all');
  const [query,setQuery]=useState('');
  const [selected,setSelected]=useState<string|null>(null);
  const [busy,setBusy]=useState(false);
  const [saving,setSaving]=useState(false);
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const reload=async()=>{
    setBusy(true);setError('');
    try {
      const [settings,records]=await Promise.all([
        feedbackRequest<FeedbackConfig>('feedback.config'),
        feedbackRequest<AnalyzerFeedbackReport[]>('admin.feedbackReports'),
      ]);
      setConfig({enabled:settings.enabled,startDate:settings.startDate||todayCairo(),durationDays:settings.durationDays,frequency:settings.frequency});
      setActive(settings.active);
      setReports(records);
    }catch(e){setError(ar?'تعذر تحميل البيانات. تأكد من اتصال Firebase وصلاحيات الإدارة.':'Could not load reports and settings.');}
    finally {setBusy(false);}
  };
  useEffect(()=>{void reload();},[]);
  const saveConfig=async()=>{
    setSaving(true);setError('');setNotice('');
    try {
      const result=await feedbackRequest<FeedbackConfig>('admin.feedbackSettings',config);
      setActive(result.active);
      setNotice(ar?'تم حفظ الإعدادات وتطبيقها على الموقع.':'Settings saved.');
    }catch{setError(ar?'تعذر حفظ الإعدادات.':'Could not save settings.');}
    finally {setSaving(false);}
  };
  const changeStatus=async(id:string,status:FeedbackStatus)=>{
    setError('');
    try {
      await feedbackRequest('admin.feedbackUpdateStatus',{id,status});
      setReports(prev=>prev.map(r=>r.id===id?{...r,status}:r));
    }catch{setError(ar?'تعذر تحديث حالة البلاغ.':'Could not update report.');}
  };
  const visible=useMemo(()=>reports.filter(r=>{
    if(filter==='needs_review'&&r.status==='resolved')return false;
    if(filter==='bad'||filter==='acceptable'||filter==='good'||filter==='very_good'){if(r.rating!==filter)return false;}
    if(!query.trim())return true;
    const q=query.trim().toLowerCase();
    return [r.originalText,r.analyzedText,r.correction,r.spokenCorrection,r.appRevision].some(t=>t?.toLowerCase().includes(q));
  }),[reports,filter,query]);
  const low=reports.filter(r=>r.rating==='bad'||r.rating==='acceptable').length;
  const positive=reports.filter(r=>r.rating==='good'||r.rating==='very_good').length;
  return <div className="max-w-4xl mx-auto space-y-5 pb-24" dir={ar?'rtl':'ltr'}>
    <header className="flex items-start gap-3">
      <button onClick={onBack} type="button" className={btn} aria-label={ar?'العودة للوحة الإدارة':'Back to admin'}>
        {ar?<ArrowRight className="h-4 w-4"/>:<ArrowLeft className="h-4 w-4"/>}
      </button>
      <div className="flex-1">
        <h1 className="text-xl font-black text-slate-900">{ar?'تقييمات المحلل المحلي':'Local analyzer feedback'}</h1>
        <p className="text-xs text-slate-500 mt-1">{ar?'صفحة للإدارة فقط · تحسين المحلل بدون Gemini':'Admin only · Improve the local analyzer without Gemini'}</p>
      </div>
      <button onClick={()=>void reload()} disabled={busy} className={btn} type="button" title={ar?'تحديث':'Refresh'}><RefreshCw className={'h-4 w-4 '+(busy?'animate-spin':'')}/></button>
    </header>
    <div className="grid grid-cols-3 gap-2">
      {[
        {label:ar?'جميع التقييمات':'Ratings',value:reports.length},
        {label:ar?'بحاجة لمراجعة':'Low ratings',value:low},
        {label:ar?'جيد أو جيد جدًا':'Positive',value:positive}
      ].map(item=><div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-3 text-center">
        <div className="text-2xl font-black text-slate-900 tabular-nums">{item.value}</div>
        <div className="text-[11px] text-slate-500">{item.label}</div>
      </div>)}
    </div>
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={()=>setTab('reports')} className={(tab==='reports'?'bg-emerald-700 text-white':'bg-white text-slate-700 border-slate-200')+' flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-bold'}><ClipboardList className="h-4 w-4"/>{ar?'البلاغات':'Reports'}</button>
      <button type="button" onClick={()=>setTab('settings')} className={(tab==='settings'?'bg-emerald-700 text-white':'bg-white text-slate-700 border-slate-200')+' flex items-center gap-1.5 rounded-xl border px-4 py-2 text-xs font-bold'}><CalendarDays className="h-4 w-4"/>{ar?'إعدادات التقييم':'Settings'}</button>
    </div>
    {error&&<p role="alert" className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs">{error}</p>}
    {notice&&<p role="status" className="p-3 rounded-xl bg-emerald-50 text-emerald-800 text-xs flex gap-2 items-center"><CheckCircle2 className="h-4 w-4"/>{notice}</p>}
    {tab==='settings'?<section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div><h2 className="text-sm font-extrabold text-slate-900">{ar?'تفعيل طلب التقييم':'Enable rating prompts'}</h2>
          <p className="text-xs text-slate-500">{ar?'عند الإيقاف لن يظهر التقييم للمستخدمين.':'Disabling hides prompts for everyone.'}</p></div>
        <label className="inline-flex items-center gap-2 text-sm font-bold text-slate-700">
          <input type="checkbox" checked={config.enabled} onChange={e=>setConfig(c=>({...c,enabled:e.target.checked}))} className="h-5 w-5 accent-emerald-700"/>
          {config.enabled?(ar?'مفعّل':'On'):(ar?'متوقف':'Off')}
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <label className="space-y-2 block"><span className="block text-xs font-bold text-slate-700">{ar?'تاريخ بداية التقييم':'Start date'}</span>
          <input type="date" value={config.startDate} onChange={e=>setConfig(c=>({...c,startDate:e.target.value}))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" dir="ltr"/>
        </label>
        <label className="space-y-2 block"><span className="block text-xs font-bold text-slate-700">{ar?'مدة ظهور طلب التقييم (بالأيام)':'Rating campaign duration (days)'}</span>
          <input type="number" min={0} max={365} step={1} value={config.durationDays} onChange={e=>{
            const value=Number(e.target.value);
            setConfig(c=>({...c,durationDays:Math.max(0,Math.min(365,Math.floor(Number.isFinite(value)?value:14)))}));
          }} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm" dir="ltr"/>
          <span className="block text-[11px] text-slate-500">{ar?'من 1 إلى 365 يومًا، أو 0 حتى الإيقاف اليدوي.':'1 to 365 days, or 0 to run until disabled.'}</span>
        </label>
      </div>
      <div className="text-xs text-slate-600 flex items-center gap-2 p-3 rounded-xl bg-slate-50">
        <Clock3 className="h-4 w-4 shrink-0"/>
        {ar?'آخر يوم لظهور التقييم: ':'Last day: '}{expireDate(config)}
      </div>
      <label className="space-y-2 block"><span className="text-xs font-bold text-slate-700">{ar?'معدل ظهور التقييم':'Prompt frequency'}</span>
        <select value={config.frequency} onChange={e=>setConfig(c=>({...c,frequency:Number(e.target.value) as 1|3|5}))} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm">
          <option value="1">{ar?'بعد كل تحليل':'After every analysis'}</option>
          <option value="3">{ar?'بعد كل 3 تحليلات':'Every 3 analyses'}</option>
          <option value="5">{ar?'بعد كل 5 تحليلات':'Every 5 analyses'}</option>
        </select>
      </label>
      <p className="text-xs text-slate-500">{ar?'الظهور يُحسب لكل مستخدم على جهازه. التقييم اختياري، ويمكنه الحفظ بدونه. البلاغات القديمة لا تُحذف بالإيقاف.':'Frequency is counted per user/device. Ratings never block saving; turning off does not delete reports.'}</p>
      <div className="flex flex-wrap gap-2 items-center">
        <button onClick={()=>void saveConfig()} disabled={saving||!config.startDate} type="button" className="flex items-center gap-2 rounded-xl bg-emerald-700 text-white px-5 py-2.5 text-sm font-bold disabled:opacity-60"><Save className="h-4 w-4"/>{saving?(ar?'جاري الحفظ...':'Saving...'):(ar?'حفظ الإعدادات':'Save settings')}</button>
        <button onClick={async()=>{
          setSaving(true);setError('');setNotice('');
          try{
            const result=await feedbackRequest<FeedbackConfig>('admin.feedbackSettings',{...config,enabled:false});
            setConfig(c=>({...c,enabled:false}));setActive(result.active);
            setNotice(ar?'تم إيقاف التقييمات على الموقع فورًا.':'Ratings disabled immediately.');
          }catch{setError(ar?'تعذر إيقاف التقييمات.':'Could not disable ratings.');}
          finally{setSaving(false);}
        }} disabled={saving} type="button" className={btn}><EyeOff className="inline h-4 w-4 me-1"/>{ar?'إيقاف التقييمات فورًا':'Stop ratings now'}</button>
      </div>
      <p className="text-[11px] text-slate-500">{ar?'حالة التقييم على الموقع الآن: ':'Current live status: '}{active?(ar?'مفعّل خلال المدة':'Active'):(ar?'غير ظاهر':'Not showing')}</p>
      <div className="text-[11px] text-slate-500 flex gap-2 items-center"><ShieldCheck className="h-4 w-4 shrink-0"/>{ar?'عند استقبال بلاغ تفصيلي يلزم موافقة المستخدم قبل إرسال النص الأصلي للإدارة.':'Detailed reports require the user’s explicit consent.'}</div>
    </section>:<section className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <select aria-label={ar?'تصفية البلاغات':'Report filter'} value={filter} onChange={e=>setFilter(e.target.value as typeof filter)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs bg-white">
          <option value="all">{ar?'كل التقييمات':'All ratings'}</option>
          <option value="needs_review">{ar?'غير المعالجة':'Unresolved'}</option>
          <option value="bad">{ar?'سيئ':'Bad'}</option>
          <option value="acceptable">{ar?'مقبول':'Acceptable'}</option>
          <option value="good">{ar?'جيد':'Good'}</option>
          <option value="very_good">{ar?'جيد جدًا':'Very good'}</option>
        </select>
        <input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder={ar?'بحث في البلاغات':'Search reports'} className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2 text-xs bg-white"/>
      </div>
      {busy&&<p className="text-xs text-slate-500">{ar?'جاري تحميل البلاغات...':'Loading feedback...'}</p>}
      {!busy&&visible.length===0&&<p className="p-8 text-center rounded-2xl border border-dashed border-slate-200 bg-white text-xs text-slate-500">{ar?'لا توجد بلاغات مطابقة حتى الآن.':'No matching reports yet.'}</p>}
      {visible.map(report=><article key={report.id} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
        <button type="button" onClick={()=>setSelected(x=>x===report.id?null:report.id)} className="flex w-full items-center gap-2 p-3 sm:p-4 text-start">
          <span className={'rounded-lg px-2 py-1 text-[11px] font-bold '+((report.rating==='bad'||report.rating==='acceptable')?'bg-amber-50 text-amber-800':'bg-emerald-50 text-emerald-800')}>
            {ar?ratings[report.rating]:report.rating}
          </span>
          <span className="text-[11px] text-slate-500">{ar?statuses[report.status]:report.status}</span>
          <span className="ms-auto text-[11px] text-slate-400" dir="ltr">{report.createdAt?new Date(report.createdAt).toLocaleDateString(ar?'ar-EG':'en-US'):''}</span>
          <span className="text-[11px] text-slate-400">{report.appRevision}</span>
        </button>
        {selected===report.id&&<div className="p-4 pt-1 border-t border-slate-100 space-y-3 text-sm">
          {(report.rating==='bad'||report.rating==='acceptable')&&<>
            <div><p className="text-[11px] font-bold text-slate-500">{ar?'النص الأصلي كما أُرسل':'Original input'}</p><p dir="auto" className="mt-1 rounded-xl bg-slate-50 p-2 text-xs break-words">{report.originalText}</p></div>
            {report.analyzedText!==report.originalText&&<div><p className="text-[11px] font-bold text-slate-500">{ar?'النص الذي حلله النظام':'Analyzed text'}</p><p dir="auto" className="mt-1 rounded-xl bg-slate-50 p-2 text-xs break-words">{report.analyzedText}</p></div>}
            <div><p className="text-[11px] font-bold text-slate-500">{ar?'مصدر الخطأ':'Error source'}</p><p className="text-xs">{ar?sources[report.errorSource]:report.errorSource}</p></div>
            {report.spokenCorrection&&<div><p className="text-[11px] font-bold text-slate-500">{ar?'الكلام الذي قاله المستخدم فعليًا':'Spoken correction'}</p><p dir="auto" className="mt-1 rounded-xl bg-slate-50 p-2 text-xs break-words">{report.spokenCorrection}</p></div>}
            <div><p className="text-[11px] font-bold text-slate-500">{ar?'شرح الخطأ والتصحيح':'Correction'}</p><p dir="auto" className="mt-1 rounded-xl bg-emerald-50 p-2 text-xs break-words">{report.correction}</p></div>
          </>}
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs text-slate-500">{ar?'حالة البلاغ':'Status'}</label>
            <select value={report.status} onChange={e=>void changeStatus(report.id,e.target.value as FeedbackStatus)} className="rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs">
              {(['new','reviewing','resolved'] as const).map(v=><option key={v} value={v}>{ar?statuses[v]:v}</option>)}
            </select>
          </div>
        </div>}
      </article>)}
      {reports.length>=200&&<p className="text-xs text-slate-500">{ar?'يتم عرض أحدث 200 تقييم فقط.':'Showing the 200 latest ratings.'}</p>}
    </section>}
  </div>;
}
