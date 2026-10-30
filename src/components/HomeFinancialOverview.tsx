import { useState, useMemo } from 'react';
import { Wallet, TrendingDown, Calendar, Eye, EyeOff, ArrowUpRight } from 'lucide-react';
import { FinancialAccount, Transaction, Language } from '../types';
import { formatAccountBalance } from '../utils/formatBalance';

interface HomeFinancialOverviewProps {
  accounts: FinancialAccount[];
  transactions: Transaction[];
  lang: Language;
  onViewTransactions?: () => void;
  onViewAccounts?: () => void;
}

export function HomeFinancialOverview({
  accounts,
  transactions,
  lang,
  onViewTransactions,
  onViewAccounts,
}: HomeFinancialOverviewProps) {
  const isAr = lang === 'ar';
  const [isBalanceHidden, setIsBalanceHidden] = useState<boolean>(() => {
    return localStorage.getItem('hide_financial_balance') === 'true';
  });

  const toggleHideBalance = () => {
    setIsBalanceHidden((prev) => {
      const next = !prev;
      localStorage.setItem('hide_financial_balance', String(next));
      return next;
    });
  };

  // Group balances by currency
  const balancesByCurrency = useMemo(() => {
    const map: Record<string, number> = {};
    accounts.forEach((acc) => {
      if (acc.linkedBankId || acc.type === 'credit') return;
      const curr = acc.currency || 'EGP';
      map[curr] = (map[curr] || 0) + (acc.balance || 0);
    });
    return map;
  }, [accounts]);

  // Primary currency and total
  const primaryCurrency = accounts[0]?.currency || 'EGP';
  const primaryTotal = balancesByCurrency[primaryCurrency] ?? 0;
  const otherCurrencies = Object.entries(balancesByCurrency).filter(([curr]) => curr !== primaryCurrency);

  // Today and Month calculations
  const { todayExpenses, monthExpenses, todayCount } = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    let todayExp = 0;
    let todayCnt = 0;
    let monthExp = 0;

    transactions.forEach((tx) => {
      if (tx.type === 'expense') {
        if (tx.date === todayStr) {
          todayExp += tx.amount;
          todayCnt += 1;
        }
        if (tx.date.startsWith(monthPrefix)) {
          monthExp += tx.amount;
        }
      }
    });

    return {
      todayExpenses: todayExp,
      todayCount: todayCnt,
      monthExpenses: monthExp,
    };
  }, [transactions]);

  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const spendingDays = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const days = Array.from({length:7}, (_, i) => {
      const date = new Date(now); date.setDate(now.getDate() - 6 + i);
      const key = [date.getFullYear(), String(date.getMonth()+1).padStart(2,'0'), String(date.getDate()).padStart(2,'0')].join('-');
      return { key, date, amount:0, count:0 };
    });
    const lookup = new Map(days.map(d => [d.key,d]));
    transactions.forEach(tx => {
      if(tx.type !== 'expense' || tx.currency !== primaryCurrency) return;
      const day = lookup.get(tx.date);
      if(day) { day.amount += tx.amount; day.count++; }
    });
    return days;
  }, [transactions, primaryCurrency]);
  const maxSpending = Math.max(1, ...spendingDays.map(d => d.amount));
  const pickedDay = spendingDays.find(d => d.key === selectedDay);
  const otherCurrenciesExist = transactions.some(tx => tx.type === 'expense' && tx.currency !== primaryCurrency && spendingDays.some(d => d.key === tx.date));

  const formatNumber = (val: number) => {
    return new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-US', {
      maximumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-3 sm:p-4 space-y-2.5">
      {/* Top row: Total Net Balance */}
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5 text-emerald-600" />
              {isAr ? 'إجمالي الرصيد المتاح' : 'Total Net Balance'}
            </span>
            <button
              type="button"
              onClick={toggleHideBalance}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors cursor-pointer"
              title={isBalanceHidden ? (isAr ? 'إظهار الرصيد' : 'Show balance') : (isAr ? 'إخفاء الرصيد' : 'Hide balance')}
            >
              {isBalanceHidden ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="flex items-baseline gap-2">
            {isBalanceHidden ? (
              <span className="text-2xl sm:text-3xl font-black text-slate-800 tracking-wider">
                ••••••••
              </span>
            ) : (
              <>
                <span className="text-2xl sm:text-3xl font-black text-slate-900">
                  {formatAccountBalance(primaryTotal, lang)}
                </span>
                <span className="text-xs sm:text-sm font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                  {isAr ? (primaryCurrency === 'EGP' ? 'ج.م' : primaryCurrency) : primaryCurrency}
                </span>
              </>
            )}
          </div>

          {/* Secondary currencies if user has multi-currency accounts */}
          {!isBalanceHidden && otherCurrencies.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 pt-0.5">
              {otherCurrencies.map(([curr, amt]: [string, number]) => (
                <span key={curr} className="text-[11px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md">
                  {formatAccountBalance(amt, lang)} {curr}
                </span>
              ))}
            </div>
          )}
        </div>

        {onViewAccounts && (
          <button
            type="button"
            onClick={onViewAccounts}
            className="flex items-center gap-1 text-[11px] font-bold text-slate-600 hover:text-emerald-700 bg-slate-50 hover:bg-slate-100 px-2.5 py-1.5 rounded-xl border border-slate-200 transition-colors cursor-pointer"
          >
            <span>{isAr ? 'تفاصيل الحسابات' : 'Accounts'}</span>
            <ArrowUpRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-[-90deg]' : ''}`} />
          </button>
        )}
      </div>

      {/* Quick Indicators: Today's Spending & This Month's Spending */}
      <div className="grid grid-cols-2 gap-2">
        {/* Today's spending */}
        <div
          onClick={onViewTransactions}
          className="p-2.5 bg-slate-50 hover:bg-rose-50/40 rounded-2xl border border-slate-200/80 transition-all cursor-pointer flex items-center justify-between gap-2"
        >
          <div className="flex min-w-0 items-center gap-1 text-slate-500">
            <span className="text-[11px] font-bold flex items-center gap-1 text-slate-600">
              <TrendingDown className="w-3 h-3 text-rose-500" />
              {isAr ? 'مصروف اليوم' : 'Today'}
            </span>
            {todayCount > 0 && (
              <span className="text-[10px] font-bold bg-white text-slate-600 px-1.5 py-0.5 rounded-full border border-slate-200">
                {todayCount} {isAr ? 'عمليات' : 'tx'}
              </span>
            )}
          </div>
          <div className="border-s border-slate-300 ps-2 text-xs sm:text-sm font-black text-slate-900 whitespace-nowrap">
            {isBalanceHidden ? '••••' : formatNumber(todayExpenses)}{' '}
            <span className="text-[11px] font-semibold text-slate-500">
              {isAr ? (primaryCurrency === 'EGP' ? 'ج.م' : primaryCurrency) : primaryCurrency}
            </span>
          </div>
        </div>

        {/* This Month's spending */}
        <div
          onClick={onViewTransactions}
          className="p-2.5 bg-slate-50 hover:bg-emerald-50/40 rounded-2xl border border-slate-200/80 transition-all cursor-pointer flex items-center justify-between gap-2"
        >
          <div className="flex min-w-0 items-center gap-1 text-slate-500">
            <span className="text-[11px] font-bold flex items-center gap-1 text-slate-600">
              <Calendar className="w-3 h-3 text-emerald-600" />
              {isAr ? 'مصروف الشهر' : 'This Month'}
            </span>
          </div>
          <div className="border-s border-slate-300 ps-2 text-xs sm:text-sm font-black text-slate-900 whitespace-nowrap">
            {isBalanceHidden ? '••••' : formatNumber(monthExpenses)}{' '}
            <span className="text-[11px] font-semibold text-slate-500">
              {isAr ? (primaryCurrency === 'EGP' ? 'ج.م' : primaryCurrency) : primaryCurrency}
            </span>
          </div>
        </div>
      </div>
      {/* Interactive seven-day expenses: based only on actual transactions in primary currency. */}
      <section className="rounded-2xl border border-emerald-100 bg-emerald-50/40 p-3 sm:p-4">
        <div className="flex justify-between items-center gap-2 mb-2">
          <div>
            <h3 className="text-xs sm:text-sm font-extrabold text-slate-900">{isAr ? 'نبض مصروفاتك' : 'Spending pulse'}</h3>
            <p className="text-[10px] text-slate-500">{isAr ? 'آخر 7 أيام بما فيها اليوم' : 'Last 7 days including today'} · {primaryCurrency}</p>
          </div>
          <TrendingDown className="w-4 h-4 text-emerald-600" />
        </div>
        <div className="grid grid-cols-7 gap-1 sm:gap-2" role="group" aria-label={isAr ? 'مصروفات آخر سبعة أيام' : 'Seven-day expenses'}>
          {spendingDays.map(day => {
            const height = day.amount > 0 ? Math.max(7, 72 * day.amount / maxSpending) : 3;
            const selected = selectedDay === day.key;
            return <button key={day.key} type="button" onClick={() => setSelectedDay(day.key)}
              aria-pressed={selected}
              aria-label={`${day.date.toLocaleDateString(isAr ? 'ar-EG' : 'en-US')}: ${formatNumber(day.amount)} ${primaryCurrency}, ${day.count}`}
              className={`min-w-0 rounded-lg flex flex-col items-center gap-1 p-1 hover:bg-white/70 focus-visible:outline-2 focus-visible:outline-emerald-600 ${selected ? 'bg-white ring-1 ring-emerald-300' : ''}`}>
              <span dir="ltr" className="text-[9px] sm:text-[10px] font-bold text-slate-700 tabular-nums">{isBalanceHidden ? '••' : formatNumber(day.amount)}</span>
              <span className="h-[76px] w-full flex items-end justify-center">
                <span className={`block w-full max-w-7 rounded-t-md ${day.amount > 0 && day.amount === maxSpending ? 'bg-rose-400' : 'bg-emerald-400'}`} style={{height:`${height}px`}} />
              </span>
              <span className="w-full truncate text-center text-[9px] sm:text-[10px] text-slate-600">{day.date.toLocaleDateString(isAr ? 'ar-EG' : 'en-US',{weekday:'short'})}</span>
            </button>;
          })}
        </div>
        <p className="text-[11px] text-slate-700 font-medium mt-2" aria-live="polite">
          {pickedDay
            ? isBalanceHidden ? (isAr ? 'الأرقام مخفية، استخدم زر العين لإظهارها' : 'Amounts are hidden; use the eye button to reveal')
              : `${pickedDay.date.toLocaleDateString(isAr ? 'ar-EG' : 'en-US',{day:'numeric',month:'short'})}: ${formatNumber(pickedDay.amount)} ${primaryCurrency} · ${pickedDay.count} ${isAr ? 'عملية' : 'transactions'}`
            : (isAr ? 'اضغط على أي عمود لمعرفة المبلغ وعدد العمليات' : 'Tap a bar to see the amount and transaction count')}
        </p>
        {otherCurrenciesExist && <p className="text-[10px] text-slate-500 mt-1">{isAr ? `الرسم يعرض ${primaryCurrency} فقط، ولا يجمع العملات المختلفة.` : `Showing ${primaryCurrency} only; currencies are not combined.`}</p>}
      </section>
    </div>
  );
}
