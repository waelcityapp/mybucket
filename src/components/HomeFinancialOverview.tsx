import { useState, useMemo } from 'react';
import { Wallet, CalendarDays, Eye, EyeOff, ArrowUpRight, TrendingUp, TrendingDown, ChartNoAxesColumnIncreasing, Info, ChevronLeft } from 'lucide-react';
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
      if (tx.type === 'expense' && tx.currency === primaryCurrency) {
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
  }, [transactions, primaryCurrency]);

  // Income/expense comparison for the current calendar month. Transfers are excluded.
  // Do not combine currencies without conversion.
  const monthlyComparison = useMemo(() => {
    const now = new Date();
    const prefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let income = 0;
    let expense = 0;
    let otherCurrency = false;
    for (const tx of transactions) {
      if (!tx.date.startsWith(prefix) || tx.type === 'transfer') continue;
      if (tx.currency !== primaryCurrency) { otherCurrency = true; continue; }
      if (tx.type === 'income') income += tx.amount;
      if (tx.type === 'expense') expense += tx.amount;
    }
    const combined = income + expense;
    return { income, expense, otherCurrency,
      incomePct: combined > 0 ? income / combined * 100 : 0,
      expensePct: combined > 0 ? expense / combined * 100 : 0,
      hasData: combined > 0 };
  }, [transactions, primaryCurrency]);

  // Real recent spending: seven calendar days for monthly mini chart,
  // and the last five expenses recorded today for the daily mini chart.
  const spendingSparklines = useMemo(() => {
    const now = new Date();
    const dayKey = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
    const lastSeven = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
      return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
    });
    const amounts = new Map(lastSeven.map(date => [date, 0]));
    const todayOperations: Transaction[] = [];
    for (const tx of transactions) {
      if (tx.type !== 'expense' || tx.currency !== primaryCurrency) continue;
      if (amounts.has(tx.date)) amounts.set(tx.date, (amounts.get(tx.date) || 0) + tx.amount);
      if (tx.date === dayKey) todayOperations.push(tx);
    }
    const daily = todayOperations
      .sort((a,b) => (a.dateTime || a.createdAt || '').localeCompare(b.dateTime || b.createdAt || ''))
      .slice(-5)
      .map(tx => tx.amount);
    return { weekly: lastSeven.map(key => amounts.get(key) || 0), daily };
  }, [transactions, primaryCurrency]);
  const currentMonthLabel = new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });

  const formatNumber = (val: number) => {
    return new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-US', {
      maximumFractionDigits: 2,
    }).format(val);
  };

  const currencyLabel = isAr && primaryCurrency === 'EGP' ? 'ج.م' : primaryCurrency;
  const percent = (value: number) => new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-US', { maximumFractionDigits: 1 }).format(value);

  const monthBarsMax = Math.max(1, ...spendingSparklines.weekly);
  const todayBarsMax = Math.max(1, ...spendingSparklines.daily);

  return (
    <section className="@container w-full min-w-0 rounded-[28px] border border-slate-200 bg-white p-3 sm:p-4 shadow-sm space-y-3" aria-label={isAr ? 'ملخص الوضع المالي' : 'Financial overview'}>
      <div className="flex items-center justify-between gap-2 px-1 py-1">
        <h2 className="flex items-center gap-2 whitespace-nowrap text-[15px] sm:text-lg font-black text-slate-950">
          <ChartNoAxesColumnIncreasing size={20} className="text-emerald-600 shrink-0" />
          {isAr ? 'الوضع المالي' : 'Financial overview'}
        </h2>
        {onViewAccounts && (
          <button type="button" onClick={onViewAccounts}
            className="inline-flex shrink-0 min-h-9 items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 sm:px-3 text-[11px] sm:text-xs font-bold text-emerald-950 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-500">
            <span>{isAr ? 'تفاصيل الحسابات' : 'Account details'}</span>
            <ArrowUpRight size={13} className={isAr ? 'rotate-[-90deg]' : ''}/>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 @min-[490px]:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] gap-3 @min-[490px]:gap-0 items-stretch rounded-[23px] border border-emerald-100 bg-gradient-to-br from-[#F0FCF8] via-[#FBFEFC] to-[#F2FCF8] px-3 py-4 sm:p-4">
        {/* The comparison is first in RTL, on the right like the approved reference. */}
        <div className="min-w-0 @min-[490px]:border-e @min-[490px]:border-slate-200 @min-[490px]:pe-3">
          <div className="rounded-2xl bg-white/75 p-2.5 @min-[490px]:p-2.5 @min-[660px]:p-4 h-full">
            <div className="flex items-start gap-1.5 justify-between min-w-0">
              <h3 className="text-[11px] @min-[660px]:text-sm font-extrabold leading-5 text-slate-900">
                {isAr ? 'نسبة الدخل والمصروفات هذا الشهر' : 'Income and expenses this month'}
              </h3>
              <span className="shrink-0 text-slate-700" title={isAr ? 'تُحسب النسب من مجموع الدخل والمصروفات في الشهر، ولا تشمل التحويلات' : 'Percentages compare total income and expenses, excluding transfers'}>
                <Info size={15} />
              </span>
            </div>
            <div className="mt-3 flex h-9 w-full overflow-hidden rounded-full bg-slate-200" role="img"
              aria-label={isBalanceHidden
                ? (isAr ? 'تم إخفاء النسب المالية' : 'Financial percentages hidden')
                : (isAr ? 'الدخل ' + percent(monthlyComparison.incomePct) + ' بالمائة، المصروفات ' + percent(monthlyComparison.expensePct) + ' بالمائة' : 'Income ' + percent(monthlyComparison.incomePct) + ' percent, expenses ' + percent(monthlyComparison.expensePct) + ' percent')}>
              {monthlyComparison.hasData ? (
                <>
                  <div style={{width: monthlyComparison.incomePct + '%'}} className="flex min-w-0 items-center justify-center bg-gradient-to-l from-emerald-500 to-emerald-300 text-[10px] sm:text-xs font-black text-white">
                    {!isBalanceHidden && monthlyComparison.incomePct >= 21 ? percent(monthlyComparison.incomePct) + '%' : ''}
                  </div>
                  <div style={{width: monthlyComparison.expensePct + '%'}} className="flex min-w-0 items-center justify-center bg-gradient-to-l from-rose-400 to-rose-500 text-[10px] sm:text-xs font-black text-white">
                    {!isBalanceHidden && monthlyComparison.expensePct >= 21 ? percent(monthlyComparison.expensePct) + '%' : ''}
                  </div>
                </>
              ) : <span className="m-auto text-[11px] text-slate-500">{isAr ? 'لا توجد عمليات خلال الشهر' : 'No transactions this month'}</span>}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-1.5">
              <div className="min-w-0">
                <div className="flex items-center gap-1 text-emerald-700">
                  <span className="flex shrink-0 items-center justify-center w-6 h-6 rounded-full bg-emerald-100"><TrendingUp size={13}/></span>
                  <span className="min-w-0 text-[10px] @min-[660px]:text-sm font-bold leading-4">{isAr ? 'إجمالي الدخل' : 'Total income'}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-baseline gap-1">
                  <strong dir="ltr" className="whitespace-nowrap text-[clamp(12px,3cqw,23px)] font-black tabular-nums leading-tight text-emerald-950">{isBalanceHidden ? '••••' : formatNumber(monthlyComparison.income)}</strong>
                  <span className="text-[10px] text-slate-600">{currencyLabel}</span>
                </div>
                <p className="text-[10px] font-bold text-emerald-700">{isBalanceHidden ? '••' : percent(monthlyComparison.incomePct) + '%'}</p>
              </div>
              <div className="min-w-0 border-s border-slate-200 ps-2">
                <div className="flex items-center gap-1 text-rose-600">
                  <span className="flex shrink-0 items-center justify-center w-6 h-6 rounded-full bg-rose-100"><TrendingDown size={13}/></span>
                  <span className="min-w-0 text-[10px] @min-[660px]:text-sm font-bold leading-4">{isAr ? 'إجمالي المصروفات' : 'Total expenses'}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-baseline gap-1">
                  <strong dir="ltr" className="whitespace-nowrap text-[clamp(12px,3cqw,23px)] font-black tabular-nums leading-tight text-slate-950">{isBalanceHidden ? '••••' : formatNumber(monthlyComparison.expense)}</strong>
                  <span className="text-[10px] text-slate-600">{currencyLabel}</span>
                </div>
                <p className="text-[10px] font-bold text-rose-600">{isBalanceHidden ? '••' : percent(monthlyComparison.expensePct) + '%'}</p>
              </div>
            </div>
            {monthlyComparison.otherCurrency && <p className="mt-2 text-[10px] leading-4 text-slate-500">{isAr ? 'المقارنة بعملة ' + primaryCurrency + ' فقط، دون تحويل العملات.' : 'Only ' + primaryCurrency + ' is compared; currencies are not combined.'}</p>}
          </div>
        </div>

        {/* Actual balance, never broken across lines. */}
        <div className="min-w-0 border-t border-emerald-100 pt-3 @min-[490px]:border-t-0 @min-[490px]:pt-0 @min-[490px]:ps-3">
          <div className="flex items-center justify-center @min-[490px]:justify-start gap-2 h-full min-w-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] @min-[660px]:text-sm leading-tight font-extrabold text-emerald-950">{isAr ? 'إجمالي الرصيد المتاح' : 'Total available balance'}</span>
                <button type="button" onClick={toggleHideBalance}
                  aria-label={isBalanceHidden ? (isAr ? 'إظهار الأرقام' : 'Show amounts') : (isAr ? 'إخفاء الأرقام' : 'Hide amounts')}
                  className="shrink-0 rounded-md p-1 text-slate-700 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-500">
                  {isBalanceHidden ? <EyeOff size={16}/> : <Eye size={16}/>}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-1 gap-y-0">
                <strong dir="ltr" className="inline-block whitespace-nowrap text-[clamp(24px,5.1cqw,45px)] font-black leading-none tracking-tight tabular-nums text-emerald-950">
                  {isBalanceHidden ? '••••' : formatAccountBalance(primaryTotal, lang)}
                </strong>
                {!isBalanceHidden && <span className="text-[11px] @min-[660px]:text-base font-semibold text-emerald-950">{currencyLabel}</span>}
              </div>
              <p className="mt-2 text-[11px] leading-tight text-emerald-900">{isAr ? 'متاح للاستخدام الآن' : 'Available now'}</p>
              {!isBalanceHidden && otherCurrencies.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">{otherCurrencies.map(([curr,amt])=><span key={curr} className="rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] text-slate-700">{formatAccountBalance(amt,lang)} {curr}</span>)}</div>
              )}
            </div>
            <div className="shrink-0 w-[clamp(54px,11cqw,155px)] h-[clamp(70px,14cqw,160px)] self-center" aria-hidden="true">
              <svg viewBox="0 0 150 160" className="w-full h-full" fill="none">
                <defs>
                  <linearGradient id="mbWalletBody" x1="15" y1="45" x2="140" y2="140" gradientUnits="userSpaceOnUse"><stop stopColor="#24C992"/><stop offset="1" stopColor="#007E56"/></linearGradient>
                  <linearGradient id="mbWalletFlap" x1="100" y1="95" x2="145" y2="115" gradientUnits="userSpaceOnUse"><stop stopColor="#10B981"/><stop offset="1" stopColor="#059669"/></linearGradient>
                  <linearGradient id="mbGold" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#FDE68A"/><stop offset="1" stopColor="#F59E0B"/></linearGradient>
                </defs>
                <circle cx="75" cy="81" r="68" fill="#DEF9EE"/>
                <ellipse cx="77" cy="142" rx="57" ry="9" fill="#8CDDBD" opacity=".35"/>
                <rect x="40" y="25" width="80" height="90" rx="7" transform="rotate(-18 40 25)" fill="#10B981" stroke="#047857" strokeWidth="2"/>
                <path d="M51 50L108 32L128 92L71 111Z" fill="#A7F3D0" stroke="#059669" strokeWidth="2"/>
                <circle cx="89" cy="73" r="14" fill="#10B981"/><path d="M82 73h14" stroke="#047857" strokeWidth="3" strokeLinecap="round"/>
                <rect x="18" y="59" width="118" height="78" rx="17" fill="url(#mbWalletBody)" stroke="#047857" strokeWidth="3"/>
                <path d="M19 83c0-10 9-18 19-18h81c9 0 17 8 17 18v43c0 7-5 11-12 11H31c-7 0-12-5-12-12z" fill="#008A61" opacity=".75"/>
                <rect x="94" y="90" width="52" height="31" rx="12" fill="url(#mbWalletFlap)" stroke="#056847" strokeWidth="2.5"/>
                <circle cx="123" cy="105" r="7.5" fill="#FCD34D" stroke="#E0A622" strokeWidth="1.5"/>
                <ellipse cx="27" cy="139" rx="22" ry="6" fill="#D97706"/><rect x="5" y="132" width="44" height="8" rx="3" fill="#FBBF24"/>
                <ellipse cx="27" cy="132" rx="22" ry="6" fill="#FDE68A" stroke="#D97706"/>
                <circle cx="130" cy="135" r="16" fill="url(#mbGold)" stroke="#D97706" strokeWidth="2"/>
                <circle cx="130" cy="135" r="11" stroke="#FDE68A" strokeWidth="2"/>
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Compact cards, in the same right-to-left order as the reference. */}
      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={onViewTransactions}
          className="min-w-0 rounded-[20px] border border-amber-100 bg-gradient-to-br from-[#FFF9EE] via-white to-[#FFF9EC] px-3 py-3 text-start hover:border-amber-300 focus-visible:outline-2 focus-visible:outline-amber-500">
          <div className="flex items-start gap-2">
            <span className="shrink-0 flex items-center justify-center h-9 w-9 rounded-full bg-amber-100 text-amber-600"><CalendarDays size={20}/></span>
            <div className="min-w-0 flex-1">
              <span className="block text-[11px] sm:text-sm font-extrabold leading-5 text-slate-950">{isAr ? 'مصروف اليوم' : "Today's expenses"}</span>
              <div className="mt-1 flex flex-wrap items-baseline gap-1">
                <strong dir="ltr" className="whitespace-nowrap text-[clamp(17px,3.5cqw,30px)] leading-tight font-black text-slate-950 tabular-nums">{isBalanceHidden ? '••••' : formatNumber(todayExpenses)}</strong>
                <span className="text-[10px] text-slate-600">{currencyLabel}</span>
              </div>
              <span className="mt-1 inline-flex rounded-full bg-white border border-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">{todayCount} {isAr ? 'عمليات' : 'transactions'}</span>
            </div>
          </div>
          <div className="mt-1 flex items-end justify-between gap-2">
            <div className="flex h-8 items-end gap-[3px]" aria-label={isAr ? 'مبالغ العمليات اليوم' : 'Today transaction amounts'}>
              {(spendingSparklines.daily.length ? spendingSparklines.daily : [0,0,0,0,0]).map((amount,i)=><span key={i} className="w-2.5 rounded-t-full bg-amber-200/90" style={{height: (amount > 0 ? 6 + 26 * amount / todayBarsMax : 3) + 'px'}} />)}
            </div>
            <ChevronLeft className={'shrink-0 h-4 w-4 text-slate-800 ' + (!isAr ? 'rotate-180' : '')} />
          </div>
        </button>
        <button type="button" onClick={onViewTransactions}
          className="min-w-0 rounded-[20px] border border-rose-100 bg-gradient-to-br from-[#FFF5F6] via-white to-[#FFF6F7] px-3 py-3 text-start hover:border-rose-300 focus-visible:outline-2 focus-visible:outline-rose-400">
          <div className="flex items-start gap-2">
            <span className="shrink-0 flex items-center justify-center h-9 w-9 rounded-full bg-rose-100 text-rose-500"><CalendarDays size={20}/></span>
            <div className="min-w-0 flex-1">
              <span className="block text-[11px] sm:text-sm font-extrabold leading-5 text-slate-950">{isAr ? 'مصروف الشهر' : 'Monthly expenses'}</span>
              <div className="mt-1 flex flex-wrap items-baseline gap-1">
                <strong dir="ltr" className="whitespace-nowrap text-[clamp(17px,3.5cqw,30px)] leading-tight font-black text-rose-700 tabular-nums">{isBalanceHidden ? '••••' : formatNumber(monthExpenses)}</strong>
                <span className="text-[10px] text-slate-600">{currencyLabel}</span>
              </div>
              <span className="mt-1 block text-[10px] text-slate-500">{currentMonthLabel}</span>
            </div>
          </div>
          <div className="mt-1 flex items-end justify-between gap-2">
            <div className="flex h-8 items-end gap-[3px]" aria-label={isAr ? 'المصروفات في آخر 7 أيام' : 'Expenses during the last 7 days'}>
              {spendingSparklines.weekly.map((amount,i)=><span key={i} className="w-2.5 rounded-t-full bg-rose-200/90" style={{height: (amount > 0 ? 6 + 26 * amount / monthBarsMax : 3) + 'px'}} />)}
            </div>
            <ChevronLeft className={'shrink-0 h-4 w-4 text-slate-800 ' + (!isAr ? 'rotate-180' : '')} />
          </div>
        </button>
      </div>
    </section>
  );
}
