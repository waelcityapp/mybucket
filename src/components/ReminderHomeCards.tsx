import { ChevronLeft, CalendarClock, HandCoins } from 'lucide-react';
import type { Language } from '../types';

export function ReminderHomeCards({ lang, onOpen }: { lang: Language; onOpen: (kind: 'obligation' | 'receivable') => void }) {
  const ar = lang === 'ar';
  return <div className="space-y-2.5">
    {(['obligation','receivable'] as const).map(kind => <button
      key={kind} type="button" onClick={() => onOpen(kind)}
      className="w-full rounded-2xl bg-white border border-slate-200/90 hover:bg-slate-50 p-2.5 sm:p-3 shadow-2xs flex items-center justify-between gap-2 text-start transition-colors"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${kind === 'obligation' ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'}`}>
          {kind === 'obligation' ? <CalendarClock className="w-4 h-4"/> : <HandCoins className="w-4 h-4"/>}
        </div>
        <div className="min-w-0">
          <span className="text-xs sm:text-sm font-black text-slate-900">{kind === 'obligation' ? (ar ? 'تذكير بالالتزامات' : 'My Commitments') : (ar ? 'تذكير بمستحقات لي' : 'Money Owed to Me')}</span>
          <span className="ms-2 text-[10px] font-bold rounded-md bg-slate-100 text-slate-600 px-1.5 py-0.5">{ar ? 'إنشاء البنود' : 'Manage items'}</span>
          <p className="text-[10px] sm:text-[11px] text-slate-400">{ar ? 'أقسام رئيسية وبنود فرعية وتفاصيل كل بند' : 'Categories, items and individual details'}</p>
        </div>
      </div>
      <ChevronLeft className={`w-4 h-4 text-slate-500 shrink-0 ${ar ? '' : 'rotate-180'}`}/>
    </button>)}
  </div>;
}
