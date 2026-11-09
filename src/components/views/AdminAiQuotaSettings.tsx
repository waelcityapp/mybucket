import { useEffect, useState } from 'react';
import { auth } from '../../lib/firebase';
import type { Language } from '../../types';

type Key = 'basicLocalEntries' | 'basicLocalInquiries' | 'proGeminiEntries' | 'proGeminiInquiries' | 'proLocalEntries' | 'proLocalInquiries';
type Limits = Record<Key, number>;
async function call(action:string, payload:Record<string,unknown>={}) {
  const user=auth.currentUser;if(!user)throw new Error('authentication_required');
  const response=await fetch('/api/gateway',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await user.getIdToken()},body:JSON.stringify({action,payload})});
  const result=await response.json();if(!response.ok||!result?.ok)throw new Error(result?.message||'request_failed');return result.data;
}
export function AdminAiQuotaSettings({lang}:{lang:Language}) {
  const ar=lang==='ar';const [limits,setLimits]=useState<Limits|null>(null);const [error,setError]=useState('');const [notice,setNotice]=useState('');const [busy,setBusy]=useState(false);
  useEffect(()=>{let active=true;call('admin.aiQuota.get').then(data=>{if(active)setLimits(data as Limits);}).catch(()=>{if(active)setError(ar?'تعذر قراءة حدود الاستخدام.':'Could not read usage limits.');});return()=>{active=false;};},[ar]);
  const fields:Array<[Key,string]>=[['basicLocalEntries',ar?'Basic: تسجيلات المحلل المحلي':'Basic: local entries'],['basicLocalInquiries',ar?'Basic: استعلامات المحلل المحلي':'Basic: local inquiries'],['proGeminiEntries',ar?'Pro: تسجيلات Gemini':'Pro: Gemini entries'],['proGeminiInquiries',ar?'Pro: استعلامات Gemini':'Pro: Gemini inquiries'],['proLocalEntries',ar?'Pro: تسجيلات المحلي بعد Gemini':'Pro: local entries'],['proLocalInquiries',ar?'Pro: استعلامات المحلي بعد Gemini':'Pro: local inquiries']];
  const valid=limits && fields.every(([key])=>Number.isInteger(limits[key]) && limits[key]>=0 && limits[key]<=10000);
  const save=async()=>{if(!limits||!valid||busy)return;setBusy(true);setError('');setNotice('');try{const updated=await call('admin.aiQuota.save',limits) as Limits;setLimits(updated);setNotice(ar?'تم حفظ الحدود اليومية.':'Daily limits saved.');}catch{setError(ar?'تعذر حفظ الحدود.':'Could not save limits.');}finally{setBusy(false);}};
  return <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
    <h3 className="text-base font-black text-slate-900">{ar?'حدود الاستخدام اليومية':'Daily usage limits'}</h3>
    <p className="text-xs leading-6 text-slate-600">{ar?'تتجدد الحدود يوميًا بتوقيت القاهرة. لكل خطة ومحلل عداد مستقل، وتُحتسب المحاولة عند بدء التحليل.':'Limits reset daily in Cairo time, independently per plan and engine. Attempts count when analysis starts.'}</p>
    {limits && <div className="grid gap-3 sm:grid-cols-2">{fields.map(([key,label])=><label key={key} className="text-xs font-bold text-slate-700">{label}<input type="number" min="0" max="10000" step="1" value={Number.isNaN(limits[key]) ? '' : limits[key]} onChange={e=>{const raw=e.target.value;setLimits(old=>old?{...old,[key]:raw===''?NaN:Number(raw)}:old);setNotice('');}} className="mt-1 block w-full rounded-xl border border-slate-200 p-2.5 text-base" /></label>)}</div>}
    {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}{notice && <p role="status" className="text-xs text-emerald-700">{notice}</p>}
    <button type="button" disabled={!limits||!valid||busy} onClick={()=>void save()} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">{busy?(ar?'جارٍ الحفظ...':'Saving...'):(ar?'حفظ حدود الاستخدام':'Save usage limits')}</button>
  </section>;
}
