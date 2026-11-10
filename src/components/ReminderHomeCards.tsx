import { ChevronLeft, CalendarClock, HandCoins } from 'lucide-react';
import { useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import type { Language } from '../types';

type Summary = { month: string; totals: Record<string, { obligations: number; receivables: number }> };
export function ReminderHomeCards({ lang, onOpen }: { lang: Language; onOpen: (kind: 'obligation' | 'receivable') => void }) {
  const ar = lang === 'ar';
  const [summary, setSummary] = useState<Summary | null>(null);
  const [currency, setCurrency] = useState('');
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const [hidden, setHidden] = useState(() => localStorage.getItem('hide_financial_balance') === 'true');
  useEffect(() => {
    let active = true, sequence = 0;
    const cairoMonth = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit' }).format(new Date());
    let trackedMonth = cairoMonth();
    const load = async () => {
      const current = ++sequence;
      try {
        const user = auth.currentUser;
        if (!user) throw new Error('login_required');
        const response = await fetch('/api/gateway', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await user.getIdToken() }, body: JSON.stringify({ action: 'reminders.monthSummary', payload: {} }) });
        const result = await response.json();
        if (!response.ok || !result?.ok || !result.data || auth.currentUser?.uid !== user.uid) throw new Error('summary_unavailable');
        if (active && sequence === current) { setSummary(result.data); setFailed(false); }
      } catch { if (active && sequence === current) { setSummary(null); setFailed(true); } }
    };
    void load();
    const onVisible = () => { if (document.visibilityState === 'visible') { trackedMonth = cairoMonth(); void load(); } };
    const rollover = window.setInterval(() => { const month = cairoMonth(); if (month !== trackedMonth) { trackedMonth = month; void load(); } }, 60000);
    document.addEventListener('visibilitychange', onVisible);
    return () => { active = false; window.clearInterval(rollover); document.removeEventListener('visibilitychange', onVisible); };
  }, [retry]);
  useEffect(() => {
    const update = () => setHidden(localStorage.getItem('hide_financial_balance') === 'true');
    window.addEventListener('mybucket-balance-visibility', update); window.addEventListener('storage', update);
    return () => { window.removeEventListener('mybucket-balance-visibility', update); window.removeEventListener('storage', update); };
  }, []);
  const currencies = Object.keys(summary?.totals || {}).sort();
  const selected = currencies.includes(currency) ? currency : currencies.includes('EGP') ? 'EGP' : currencies[0] || 'EGP';
  const totals = summary?.totals[selected] || { obligations: 0, receivables: 0 };
  const total = totals.obligations + totals.receivables;
  const pct = total > 0 ? totals.obligations / total * 100 : 0;
  const number = (value: number) => new Intl.NumberFormat(ar ? 'ar-EG' : 'en-US', { maximumFractionDigits: 2 }).format(value);
  return <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-2.5 sm:p-3 shadow-2xs" dir={ar ? 'rtl' : 'ltr'}>
    <div className="rounded-xl bg-emerald-50/50 border border-emerald-100 px-3 py-2 space-y-1.5">
      <div className="flex items-center justify-between gap-2"><h2 className="text-xs sm:text-sm font-black text-slate-800">{ar ? 'الالتزامات والمستحقات هذا الشهر' : 'Commitments and receivables this month'}</h2><select aria-label={ar ? 'عملة المؤشر' : 'Indicator currency'} value={selected} onChange={e => setCurrency(e.target.value)} className="max-w-24 rounded-lg border border-emerald-200 bg-white px-2 py-1 text-xs font-bold text-emerald-800">{(currencies.length ? currencies : ['EGP']).map(c => <option key={c} value={c}>{c}</option>)}</select></div>
      {failed ? <p role="alert" className="text-xs text-rose-700">{ar ? 'تعذر حساب إجمالي هذا الشهر.' : 'Could not calculate this month’s totals.'} <button type="button" onClick={() => setRetry(n => n + 1)} className="font-bold underline">{ar ? 'إعادة المحاولة' : 'Retry'}</button></p> : !summary ? <p role="status" className="text-xs text-slate-500">{ar ? 'جارٍ حساب إجمالي الشهر...' : 'Calculating this month’s totals...'}</p> : <>
        <div role="img" aria-label={hidden ? (ar ? 'المبالغ مخفية' : 'Amounts hidden') : (ar ? `الالتزامات ${number(totals.obligations)}، المستحقات ${number(totals.receivables)} ${selected}` : `Commitments ${number(totals.obligations)}, receivables ${number(totals.receivables)} ${selected}`)} className="flex h-5 w-full overflow-hidden rounded-full bg-slate-200" dir="rtl">
          {!hidden && total > 0 && <><span style={{ width: pct + '%' }} className="flex items-center justify-center overflow-hidden bg-gradient-to-l from-rose-400 to-rose-500 text-[10px] font-bold text-white">{pct >= 18 ? Math.round(pct) + '%' : ''}</span><span style={{ width: (100-pct) + '%' }} className="flex items-center justify-center overflow-hidden bg-gradient-to-l from-emerald-500 to-emerald-300 text-[10px] font-bold text-white">{100-pct >= 18 ? Math.round(100-pct) + '%' : ''}</span></>}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs"><div className="min-w-0"><p className="font-bold text-rose-600">{ar ? 'الالتزامات' : 'Commitments'}</p><p className="break-words font-black text-slate-900" dir="auto">{hidden ? '••••' : number(totals.obligations)} <span className="text-[10px] font-semibold text-slate-500">{selected}</span></p></div><div className="min-w-0 border-s border-slate-200 ps-2"><p className="font-bold text-emerald-700">{ar ? 'مستحقاتي' : 'Receivables'}</p><p className="break-words font-black text-slate-900" dir="auto">{hidden ? '••••' : number(totals.receivables)} <span className="text-[10px] font-semibold text-slate-500">{selected}</span></p></div></div>
        <p className="text-[10px] text-slate-500">{ar ? 'إجمالي مواعيد هذا الشهر، بما فيها المسدد والمحصّل.' : 'All amounts due this month, including paid and collected.'}</p>
      </>}
    </div>
    {(['obligation','receivable'] as const).map(kind => <button
      key={kind} type="button" onClick={() => onOpen(kind)}
      className="w-full rounded-2xl bg-white border border-slate-200/90 hover:bg-slate-50 px-2.5 py-2 shadow-2xs flex items-center justify-between gap-2 text-start transition-colors"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${kind === 'obligation' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-700'}`}>
          {kind === 'obligation' ? <CalendarClock className="w-4 h-4"/> : <HandCoins className="w-4 h-4"/>}
        </div>
        <div className="min-w-0 text-start">
          <span className="block text-xs sm:text-sm font-black text-slate-900 leading-tight">{kind === 'obligation' ? (ar ? 'تذكير بالالتزامات' : 'My Commitments') : (ar ? 'تذكير بمستحقات لي' : 'Money Owed to Me')}</span>
          <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium leading-relaxed">{ar ? 'أقسام رئيسية وبنود فرعية وتفاصيل كل بند' : 'Categories, items and individual details'}</p>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="hidden sm:inline text-xs font-bold text-slate-600 whitespace-nowrap">{ar ? 'عرض القائمة' : 'View list'}</span>
        <ChevronLeft className={`w-4 h-4 text-slate-500 shrink-0 ${ar ? '' : 'rotate-180'}`}/>
      </div>
    </button>)}
  </div>;
}
