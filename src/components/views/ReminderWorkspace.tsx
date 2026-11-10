import { useCallback, useEffect, useMemo, useState } from 'react';
import { auth } from '../../lib/firebase';
import type { Language } from '../../types';
import { ArrowRight, ArrowLeft, Plus, Pencil, Trash2, Check, CalendarClock, Bell, Volume2 } from 'lucide-react';
import { playReminderTone } from '../../utils/reminderSounds';

type Kind = 'obligation' | 'receivable';
type Frequency = 'none' | 'weekly' | 'monthly' | 'yearly' | 'installments';
type Item = { id:string; seriesId?:string; occurrenceIndex?:number; category?:string; kind:Kind; title:string; amount:number; currency:string; dueDate:string; note:string; done:boolean; frequency?:Frequency; installmentCount?:number|null; leadDays?:number; tone?:number; remindTime?:string; repeat?:'daily'|'once'; alertDisabled?:boolean; snoozedUntil?:string|null };
type Fields = { category:string; title:string; amount:string; currency:string; dueDate:string; note:string; frequency:Frequency; installmentCount:number; leadDays:number; tone:number; remindTime:string; repeat:'daily'|'once' };
const defaultFields = (category:string):Fields => ({category,title:'',amount:'',currency:'EGP',dueDate:new Date().toLocaleDateString('en-CA'),note:'',frequency:'none',installmentCount:12,leadDays:7,tone:1,remindTime:'09:00',repeat:'daily'});
const categories = [
 {id:'installments',ar:'الأقساط',en:'Installments',icon:'💳'},
 {id:'rent',ar:'الإيجارات',en:'Rent',icon:'🏠'},
 {id:'bills',ar:'الفواتير',en:'Bills',icon:'🧾'},
 {id:'debts',ar:'الديون والمبالغ الشخصية',en:'Debts',icon:'🤝'},
 {id:'subscriptions',ar:'الاشتراكات',en:'Subscriptions',icon:'🔄'},
 {id:'other',ar:'بنود أخرى',en:'Other',icon:'📁'}
];
async function api(action:string,payload:Record<string,unknown>={}) {
 const user=auth.currentUser;
 if(!user) throw Error('login_required');
 const res=await fetch('/api/gateway',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await user.getIdToken()},body:JSON.stringify({action:'reminders.'+action,payload})});
 const out=await res.json();
 if(!res.ok||!out.ok) throw Error(out.error||'request_failed');
 return out.data;
}
function masterId(item:Item) {return item.seriesId||item.id;}
function labelFor(id:string,ar:boolean) {const match=categories.find(c=>c.id===id);return match?(ar?match.ar:match.en):(ar?'بنود أخرى':'Other');}
function dateLead(item:Item) {const date=new Date(item.dueDate+'T12:00:00');date.setDate(date.getDate()-(item.leadDays??7));return date.toLocaleDateString('en-CA');}
function currencyValue(item:Item,ar:boolean) {return item.amount.toLocaleString(ar?'ar-EG':'en-US')+' '+item.currency;}

