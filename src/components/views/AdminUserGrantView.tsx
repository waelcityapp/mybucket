import { useEffect, useState } from 'react';
import { auth } from '../../lib/firebase';
import type { Language } from '../../types';
import { cairoGrantDate, grantLastDayAfterMonths } from '../../utils/grantDates';

type GrantDetails = { uid:string; name:string; email:string; paidAccessUntil:string|null; grant:null | { plan:'basic'|'pro'; startsAt:string|null; endsAt:string|null; active:boolean; reason:string; note:string } };
async function request(action:string, payload:Record<string,unknown>) {
  const user=auth.currentUser;
  if (!user) throw new Error('authentication_required');
  const response=await fetch('/api/gateway',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await user.getIdToken()},body:JSON.stringify({action,payload})});
  const body=await response.json();
  if (!response.ok || !body?.ok) throw new Error(body?.error || 'request_failed');
  return body.data;
}
export function AdminUserGrantView({uid,lang,onBack}:{uid:string;lang:Language;onBack:()=>void}) {
  const ar=lang==='ar';
  const [data,setData]=useState<GrantDetails|null>(null);
  const [plan,setPlan]=useState<'basic'|'pro'>('basic');
  const [endDate,setEndDate]=useState('');
  const [reason,setReason]=useState('');
  const [note,setNote]=useState('');
  const [busy,setBusy]=useState(false);
  const [ending,setEnding]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const load=async () => {
    const result=await request('admin.grant.get',{uid}) as GrantDetails;
    setData(result);
    if (result.grant?.active && result.grant.endsAt && Date.parse(result.grant.endsAt)>Date.now()) {
      setPlan(result.grant.plan); setEndDate(cairoGrantDate(Date.parse(result.grant.endsAt)-1));
      setReason(result.grant.reason);setNote(result.grant.note);
    }
  };
  useEffect(()=>{let active=true; request('admin.grant.get',{uid}).then((result:GrantDetails)=>{if(!active)return;setData(result);if(result.grant?.active && result.grant.endsAt && Date.parse(result.grant.endsAt)>Date.now()){setPlan(result.grant.plan);setEndDate(cairoGrantDate(Date.parse(result.grant.endsAt)-1));setReason(result.grant.reason);setNote(result.grant.note);}}).catch(()=>{if(active)setError(ar?'تعذر تحميل المنحة.':'Could not load grant.');}); return()=>{active=false;};},[uid,ar]);
  const save=async () => {
    setBusy(true);setError('');setNotice('');
    try { await request('admin.grant.set',{uid,plan,endDate,reason,note});await load();setNotice(ar?'تم حفظ المنحة المجانية.':'Free grant saved.'); }
    catch(e){const code=e instanceof Error?e.message:'';setError(code==='access_record_missing'?(ar?'سجل صلاحية المستخدم يحتاج مراجعة قبل المنح.':'User access requires review before granting.'):(ar?'تعذر حفظ المنحة. تحقق من التاريخ وحاول مرة أخرى.':'Could not save grant. Check the date and retry.'));}
    finally{setBusy(false);}
  };
  const end=async () => {
    setBusy(true);setError('');setNotice('');
    try{await request('admin.grant.end',{uid});await load();setEnding(false);setNotice(ar?'تم إنهاء المنحة.':'Grant ended.');}
    catch{setError(ar?'تعذر إنهاء المنحة.':'Could not end grant.');}finally{setBusy(false);}
  };
  const active=Boolean(data?.grant?.active && data.grant.endsAt && Date.parse(data.grant.endsAt)>Date.now());
  return <section dir={ar?'rtl':'ltr'} className="mx-auto max-w-xl space-y-4 pb-24">
    <button type="button" onClick={onBack} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold">{ar?'العودة للمستخدمين':'Back to users'}</button>
    <h1 className="text-xl font-black text-slate-900">{ar?'إدارة المنحة المجانية':'Manage free grant'}</h1>
    {!data && !error && <p role="status" className="text-sm text-slate-500">{ar?'جارٍ تحميل الحساب...':'Loading account...'}</p>}
    {data && <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
      <div><p className="font-black text-slate-900">{data.name || (ar?'مستخدم التطبيق':'App user')}</p><p dir="ltr" className="break-all text-xs text-slate-500">{data.email}</p></div>
      <p className="rounded-xl bg-emerald-50 p-3 text-xs leading-6 text-emerald-900">{active?(ar?'لديه منحة سارية؛ يمكنك تعديلها أو إنهاؤها.':'An active grant can be changed or ended.'):(ar?'المنحة مجانية ولا تُسجّل كعملية دفع.':'This grant is free and is not recorded as a payment.')}</p>
      {data.paidAccessUntil && Date.parse(data.paidAccessUntil)>Date.now() && <p className="rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900">{ar?'للمستخدم صلاحية مدفوعة سارية. المنحة تبدأ الآن، ولا يتوقف عدادها أثناء الصلاحية المدفوعة.':'This user has paid access. The grant starts now and continues to count down during paid access.'}</p>}
      <label className="block text-xs font-bold">{ar?'الخطة':'Plan'}<select value={plan} onChange={e=>setPlan(e.target.value as typeof plan)} className="mt-2 w-full rounded-xl border border-slate-200 p-3"><option value="basic">Basic</option><option value="pro">Pro</option></select></label>
      <div><p className="text-xs font-bold">{ar?'مدة تبدأ من الآن':'Duration from now'}</p><div className="mt-2 flex flex-wrap gap-2">{[1,3,6,12].map(months=><button key={months} type="button" onClick={()=>setEndDate(grantLastDayAfterMonths(months))} className="rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs font-bold text-emerald-800">{ar?(months===12?'سنة':`${months} ${months===1?'شهر':'شهور'}`):`${months} mo`}</button>)}</div></div>
      <label className="block text-xs font-bold">{ar?'تاريخ آخر يوم للمنحة (توقيت القاهرة)':'Last grant day (Cairo time)'}<input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)} className="mt-2 block w-full rounded-xl border border-slate-200 p-3" /></label>
      <label className="block text-xs font-bold">{ar?'سبب المنحة للإدارة فقط':'Internal reason'}<input maxLength={160} value={reason} onChange={e=>setReason(e.target.value)} placeholder={ar?'مثال: فريق المبيعات':'e.g. sales team'} className="mt-2 block w-full rounded-xl border border-slate-200 p-3" /></label>
      <label className="block text-xs font-bold">{ar?'ملاحظة داخلية اختيارية':'Optional internal note'}<textarea maxLength={500} value={note} onChange={e=>setNote(e.target.value)} className="mt-2 block w-full rounded-xl border border-slate-200 p-3" /></label>
      <div className="flex flex-wrap gap-2"><button type="button" disabled={busy||!endDate} onClick={()=>void save()} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">{ar?'حفظ المنحة':'Save grant'}</button>{active && <button type="button" disabled={busy} onClick={()=>setEnding(true)} className="rounded-xl border border-rose-200 bg-white px-4 py-2.5 text-sm font-bold text-rose-700">{ar?'إنهاء المنحة':'End grant'}</button>}</div>
      {ending && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs"><p>{ar?'إنهاء المنحة لا يحذف البيانات المالية أو الاشتراك المدفوع.':'Ending the grant preserves financial data and paid subscription.'}</p><button type="button" disabled={busy} onClick={()=>void end()} className="mt-2 rounded-lg bg-rose-700 px-3 py-2 font-bold text-white">{ar?'تأكيد إنهاء المنحة':'Confirm end grant'}</button><button type="button" onClick={()=>setEnding(false)} className="mx-2 font-bold">{ar?'إلغاء':'Cancel'}</button></div>}
    </div>}
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-700">{error}</p>}{notice && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-xs text-emerald-800">{notice}</p>}
  </section>;
}
