import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, CalendarClock, HandCoins, BellRing, Volume2 } from 'lucide-react';
import { auth } from '../lib/firebase';
import { playReminderTone } from '../utils/reminderSounds';
import type { Language } from '../types';

type Alert = { id:string;kind:'obligation'|'receivable'; title:string;amount:number;currency:string;dueDate:string;leadDays?:number;tone?:number;remindTime?:string;repeat?:'daily'|'once';done:boolean;alertDisabled?:boolean;snoozedUntil?:string|null };
export function ReminderHomeCards({ lang, onOpen }: { lang: Language; onOpen: (kind: 'obligation' | 'receivable') => void }) {
  const ar = lang === 'ar';
  const [items,setItems]=useState<Alert[]>([]);
  const [today,setToday]=useState(()=>new Date().toLocaleDateString('en-CA'));
  const [clock,setClock]=useState(()=>new Date().toTimeString().slice(0,5));
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const reload=useCallback(async()=>{
    const user=auth.currentUser;
    if(!user) return;
    try {
      const res=await fetch('/api/gateway',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await user.getIdToken()},body:JSON.stringify({action:'reminders.list',payload:{}})});
      const json=await res.json();
      if(!res.ok||!json.ok) throw Error(json.error||'request_failed');
      setItems(Array.isArray(json.data?.reminders)?json.data.reminders:[]);
    }catch(e){setError(ar?'تعذر تحميل التذكيرات':'Could not load reminders');}
  },[ar]);
  useEffect(()=>{void reload();},[reload]);
  useEffect(()=>{
    const tick=()=>{setToday(new Date().toLocaleDateString('en-CA'));setClock(new Date().toTimeString().slice(0,5));};
    const timer=window.setInterval(tick,60000);
    window.addEventListener('focus',tick);
    return()=>{window.clearInterval(timer);window.removeEventListener('focus',tick);};
  },[]);
  const advance=(item:Alert)=>{const d=new Date(item.dueDate+'T12:00:00');d.setDate(d.getDate()-(item.leadDays||0));return d.toLocaleDateString('en-CA');};
  const due=items.filter(item=>!item.done&&!item.alertDisabled&&typeof item.leadDays==='number'&&(!item.snoozedUntil||item.snoozedUntil<=today)&&advance(item)<=today&&(item.repeat!=='once'||advance(item)===today)&&(item.remindTime||'09:00')<=clock);
  const action=async(item:Alert,mode:'toggle'|'alert',value:'tomorrow'|'stop'|null)=>{
    setBusy(true);setError('');
    try {
      const user=auth.currentUser;if(!user)throw Error('login_required');
      const res=await fetch('/api/gateway',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+await user.getIdToken()},body:JSON.stringify({action:'reminders.'+mode,payload:mode==='toggle'?{id:item.id,done:true}:{id:item.id,mode:value}})});
      const json=await res.json();if(!res.ok||!json.ok)throw Error(json.error||'request_failed');
      await reload();
    }catch{setError(ar?'تعذر تحديث التذكير':'Could not update reminder');}
    finally{setBusy(false);}
  };
  return <div className="space-y-2.5">
    {due.length>0&&<div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 space-y-2">
      <div className="flex items-center gap-2 text-amber-900"><BellRing className="w-5 h-5"/><b className="text-sm">{ar?'تذكيرات مالية تحتاج انتباهك':'Financial reminders need attention'} ({due.length})</b></div>
      {due.slice(0,3).map(item=><div key={item.id} className="rounded-xl border border-amber-100 bg-white p-3 space-y-2">
        <button type="button" onClick={()=>onOpen(item.kind)} className="text-start text-sm font-bold text-slate-800">{item.title} · {item.amount.toLocaleString(ar?'ar-EG':'en-US')} {item.currency} · {item.dueDate}</button>
        <div className="flex flex-wrap gap-2">
          <button disabled={busy} onClick={()=>void action(item,'toggle',null)} className="rounded-lg bg-emerald-600 text-white text-xs px-2 py-1.5">{item.kind==='obligation'?(ar?'تم السداد':'Paid'):(ar?'تم التحصيل':'Collected')}</button>
          <button disabled={busy} onClick={()=>void action(item,'alert','tomorrow')} className="rounded-lg border text-xs px-2 py-1.5">{ar?'ذكّرني غدًا':'Tomorrow'}</button>
          <button disabled={busy} onClick={()=>void action(item,'alert','stop')} className="rounded-lg border text-xs px-2 py-1.5">{ar?'إيقاف التنبيه':'Stop alert'}</button>
          <button onClick={()=>void playReminderTone(item.tone||1).catch(()=>{})} aria-label={ar?'جرس التذكير':'Play chime'} className="rounded-lg border p-1.5 text-emerald-700"><Volume2 className="w-4 h-4"/></button>
        </div>
      </div>)}
    </div>}
    {error&&<p className="text-xs text-red-600">{error}</p>}
    {(['obligation','receivable'] as const).map(kind => <button
      key={kind} type="button" onClick={() => onOpen(kind)}
      className="w-full rounded-2xl bg-white border border-slate-200/90 hover:bg-slate-50 p-2.5 sm:p-3 shadow-2xs flex items-center justify-between gap-2 text-start transition-colors"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${kind === 'obligation' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'}`}>
          {kind === 'obligation' ? <CalendarClock className="w-4 h-4"/> : <HandCoins className="w-4 h-4"/>}
        </div>
        <div className="min-w-0 text-start">
          <span className="block text-xs sm:text-sm font-black text-slate-900 leading-tight">{kind === 'obligation' ? (ar ? 'تذكير بالالتزامات' : 'My Commitments') : (ar ? 'تذكير بمستحقات لي' : 'Money Owed to Me')}</span>
          <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium leading-relaxed">{ar ? 'أقسام رئيسية وبنود فرعية وتفاصيل كل بند' : 'Categories, items and individual details'}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[10px] font-bold rounded-md bg-slate-100 text-slate-600 px-1.5 py-0.5 whitespace-nowrap">{ar ? 'إنشاء البنود' : 'Manage items'}</span>
        <span className="hidden sm:inline text-xs font-bold text-slate-600 whitespace-nowrap">{ar ? 'عرض القائمة' : 'View list'}</span>
        <ChevronLeft className={`w-4 h-4 text-slate-500 shrink-0 ${ar ? '' : 'rotate-180'}`}/>
      </div>
    </button>)}
  </div>;
}
