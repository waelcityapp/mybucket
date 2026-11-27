import { useId, useMemo, useState } from 'react';
import { CalendarDays, ChevronDown } from 'lucide-react';
import type { Category, Language, Transaction } from '../types';

function comparableDays(today: string, historyStart: string) {
  const [year, month, day] = today.split('-').map(Number);
  const previousMonthEnd = new Date(Date.UTC(year, month - 1, 0));
  const currentMonth = today.slice(0, 7);
  const previousMonth = previousMonthEnd.toISOString().slice(0, 7);
  const lastDay = Math.min(day, previousMonthEnd.getUTCDate());
  const firstDay = historyStart.startsWith(previousMonth + '-') ? Number(historyStart.slice(8)) : 1;

  if (historyStart > `${previousMonth}-${String(lastDay).padStart(2, '0')}`) return null;

  const date = (monthKey: string, dayOfMonth: number) =>
    `${monthKey}-${String(dayOfMonth).padStart(2, '0')}`;
  return {
    current: { start: date(currentMonth, firstDay), end: date(currentMonth, lastDay) },
    previous: { start: date(previousMonth, firstDay), end: date(previousMonth, lastDay) },
  };
}

type PeriodTotal = { income: number; expense: number };
type CurrencyComparison = {
  current: PeriodTotal;
  previous: PeriodTotal;
  biggestIncrease: { categoryId: string; amount: number } | null;
};

export function compareMonths(transactions: Transaction[], today: string, historyStart: string) {
  const dates = comparableDays(today, historyStart);
  if (!dates) return null;

  const currencies = new Map<string, CurrencyComparison>();
  const expenseDifferences = new Map<string, Map<string, number>>();
  for (const tx of transactions) {
    if ((tx.type !== 'income' && tx.type !== 'expense') || !tx.currency || !Number.isFinite(tx.amount)) continue;
    const date = tx.date || tx.createdAt?.split('T')[0] || '';
    const period = date >= dates.current.start && date <= dates.current.end ? 'current'
      : date >= dates.previous.start && date <= dates.previous.end ? 'previous' : null;
    if (!period) continue;

    let comparison = currencies.get(tx.currency);
    if (!comparison) {
      comparison = { current: { income: 0, expense: 0 }, previous: { income: 0, expense: 0 }, biggestIncrease: null };
      currencies.set(tx.currency, comparison);
    }
    comparison[period][tx.type] += tx.amount;

    if (tx.type !== 'expense') continue;
    let byCategory = expenseDifferences.get(tx.currency);
    if (!byCategory) {
      byCategory = new Map();
      expenseDifferences.set(tx.currency, byCategory);
    }
    const categoryId = tx.categoryId || '';
    const difference = tx.amount * (period === 'current' ? 1 : -1);
    byCategory.set(categoryId, (byCategory.get(categoryId) ?? 0) + difference);
  }

  for (const [currency, byCategory] of expenseDifferences) {
    const comparison = currencies.get(currency)!;
    for (const [categoryId, difference] of byCategory) {
      if (difference > (comparison.biggestIncrease?.amount ?? 0)) {
        comparison.biggestIncrease = { categoryId, amount: difference };
      }
    }
  }
  return { dates, currencies };
}

interface MonthComparisonProps {
  transactions: Transaction[];
  categories: Category[];
  today: string;
  historyStart: string;
  loadState: 'ready' | 'loading' | 'error';
  lang: Language;
}