export function ReminderWorkspace({ lang, kind, onHome, userId }:{lang:Language;kind:Kind;onHome:()=>void;userId:string}) {
 const ar=lang==='ar';
 const [path,setPath]=useState(window.location.pathname);
 const [items,setItems]=useState<Item[]>([]);
 const [loading,setLoading]=useState(true);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [fields,setFields]=useState<Fields>(defaultFields('other'));
 const [scope,setScope]=useState<'once'|'future'>('once');
 const prefix='/reminders/'+kind;
 const current=path.startsWith(prefix)?path.slice(prefix.length).split('/').filter(Boolean):[];
 const category=current[0]&&categories.some(c=>c.id===current[0])?current[0]:null;
 const seriesId=current[1]&&/^[0-9a-f-]{36}$/.test(current[1])?current[1]:null;
 const isNew=current[1]==='new';
 const isEdit=current[2]==='edit';
 const isDelete=current[2]==='delete';
 const view= !category?'categories':isNew||isEdit?'form':isDelete?'delete':seriesId?'detail':'list';
 const refresh=useCallback(async()=>{
  setLoading(true);
  try {const r=await api('list');if(auth.currentUser?.uid===userId){setItems(Array.isArray(r.reminders)?r.reminders:[]);setError('');}}
  catch(e){setError((ar?'تعذر تحميل البنود: ':'Cannot load items: ')+(e instanceof Error?e.message:'error'));}
  finally{setLoading(false);}
 },[userId,ar]);
 useEffect(()=>{void refresh();},[refresh]);
 useEffect(()=>{const callback=()=>setPath(window.location.pathname);window.addEventListener('popstate',callback);return()=>window.removeEventListener('popstate',callback);},[]);
 const navigate=(next:string)=>{window.history.pushState({myBucketTab:'reminders'},'',next);setPath(window.location.pathname);setError('');window.scrollTo(0,0);};
 const back=()=>{if(view==='categories'){onHome();return;}if(view==='list'){navigate(prefix);return;}if(view==='detail'){navigate(prefix+'/'+category);return;}if(isEdit||isDelete){navigate(prefix+'/'+category+'/'+seriesId);return;}navigate(prefix+'/'+category);};
 const group=useMemo(()=>{const grouped=new Map<string,Item[]>();for(const item of items.filter(i=>i.kind===kind)){const id=masterId(item);const list=grouped.get(id)||[];list.push(item);grouped.set(id,list);}return [...grouped.entries()].map(([id,entries])=>({id,entries,category:entries[0]?.category||'other',first:entries.find(i=>!i.done&&i.dueDate>=new Date().toLocaleDateString('en-CA'))||entries.find(i=>!i.done)||entries[0]}));},[items,kind]);
 const selectedGroup=group.find(g=>g.id===seriesId);
 const occurrences=selectedGroup?.entries||[];
 const first=selectedGroup?.first;
 const params=new URLSearchParams(window.location.search);
 const selectedEdit=occurrences.find(i=>i.id===params.get('occ'));
 const deleteAll=params.get('all')==='1';
 const today=new Date().toLocaleDateString('en-CA');
 const startNew=()=>{setFields(defaultFields(category||'other'));setScope('once');navigate(prefix+'/'+category+'/new');};
 const startEdit=(item:Item)=>{setFields({category:item.category||category||'other',title:item.title,amount:String(item.amount),currency:item.currency,dueDate:item.dueDate,note:item.note||'',frequency:item.frequency||'none',installmentCount:item.installmentCount||12,leadDays:item.leadDays??7,tone:item.tone??1,remindTime:item.remindTime||'09:00',repeat:item.repeat||'daily'});setScope('once');navigate(prefix+'/'+category+'/'+masterId(item)+'/edit?occ='+encodeURIComponent(item.id));};
 useEffect(()=>{if(!isEdit||!selectedEdit)return;const item=selectedEdit;setFields({category:item.category||category||'other',title:item.title,amount:String(item.amount),currency:item.currency,dueDate:item.dueDate,note:item.note||'',frequency:item.frequency||'none',installmentCount:item.installmentCount||12,leadDays:item.leadDays??7,tone:item.tone??1,remindTime:item.remindTime||'09:00',repeat:item.repeat||'daily'});setScope('once');},[isEdit,selectedEdit?.id]);
 const startDelete=(item:Item,all:boolean)=>navigate(prefix+'/'+category+'/'+masterId(item)+'/delete?occ='+encodeURIComponent(item.id)+(all?'&all=1':''));
 async function save(){
  if(!fields.title.trim()||fields.amount===''||!Number.isFinite(Number(fields.amount))||Number(fields.amount)<0||!fields.dueDate){setError(ar?'أدخل اسم البند والمبلغ والتاريخ بشكل صحيح':'Enter valid name, amount and date');return;}
  if(isEdit&&!selectedEdit){setError(ar?'تعذر تحديد الاستحقاق المطلوب تعديله. ارجع واختره مرة أخرى.':'Could not identify the selected due date.');return;}
  setBusy(true);setError('');
  try {await api(isEdit?'update':'create',{...(isEdit?{id:selectedEdit?.id,scope}:{}),kind,category:fields.category,title:fields.title,amount:Number(fields.amount),currency:fields.currency,dueDate:fields.dueDate,note:fields.note,frequency:fields.frequency,installmentCount:fields.frequency==='installments'?fields.installmentCount:null,leadDays:fields.leadDays,tone:fields.tone,remindTime:fields.remindTime,repeat:fields.repeat});
    await refresh();navigate(prefix+'/'+category+(isEdit?'/'+seriesId:''));}
  catch(e){setError((ar?'تعذر الحفظ: ':'Save failed: ')+(e instanceof Error?e.message:'error'));}
  finally{setBusy(false);}
 }
 async function update(action:string,payload:Record<string,unknown>){
  setBusy(true);setError('');
  try {await api(action,payload);await refresh();return true;}
  catch(e){setError((ar?'تعذر تنفيذ العملية: ':'Action failed: ')+(e instanceof Error?e.message:'error'));return false;}
  finally{setBusy(false);}
 }
 const title=kind==='obligation'?(ar?'التزاماتي':'My Commitments'):(ar?'مستحقات لي':'Receivables');
 const BackIcon=ar?ArrowRight:ArrowLeft;
 return <div dir={ar?'rtl':'ltr'} className="min-h-screen bg-slate-50 text-slate-900">
   <div className="max-w-3xl mx-auto px-4 py-5 sm:py-8 space-y-4">
     <header className="flex gap-3 items-center">
       <button onClick={back} type="button" aria-label={ar?'رجوع':'Back'} className="rounded-xl border border-slate-200 bg-white p-2.5 shadow-sm"><BackIcon className="w-5 h-5"/></button>
       <div className="min-w-0"><p className="text-xs text-emerald-700 font-bold">{title}</p><h1 className="text-xl sm:text-2xl font-black break-words">{view==='categories'?(ar?'الأقسام الرئيسية':'Categories'):view==='list'?labelFor(category||'other',ar):view==='delete'?(ar?'تأكيد الحذف':'Confirm deletion'):view==='form'?(isEdit?(ar?'تعديل البند':'Edit item'):(ar?'إنشاء بند جديد':'New item')):first?.title||(ar?'تفاصيل البند':'Item details')}</h1></div>
     </header>
     {error&&<p role="alert" className="rounded-xl border border-red-200 bg-red-50 text-red-700 p-3 text-sm">{error}</p>}
     {loading&&<p className="text-sm text-slate-500">{ar?'جاري تحميل البيانات...':'Loading...'}</p>}

     {view==='categories'&&<section className="space-y-2">
       <p className="text-sm text-slate-500">{ar?'اختر قسمًا لعرض بنوده أو إضافة بند جديد. كل التواريخ المتكررة محفوظة داخل البند نفسه.':'Choose a category to view or add items. Repeated dates stay under each item.'}</p>
       {categories.map(cat=>{const gs=group.filter(g=>g.category===cat.id);return <button key={cat.id} type="button" onClick={()=>navigate(prefix+'/'+cat.id)} className="w-full flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-start shadow-sm hover:border-emerald-300">
         <span className="text-2xl">{cat.icon}</span><div className="flex-1"><p className="font-bold">{ar?cat.ar:cat.en}</p><p className="text-xs text-slate-500">{gs.length} {ar?'بند':'items'}</p></div><span className="text-slate-400"><BackIcon className={`w-5 h-5 ${ar?'rotate-180':'rotate-180'}`}/></span>
       </button>})}
     </section>}

     {view==='list'&&<section className="space-y-3">
       <button type="button" onClick={startNew} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 text-white px-4 py-3 text-sm font-bold"><Plus className="w-4 h-4"/>{ar?'إضافة بند جديد':'Add item'}</button>
       {group.filter(g=>g.category===category).length===0&&!loading&&<p className="rounded-2xl bg-white border border-slate-200 p-6 text-center text-slate-500 text-sm">{ar?'لا توجد بنود في هذا القسم حتى الآن.':'No items in this category yet.'}</p>}
       {group.filter(g=>g.category===category).map(g=><button key={g.id} type="button" onClick={()=>navigate(prefix+'/'+category+'/'+g.id)} className="w-full rounded-2xl border border-slate-200 bg-white p-4 flex items-center gap-3 text-start shadow-sm hover:border-emerald-300">
         <div className="flex-1 min-w-0"><p className="font-bold text-sm">{g.first.title}</p><p className="text-xs text-slate-500 mt-1">{currencyValue(g.first,ar)} · {g.first.dueDate}</p><p className="text-xs mt-1 text-emerald-700">{g.first.frequency==='installments'?(ar?'أقساط شهرية':'Monthly installments'):g.first.frequency==='monthly'?(ar?'شهريًا':'Monthly'):g.first.frequency==='weekly'?(ar?'أسبوعيًا':'Weekly'):g.first.frequency==='yearly'?(ar?'سنويًا':'Yearly'):(ar?'مرة واحدة':'One-time')}</p></div>
         <span className="text-xs text-slate-500">{g.entries.length} {ar?'استحقاق':'dues'}</span>
       </button>)}
     </section>}

     {view==='detail'&&<section className="space-y-4">
       {first&&<div className="rounded-2xl bg-white border border-slate-200 p-4 space-y-3">
         <p className="text-sm text-slate-500">{labelFor(category||'other',ar)}</p>
         <p className="text-2xl font-black">{currencyValue(first,ar)}</p>
         {first.note&&<p className="text-sm text-slate-600">{first.note}</p>}
         <p className="text-xs text-slate-500">{first.frequency==='installments'?`${ar?'عدد الأقساط':'Installments'}: ${first.installmentCount||'-'}`:first.frequency==='monthly'?(ar?'يتكرر شهريًا':'Monthly'):first.frequency==='weekly'?(ar?'يتكرر أسبوعيًا':'Weekly'):first.frequency==='yearly'?(ar?'يتكرر سنويًا':'Yearly'):(ar?'بند غير متكرر':'One-time')}</p>
         <button type="button" onClick={()=>startEdit(first)} className="inline-flex gap-2 items-center border border-emerald-200 text-emerald-700 rounded-xl px-3 py-2 text-sm font-semibold"><Pencil className="w-4 h-4"/>{ar?'تعديل البند':'Edit item'}</button>
         <button type="button" onClick={()=>startDelete(first,true)} className="mx-2 inline-flex gap-2 items-center border border-red-200 text-red-700 rounded-xl px-3 py-2 text-sm font-semibold"><Trash2 className="w-4 h-4"/>{ar?'حذف البند بالكامل':'Delete entire item'}</button>
       </div>}
       <h2 className="text-lg font-bold">{ar?'مواعيد الاستحقاق':'Due dates'}</h2>
       {occurrences.map(item=><article key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col sm:flex-row sm:items-center gap-3">
         <div className="flex-1 space-y-1"><p className="text-sm font-bold">{item.dueDate} · {currencyValue(item,ar)}</p><p className={`text-xs font-semibold ${item.done?'text-emerald-700':item.dueDate<today?'text-red-600':'text-slate-500'}`}>{item.done?(kind==='obligation'?(ar?'مسدد':'Paid'):(ar?'تم التحصيل':'Collected')):item.dueDate<today?(ar?(kind==='obligation'?'غير مسدد · متأخر':'لم يُحصّل · متأخر'):'Not completed · overdue'):(ar?(kind==='obligation'?'غير مسدد · قادم':'لم يُحصّل · قادم'):'Not completed · upcoming')}</p>{item.frequency==='installments'&&<p className="text-xs text-slate-500">{ar?'القسط':'Installment'} {(item.occurrenceIndex??0)+1} / {item.installmentCount}</p>}</div>
         <div className="flex flex-wrap gap-2">
           <label className="inline-flex min-w-14 cursor-pointer flex-col items-center gap-1 text-[11px] font-bold text-slate-600">
             <input type="checkbox" checked={item.done} disabled={busy} onChange={e=>void update('toggle',{id:item.id,done:e.target.checked})} aria-label={kind==='obligation'?(ar?'السداد':'Payment'):(ar?'التحصيل':'Collection')} className="peer sr-only" />
             <span aria-hidden="true" className={'flex h-8 w-8 items-center justify-center rounded-md border-2 peer-focus-visible:ring-2 peer-focus-visible:ring-emerald-500 peer-disabled:opacity-50 '+(item.done?'border-emerald-600 bg-emerald-600 text-white':'border-slate-300 bg-white text-transparent')}><Check className="h-5 w-5" strokeWidth={3}/></span>
             <span>{kind==='obligation'?(ar?'السداد':'Payment'):(ar?'التحصيل':'Collection')}</span>
           </label>
           <button type="button" onClick={()=>startEdit(item)} className="rounded-lg border border-slate-200 p-2" aria-label={ar?'تعديل الاستحقاق':'Edit occurrence'}><Pencil className="w-4 h-4"/></button>
           <button type="button" onClick={()=>startDelete(item,false)} className="rounded-lg border border-red-100 p-2 text-red-600" aria-label={ar?'حذف الاستحقاق':'Delete due date'}><Trash2 className="w-4 h-4"/></button>
         </div>
       </article>)}
       {occurrences.length===0&&!loading&&<p className="text-sm text-slate-500">{ar?'لا توجد استحقاقات متاحة.':'No due dates found.'}</p>}
     </section>}

     {view==='form'&&isEdit&&!selectedEdit&&!loading&&<p role="alert" className="rounded-xl bg-red-50 p-4 text-sm text-red-700">{ar?'تعذر العثور على الاستحقاق المطلوب. ارجع واختره مرة أخرى.':'Due date not found. Go back and select it again.'}</p>}
     {view==='form'&&(!isEdit||selectedEdit)&&<form onSubmit={e=>{e.preventDefault();void save();}} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
       <label className="block text-sm font-semibold">{ar?'اسم البند الفرعي':'Item name'}<input required maxLength={120} value={fields.title} onChange={e=>setFields(f=>({...f,title:e.target.value}))} placeholder={ar?'مثال: قسط السيارة أو الغسالة':'e.g. Car or washing machine installment'} className="mt-1 w-full rounded-xl border p-3"/></label>
       <div className="grid grid-cols-2 gap-3">
         <label className="block text-xs font-semibold">{ar?'المبلغ':'Amount'}<input required type="number" min="0" step="0.01" value={fields.amount} onChange={e=>setFields(f=>({...f,amount:e.target.value}))} className="mt-1 w-full rounded-xl border p-3"/></label>
         <label className="block text-xs font-semibold">{ar?'العملة':'Currency'}<select value={fields.currency} onChange={e=>setFields(f=>({...f,currency:e.target.value}))} className="mt-1 w-full rounded-xl border p-3">{['EGP','USD','EUR','SAR','AED','GBP','KWD','QAR'].map(x=><option key={x}>{x}</option>)}</select></label>
       </div>
       {!isEdit&&<label className="block text-xs font-semibold">{ar?'نظام تكرار البند':'Recurrence'}<select value={fields.frequency} onChange={e=>setFields(f=>({...f,frequency:e.target.value as Frequency}))} className="mt-1 w-full rounded-xl border p-3">
         <option value="none">{ar?'مرة واحدة':'Once'}</option><option value="weekly">{ar?'أسبوعيًا':'Weekly'}</option><option value="monthly">{ar?'شهريًا':'Monthly'}</option><option value="yearly">{ar?'سنويًا':'Yearly'}</option><option value="installments">{ar?'أقساط شهرية محددة العدد':'Fixed installments'}</option>
       </select></label>}
       {!isEdit&&fields.frequency==='installments'&&<label className="block text-xs font-semibold">{ar?'عدد الأقساط':'Installment count'}<input required type="number" min={1} max={240} value={fields.installmentCount} onChange={e=>setFields(f=>({...f,installmentCount:Number(e.target.value)}))} className="mt-1 w-full rounded-xl border p-3"/></label>}
       <label className="block text-xs font-semibold">{ar?'موعد الاستحقاق':'Due date'}<input required type="date" value={fields.dueDate} onChange={e=>setFields(f=>({...f,dueDate:e.target.value}))} className="mt-1 w-full rounded-xl border p-3"/></label>
       {isEdit&&fields.frequency!=='none'&&<fieldset className="rounded-xl border p-3 space-y-2 text-sm"><legend className="font-bold">{ar?'التعديل يخص':'Apply update to'}</legend>
         <label className="flex gap-2"><input type="radio" checked={scope==='once'} onChange={()=>setScope('once')} />{ar?'الاستحقاق المختار فقط':'Selected occurrence only'}</label>
         <label className="flex gap-2"><input type="radio" checked={scope==='future'} onChange={()=>setScope('future')}/>{ar?'الاستحقاق المختار وكل المواعيد القادمة':'This and future occurrences'}</label>
       </fieldset>}
       <div className="grid grid-cols-2 gap-3">
         <label className="text-xs font-semibold">{ar?'ذكرني قبل الاستحقاق':'Remind days ahead'}<select value={fields.leadDays} onChange={e=>setFields(f=>({...f,leadDays:Number(e.target.value)}))} className="mt-1 w-full rounded-xl border p-3">{[0,1,2,3,4,5,7,10,14,21,30,60,90].map(n=><option key={n} value={n}>{n} {ar?'يوم':'days'}</option>)}</select></label>
         <label className="text-xs font-semibold">{ar?'ساعة التذكير':'Reminder time'}<input required type="time" value={fields.remindTime} onChange={e=>setFields(f=>({...f,remindTime:e.target.value}))} className="mt-1 w-full rounded-xl border p-3"/></label>
       </div>
       <div className="grid grid-cols-2 gap-3">
         <label className="text-xs font-semibold">{ar?'نغمة التنبيه':'Chime'}<div className="flex items-center gap-1 mt-1"><select value={fields.tone} onChange={e=>setFields(f=>({...f,tone:Number(e.target.value)}))} className="w-full min-w-0 rounded-xl border p-3">{[1,2,3,4].map(n=><option key={n} value={n}>{ar?'نغمة':'Tone'} {n}</option>)}</select><button type="button" onClick={()=>void playReminderTone(fields.tone).catch(()=>setError(ar?'الصوت غير متاح':'Audio unavailable'))} aria-label={ar?'تجربة النغمة':'Preview tone'} className="border rounded-xl p-3"><Volume2 className="w-4 h-4"/></button></div></label>
         <label className="text-xs font-semibold">{ar?'تكرار التنبيه':'Alert frequency'}<select value={fields.repeat} onChange={e=>setFields(f=>({...f,repeat:e.target.value as 'daily'|'once'}))} className="mt-1 w-full rounded-xl border p-3"><option value="daily">{ar?'يوميًا':'Daily'}</option><option value="once">{ar?'مرة واحدة':'Once'}</option></select></label>
       </div>
       <label className="block text-xs font-semibold">{ar?'ملاحظات اختيارية':'Notes'}<textarea maxLength={500} rows={2} value={fields.note} onChange={e=>setFields(f=>({...f,note:e.target.value}))} className="mt-1 w-full rounded-xl border p-3"/></label>
       <div className="flex gap-2"><button disabled={busy} type="submit" className="bg-emerald-600 text-white rounded-xl px-5 py-3 text-sm font-bold disabled:opacity-50">{ar?'حفظ البند':'Save item'}</button><button type="button" disabled={busy} onClick={back} className="border rounded-xl px-5 py-3 text-sm">{ar?'إلغاء':'Cancel'}</button></div>
     </form>}
     {view==='delete'&&<section className="rounded-2xl border border-red-200 bg-white p-4 space-y-3">
       {selectedEdit?<><p className="font-bold">{deleteAll?(ar?'حذف البند بالكامل وجميع مواعيده؟':'Delete the entire item and all due dates?'):(ar?'حذف هذا الاستحقاق فقط؟':'Delete this due date only?')}</p><p className="text-sm">{selectedEdit.title} · {selectedEdit.dueDate}</p><p className="text-sm text-slate-600">{ar?'لا تتأثر العمليات المالية المسجلة.':'Recorded financial transactions are unchanged.'}</p><div className="flex gap-2"><button type="button" disabled={busy} onClick={()=>void update('delete',{id:deleteAll?masterId(selectedEdit):selectedEdit.id}).then(ok=>{if(ok)navigate(deleteAll?prefix+'/'+category:prefix+'/'+category+'/'+seriesId);})} className="bg-red-600 text-white rounded-xl px-4 py-2 text-sm font-bold disabled:opacity-50">{ar?'تأكيد الحذف':'Confirm deletion'}</button><button type="button" onClick={back} className="border rounded-xl px-4 py-2 text-sm">{ar?'تراجع':'Cancel'}</button></div></>:!loading&&<p role="alert" className="text-sm text-red-700">{ar?'تعذر العثور على البند المطلوب.':'Item not found.'}</p>}
     </section>}
     <p className="text-xs text-slate-500">{ar?'التذكيرات للمتابعة فقط، ولا تخصم أو تضيف أموالًا إلى حساباتك تلقائيًا.':'Reminders do not modify account balances.'}</p>
   </div>
 </div>;
}
