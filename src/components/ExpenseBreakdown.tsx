import { useId, useMemo, useState } from 'react';
import { BarChart3, ChevronDown } from 'lucide-react';
import type { Category, Language, Transaction } from '../types';
import { formatDateTimeDisplay } from '../utils/dateTime';

interface ExpenseGroup {
  categoryId: string | undefined;
  amount: number;
  transactions: Transaction[];
}

export function groupExpensesByCurrency(transactions: Transaction[]) {
  const currencies = new Map<string, Map<string | undefined, ExpenseGroup>>();
  for (const tx of transactions) {
    if (tx.type !== 'expense' || !tx.currency || !Number.isFinite(tx.amount)) continue;
    let groups = currencies.get(tx.currency);
    if (!groups) {
      groups = new Map();
      currencies.set(tx.currency, groups);
    }
    const categoryId = tx.categoryId || undefined;
    let group = groups.get(categoryId);
    if (!group) {
      group = { categoryId, amount: 0, transactions: [] };
      groups.set(categoryId, group);
    }
    group.amount += tx.amount;
    group.transactions.push(tx);
  }

  const result = new Map<string, ExpenseGroup[]>();
  for (const [currency, groups] of currencies) {
    const ranked = [...groups.values()].filter(group => group.amount > 0)
      .sort((a, b) => b.amount - a.amount);
    if (ranked.length) result.set(currency, ranked);
  }
  return result;
}

interface ExpenseBreakdownProps {
  transactions: Transaction[];
  categories: Category[];
  lang: Language;
}

function ExpenseChart({ transactions, categories, lang }: ExpenseBreakdownProps) {
  const isAr = lang === 'ar';
  const [selectedCurrency, setSelectedCurrency] = useState('');
  const [selection, setSelection] = useState<{ currency: string; group: ExpenseGroup } | null>(null);
  const chartId = useId();
  const grouped = useMemo(() => groupExpensesByCurrency(transactions), [transactions]);
  const currencies = [...grouped.keys()].sort();
  const currency = grouped.has(selectedCurrency) ? selectedCurrency
    : grouped.has('EGP') ? 'EGP' : currencies[0];
  const groups = grouped.get(currency);
  if (!groups?.length) {
    return <p className="text-sm text-slate-600">
      {isAr ? 'لا توجد مصروفات في الفترة المحددة.' : 'No expenses in the selected period.'}
    </p>;
  }

  const categoriesById = new Map(categories.map(category => [category.id, category]));
  const categoryName = (group: ExpenseGroup) => {
    if (!group.categoryId) return isAr ? 'بدون تصنيف' : 'Uncategorized';
    const category = categoriesById.get(group.categoryId);
    return category ? (isAr ? category.nameAr || category.name : category.name || category.nameAr)
      : (isAr ? 'بند غير متاح' : 'Unavailable category');
  };
  const number = new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-US', { maximumFractionDigits: 2 });
  const amount = (value: number) => `${number.format(value)} ${currency}`;
  const highest = groups[0];
  const lowest = groups[groups.length - 1];
  const highlights = groups.length === 1
    ? [{ label: isAr ? 'البند الوحيد اللي عليه صرف' : 'Only category with expenses', group: highest }]
    : amount(highest.amount) === amount(lowest.amount)
      ? [{ label: isAr ? 'كل البنود متساوية في الصرف' : 'All categories have equal spending', group: highest, equal: true }]
      : [
        { label: isAr ? 'الأعلى صرفًا' : 'Highest spending', group: highest },
        { label: isAr ? 'الأقل صرفًا' : 'Lowest spending', group: lowest },
      ];

  return (
    <div className="space-y-3">
      {currencies.length > 1 && (
        <label className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-700">
          {isAr ? 'العملة' : 'Currency'}
          <select value={currency} onChange={event => {
            setSelectedCurrency(event.target.value);
            setSelection(null);
          }} className="min-h-9 rounded-lg border border-slate-200 bg-white px-2 text-slate-900">
            {currencies.map(code => <option key={code} value={code}>{code}</option>)}
          </select>
        </label>
      )}

      <dl className="grid gap-2 grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))]">
        {highlights.map(({ label, group, equal }) => (
          <div key={label} className="min-w-0 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
            <dt className="text-xs font-bold text-emerald-800">{label}</dt>
            <dd className="mt-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 break-words text-sm font-bold text-slate-900">
              {!equal && <span>{categoryName(group)}</span>}
              <bdi className="text-emerald-800">{amount(group.amount)}</bdi>
            </dd>
          </div>
        ))}
      </dl>

      <ul className="space-y-2">
        {groups.map((group, index) => {
          const panelId = `${chartId}-${index}`;
          const isOpen = selection?.currency === currency && selection.group === group;
          const color = categoriesById.get(group.categoryId ?? '')?.color || '#059669';
          return (
            <li key={panelId} className="rounded-xl border border-slate-200 bg-white">
              <button type="button" aria-expanded={isOpen} aria-controls={panelId}
                onClick={() => setSelection(isOpen ? null : { currency, group })}
                className="block w-full rounded-xl px-3 py-2.5 text-start hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-emerald-500">
                <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs font-bold text-slate-800">
                  <span className="min-w-0 break-words">{categoryName(group)}</span>
                  <span className="flex items-center gap-1.5">
                    <bdi>{amount(group.amount)}</bdi>
                    <ChevronDown aria-hidden="true" className={`size-4 text-slate-500 ${isOpen ? 'rotate-180' : ''}`} />
                  </span>
                </span>
                <span aria-hidden="true" className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <span className="block h-full rounded-full"
                    style={{ inlineSize: `${group.amount / highest.amount * 100}%`, backgroundColor: color }} />
                </span>
              </button>
              <div id={panelId} hidden={!isOpen} className="border-t border-slate-100 px-3">
                {isOpen && <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto text-xs">
                  {group.transactions.map(tx => (
                    <li key={tx.id} className="space-y-1 py-2">
                      <div className="flex flex-wrap justify-between gap-x-2 gap-y-1">
                        <span className="text-slate-600">{formatDateTimeDisplay(tx.date || tx.createdAt?.split('T')[0] || '', tx.time, tx.dateTime, lang)}</span>
                        <bdi className="font-bold text-slate-900">{amount(tx.amount)}</bdi>
                      </div>
                      {tx.description && <p className="break-words text-slate-700">{tx.description}</p>}
                    </li>
                  ))}
                </ul>}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ExpenseBreakdown(props: ExpenseBreakdownProps) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const isAr = props.lang === 'ar';

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xs">
      <button type="button" aria-expanded={open} aria-controls={panelId}
        onClick={() => setOpen(value => !value)}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-2xl px-3.5 py-2 text-start text-sm font-bold text-slate-800 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-500">
        <span className="flex items-center gap-2">
          <BarChart3 aria-hidden="true" className="size-4 shrink-0 text-emerald-700" />
          {isAr ? 'تحليل المصروفات حسب البند' : 'Spending by category'}
        </span>
        <ChevronDown aria-hidden="true" className={`size-4 shrink-0 text-slate-500 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div id={panelId} hidden={!open} className="border-t border-slate-100 p-3.5">
        {open && <ExpenseChart {...props} />}
      </div>
    </section>
  );
}
