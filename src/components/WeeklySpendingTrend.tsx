import { useId, useMemo, useState } from 'react';
import { ChartColumn, ChevronDown } from 'lucide-react';
import type { Language, Transaction } from '../types';

interface SpendingWeek {
  start: number;
  end: number;
  throughToday: boolean;
}

export function summarizeWeeklySpending(
  transactions: Transaction[],
  year: number,
  month: number,
  today: string,
  historyStart: string,
) {
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const isCurrentMonth = monthKey === today.slice(0, 7);
  const dayOfMonth = (date: string) => Number(date.slice(8, 10));
  const end = monthKey > today.slice(0, 7) ? 0 : isCurrentMonth ? dayOfMonth(today) : lastDay;
  const firstDay = monthKey < historyStart.slice(0, 7)
    ? lastDay + 1 : monthKey === historyStart.slice(0, 7) ? dayOfMonth(historyStart) : 1;
  const weeks: SpendingWeek[] = [];
  const weekByDay = new Map<number, number>();
  for (let start = 1; start <= end; start += 7) {
    const weekStart = Math.max(start, firstDay);
    const weekEnd = Math.min(start + 6, end);
    if (weekStart > weekEnd) continue;
    for (let day = weekStart; day <= weekEnd; day++) weekByDay.set(day, weeks.length);
    weeks.push({ start: weekStart, end: weekEnd, throughToday: isCurrentMonth && weekEnd < Math.min(start + 6, lastDay) });
  }

  const currencies = new Map<string, number[]>();
  for (const tx of transactions) {
    if (tx.type !== 'expense' || !tx.currency || !Number.isFinite(tx.amount)) continue;
    const date = tx.date || tx.createdAt?.slice(0, 10) || '';
    if (date.slice(0, 7) !== monthKey) continue;
    const week = weekByDay.get(dayOfMonth(date));
    if (week === undefined) continue;
    let amounts = currencies.get(tx.currency);
    if (!amounts) {
      amounts = weeks.map(() => 0);
      currencies.set(tx.currency, amounts);
    }
    amounts[week] += tx.amount;
  }
  return { weeks, currencies };
}

interface WeeklySpendingTrendProps {
  transactions: Transaction[];
  year: number;
  month: number;
  today: string;
  historyStart: string;
  lang: Language;
  loadState: 'ready' | 'loading' | 'error';
}

function WeeklySpendingChart({ transactions, year, month, today, historyStart, lang }: WeeklySpendingTrendProps) {
  const { weeks, currencies } = useMemo(
    () => summarizeWeeklySpending(transactions, year, month, today, historyStart),
    [transactions, year, month, today, historyStart],
  );
  const [selection, setSelection] = useState('');
  const isAr = lang === 'ar';
  const codes = [...currencies.keys()].sort();
  const currency = currencies.has(selection) ? selection : currencies.has('EGP') ? 'EGP' : codes[0];
  const amounts = currencies.get(currency);
  if (!amounts) return <p className="text-sm text-slate-600">
    {isAr ? 'لا توجد عمليات صرف في الشهر المحدد.' : 'No expenses in the selected month.'}
  </p>;

  const locale = isAr ? 'ar-EG' : 'en-US';
  const number = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const monthLabel = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(new Date(Date.UTC(year, month - 1, 1)));
  const highest = Math.max(0, ...amounts);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-700">
        <h3>{monthLabel}</h3>
        {codes.length > 1
          ? <label className="flex items-center gap-2">
              {isAr ? 'العملة' : 'Currency'}
              <select value={currency} onChange={event => setSelection(event.target.value)}
                className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 text-slate-900">
                {codes.map(code => <option key={code} value={code}>{code}</option>)}
              </select>
            </label>
          : <bdi>{currency}</bdi>}
      </div>
      <ul className="grid gap-1.5 sm:gap-3" style={{ gridTemplateColumns: `repeat(${weeks.length}, minmax(0, 1fr))` }}>
        {weeks.map(({ start, end, throughToday }, index) => {
          const amount = amounts[index];
          const height = highest > 0 ? Math.max(0, amount / highest) * 100 : 0;
          return (
            <li key={start} className="min-w-0 space-y-1 text-center">
              <div className="flex h-24 items-end justify-center rounded-lg bg-emerald-50" aria-hidden="true">
                <div className={`w-2/3 max-w-9 rounded-t-md ${throughToday ? 'bg-emerald-400' : 'bg-emerald-600'}`}
                  style={{ height: `${height}%` }} />
              </div>
              <bdi className="block break-all text-xs font-black text-slate-900">{number.format(amount)}</bdi>
              <span className="block text-[10px] font-semibold text-slate-600">
                <bdi>{number.format(start)}–{number.format(end)}</bdi>
              </span>
              {throughToday && <span className="block text-[10px] font-bold leading-tight text-emerald-800">
                {isAr ? 'حتى اليوم' : 'Through today'}
              </span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function WeeklySpendingTrend(props: WeeklySpendingTrendProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const isAr = props.lang === 'ar';
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
      <button type="button" aria-expanded={open} aria-controls={panelId}
        onClick={() => setOpen(value => !value)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl px-3.5 py-2 text-start text-sm font-bold text-slate-800 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-500">
        <span className="flex items-center gap-2">
          <ChartColumn aria-hidden="true" className="size-4 shrink-0 text-emerald-700" />
          {isAr ? 'اتجاه المصروفات' : 'Weekly spending trend'}
        </span>
        <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-slate-500 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div id={panelId} hidden={!open} className="border-t border-slate-100 p-3.5">
        {open && (props.loadState === 'ready'
          ? <WeeklySpendingChart {...props} />
          : <p role="status" className="text-sm text-slate-600">
              {props.loadState === 'error'
                ? (isAr ? 'تعذّر تحميل العمليات.' : 'Transactions could not be loaded.')
                : (isAr ? 'جارٍ تحميل العمليات…' : 'Loading transactions…')}
            </p>)}
      </div>
    </section>
  );
}