function MonthComparisonResults({ transactions, categories, today, historyStart, lang }: MonthComparisonProps) {
  const isAr = lang === 'ar';
  const [selection, setSelection] = useState('');
  const result = useMemo(() => compareMonths(transactions, today, historyStart), [transactions, today, historyStart]);
  if (!result || !result.currencies.size) {
    return <p className="text-sm text-slate-600">
      {result
        ? (isAr ? 'لا توجد عمليات دخل أو مصروفات في فترتي المقارنة.' : 'No income or expenses in either period.')
        : (isAr ? 'سجل العمليات لسه ما بيغطّيش أيام كافية من الشهر السابق للمقارنة.' : 'There is not enough history for a comparison with last month.')}
    </p>;
  }

  const { dates, currencies } = result;
  const codes = [...currencies.keys()].sort();
  const currency = currencies.has(selection) ? selection : currencies.has('EGP') ? 'EGP' : codes[0];
  const { current, previous, biggestIncrease } = currencies.get(currency)!;
  const locale = isAr ? 'ar-EG' : 'en-US';
  const dateFormat = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
  const range = ({ start, end }: { start: string; end: string }) =>
    dateFormat.formatRange(new Date(start), new Date(end));
  const format = new Intl.NumberFormat(locale, { maximumFractionDigits: 2 });
  const formatDifference = new Intl.NumberFormat(locale, { maximumFractionDigits: 2, signDisplay: 'exceptZero' });
  const category = biggestIncrease && categories.find(item => item.id === biggestIncrease.categoryId);
  const categoryName = category
    ? (isAr ? category.nameAr || category.name : category.name || category.nameAr)
    : biggestIncrease?.categoryId
      ? (isAr ? 'بند غير متاح' : 'Unavailable category')
      : (isAr ? 'بدون تصنيف' : 'Uncategorized');

  return (
    <div className="space-y-3">
      <dl className="grid gap-2 text-xs sm:grid-cols-2">
        {([
          [isAr ? 'هذا الشهر' : 'This month', dates.current],
          [isAr ? 'الشهر السابق' : 'Last month', dates.previous],
        ] as const).map(([label, dates]) => (
          <div key={label} className="rounded-lg bg-slate-50 px-2.5 py-2 text-slate-700">
            <dt className="font-bold">{label}</dt>
            <dd>{range(dates)}</dd>
          </div>
        ))}
      </dl>
      <label className="flex items-center gap-2 text-xs font-bold text-slate-700">
        {isAr ? 'العملة' : 'Currency'}
        {codes.length > 1
          ? <select value={currency} onChange={event => setSelection(event.target.value)}
              className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 text-slate-900">
              {codes.map(code => <option key={code} value={code}>{code}</option>)}
            </select>
          : <bdi>{currency}</bdi>}
      </label>
      <table className="w-full border-collapse text-xs">
        <thead className="border-b border-slate-200 text-slate-600">
          <tr>
            <td />
            <th scope="col" className="px-1 pb-2 text-end">{isAr ? 'الحالي' : 'Current'}</th>
            <th scope="col" className="px-1 pb-2 text-end">{isAr ? 'السابق' : 'Previous'}</th>
            <th scope="col" className="px-1 pb-2 text-end">{isAr ? 'الفرق' : 'Change'}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {(['income', 'expense'] as const).map(type => (
            <tr key={type}>
              <th scope="row" className="py-2 text-start font-bold text-slate-800">
                {type === 'income' ? (isAr ? 'الدخل' : 'Income') : (isAr ? 'المصروفات' : 'Expenses')}
              </th>
              <td className="px-1 text-end"><bdi>{format.format(current[type])}</bdi></td>
              <td className="px-1 text-end"><bdi>{format.format(previous[type])}</bdi></td>
              <td className="px-1 text-end font-bold"><bdi>{formatDifference.format(current[type] - previous[type])}</bdi></td>
            </tr>
          ))}
        </tbody>
      </table>
      {biggestIncrease && (
        <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-xs text-slate-800">
          {isAr ? 'أكبر زيادة في المصروفات' : 'Largest spending increase'}
          {' · '}<strong>{categoryName}</strong>{' · '}
          <bdi>{formatDifference.format(biggestIncrease.amount)} {currency}</bdi>
        </p>
      )}
    </div>
  );
}

export function MonthComparison(props: MonthComparisonProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const isAr = props.lang === 'ar';
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
      <button type="button" aria-expanded={open} aria-controls={panelId}
        onClick={() => setOpen(value => !value)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl px-3.5 py-2 text-start text-sm font-bold text-slate-800 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-500">
        <span className="flex items-center gap-2">
          <CalendarDays aria-hidden="true" className="size-4 shrink-0 text-emerald-700" />
          {isAr ? 'مقارنة هذا الشهر بالشهر السابق' : 'Compare with last month'}
        </span>
        <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-slate-500 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div id={panelId} hidden={!open} className="border-t border-slate-100 p-3.5">
        {open && (props.loadState === 'ready'
          ? <MonthComparisonResults {...props} />
          : <p role="status" className="text-sm text-slate-600">
              {props.loadState === 'error'
                ? (isAr ? 'تعذّر تحميل العمليات للمقارنة.' : 'Transactions could not be loaded for comparison.')
                : (isAr ? 'جارٍ تحميل العمليات…' : 'Loading transactions…')}
            </p>)}
      </div>
    </section>
  );
}
