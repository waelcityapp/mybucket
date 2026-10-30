import { useState, useMemo } from 'react';
import { Wallet, Calendar, Eye, EyeOff, ArrowUpRight, TrendingUp, TrendingDown, ChartNoAxesColumnIncreasing } from 'lucide-react';
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

  const formatNumber = (val: number) => {
    return new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-US', {
      maximumFractionDigits: 2,
    }).format(val);
  };

  const currencyLabel = isAr && primaryCurrency === 'EGP' ? 'ج.م' : primaryCurrency;
  const percent = (value: number) => new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-US', { maximumFractionDigits: 1 }).format(value);

  return (
    <section className="bg-white rounded-[28px] border border-slate-200/90 shadow-sm p-3 sm:p-5 space-y-3">
      <header className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-base sm:text-lg font-black text-slate-950">
          <span className="text-emerald-600"><ChartNoAxesColumnIncreasing size={20}/></span>
          {isAr ? 'الوضع المالي' : 'Financial overview'}
        </h2>
        {onViewAccounts && (
          <button type="button" onClick={onViewAccounts}
            className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 px-2.5 py-2 text-[11px] font-bold text-emerald-900 hover:bg-emerald-50">
            <span>{isAr ? 'تفاصيل الحسابات' : 'Account details'}</span>
            <ArrowUpRight size={13} className={isAr ? 'rotate-[-90deg]' : ''}/>
          </button>
        )}
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-5 items-center rounded-[24px] border border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-emerald-50/60 p-3 sm:p-5">
        <div className="min-w-0 flex items-center gap-3 sm:gap-4">
          <div aria-hidden="true" className="flex shrink-0 items-center justify-center rounded-2xl bg-emerald-100/80 w-[84px] h-[88px] sm:w-28 sm:h-28 text-emerald-700">
            <svg viewBox="0 0 120 120" className="w-full h-full" fill="none" aria-hidden="true"><circle cx="60" cy="60" r="52" fill="#D1FAE5"/><rect x="30" y="25" width="60" height="65" rx="7" transform="rotate(-13 30 25)" fill="#6EE7B7" stroke="#047857" strokeWidth="2"/><path d="M44 40l36-8 8 36-36 8z" fill="#A7F3D0"/><circle cx="64" cy="54" r="10" fill="#059669"/><rect x="15" y="49" width="90" height="52" rx="13" fill="#047857"/><path d="M15 65c0-9 7-16 16-16h59c8 0 15 7 15 16v23c0 7-6 13-13 13H28c-7 0-13-6-13-13z" fill="#059669"/><rect x="71" y="66" width="40" height="23" rx="9" fill="#10B981" stroke="#065F46" strokeWidth="2"/><circle cx="94" cy="77" r="6" fill="#FCD34D"/><ellipse cx="24" cy="103" rx="17" ry="5" fill="#F59E0B"/><path d="M7 98v5c0 5 34 5 34 0v-5" fill="#FBBF24" stroke="#B45309"/><ellipse cx="24" cy="98" rx="17" ry="5" fill="#FDE68A" stroke="#B45309"/></svg>
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex items-center gap-1">
              <span className="text-xs font-bold text-emerald-950">{isAr ? 'إجمالي الرصيد المتاح' : 'Total available balance'}</span>
              <button type="button" onClick={toggleHideBalance}
                aria-label={isBalanceHidden ? (isAr ? 'إظهار الأرقام' : 'Show amounts') : (isAr ? 'إخفاء الأرقام' : 'Hide amounts')}
                className="p-1 text-slate-500 hover:text-slate-900 rounded-md">
                {isBalanceHidden ? <EyeOff size={16}/> : <Eye size={16}/>}
              </button>
            </div>
            <div className="flex flex-wrap items-baseline gap-1.5">
              <strong dir="ltr" className="text-[clamp(24px,5vw,43px)] leading-tight font-black tabular-nums text-emerald-950 break-all">
                {isBalanceHidden ? '••••••' : formatAccountBalance(primaryTotal, lang)}
              </strong>
              {!isBalanceHidden && <span className="text-sm text-emerald-900 font-bold">{currencyLabel}</span>}
            </div>
            <p className="text-[11px] text-emerald-900/80">{isAr ? 'متاح للاستخدام الآن' : 'Available now'}</p>
            {!isBalanceHidden && otherCurrencies.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {otherCurrencies.map(([curr, amt]) => <span key={curr} className="rounded-md bg-white/80 px-1.5 py-0.5 text-[10px] text-slate-700">{formatAccountBalance(amt,lang)} {curr}</span>)}
              </div>
            )}
          </div>
        </div>
        <div className="min-w-0 rounded-2xl border border-slate-100 bg-white/90 p-3 sm:p-4">
          <h3 className="font-extrabold text-xs sm:text-sm text-slate-900 mb-2">{isAr ? 'نسبة الدخل والمصروفات هذا الشهر' : 'Monthly income vs expenses'}</h3>
          <div className="flex h-9 w-full overflow-hidden rounded-full bg-slate-200" role="img"
            aria-label={isAr ? `الدخل ${percent(monthlyComparison.incomePct)} بالمائة، المصروفات ${percent(monthlyComparison.expensePct)} بالمائة` : `Income ${percent(monthlyComparison.incomePct)} percent, expenses ${percent(monthlyComparison.expensePct)} percent`}>
            {monthlyComparison.hasData ? (<>
              <div style={{width:`${monthlyComparison.incomePct}%`}} className="bg-emerald-500 flex items-center justify-center text-[10px] sm:text-xs font-black text-white min-w-0">
                {monthlyComparison.incomePct >= 16 && !isBalanceHidden ? `${percent(monthlyComparison.incomePct)}%` : ''}
              </div>
              <div style={{width:`${monthlyComparison.expensePct}%`}} className="bg-rose-400 flex items-center justify-center text-[10px] sm:text-xs font-black text-white min-w-0">
                {monthlyComparison.expensePct >= 16 && !isBalanceHidden ? `${percent(monthlyComparison.expensePct)}%` : ''}
              </div>
            </>) : <div className="w-full text-center text-[10px] text-slate-500 leading-8">{isAr ? 'لا توجد عمليات هذا الشهر' : 'No transactions this month'}</div>}
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-emerald-700">{isAr ? '● الدخل' : '● Income'} · {isBalanceHidden ? '••' : `${percent(monthlyComparison.incomePct)}%`}</p>
              <p dir="ltr" className="text-start text-base sm:text-xl font-black text-slate-900 break-words">{isBalanceHidden ? '••••' : formatNumber(monthlyComparison.income)} <span className="text-[10px] font-medium">{currencyLabel}</span></p>
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-rose-600">{isAr ? '● المصروفات' : '● Expenses'} · {isBalanceHidden ? '••' : `${percent(monthlyComparison.expensePct)}%`}</p>
              <p dir="ltr" className="text-start text-base sm:text-xl font-black text-slate-900 break-words">{isBalanceHidden ? '••••' : formatNumber(monthlyComparison.expense)} <span className="text-[10px] font-medium">{currencyLabel}</span></p>
            </div>
          </div>
          {monthlyComparison.otherCurrency && <p className="mt-1 text-[10px] text-slate-500">{isAr ? `المقارنة بعملة ${primaryCurrency} فقط، دون تحويل العملات.` : `Comparison in ${primaryCurrency} only; no currency conversion.`}</p>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={onViewTransactions} className="min-w-0 rounded-2xl border border-amber-100 bg-gradient-to-br from-amber-50 to-white p-3 text-start hover:bg-amber-50">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex w-9 h-9 items-center justify-center rounded-full bg-amber-100"><Calendar size={19} className="text-amber-600 shrink-0"/></span>
            <span className="text-[11px] font-bold text-slate-800">{isAr ? 'مصروف اليوم' : 'Today'}</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-1 mt-1">
            <strong dir="ltr" className="text-xl sm:text-2xl font-black text-slate-950 break-all">{isBalanceHidden ? '••••' : formatNumber(todayExpenses)}</strong>
            <span className="text-[10px] text-slate-500">{currencyLabel}</span>
          </div>
          <span className="text-[10px] text-slate-500">{todayCount} {isAr ? 'عمليات' : 'transactions'}</span>
        </button>
        <button type="button" onClick={onViewTransactions} className="min-w-0 rounded-2xl border border-rose-100 bg-gradient-to-br from-rose-50 to-white p-3 text-start hover:bg-rose-50">
          <div className="flex items-center gap-1.5">
            <span className="inline-flex w-9 h-9 items-center justify-center rounded-full bg-rose-100"><Calendar size={19} className="text-rose-500 shrink-0"/></span>
            <span className="text-[11px] font-bold text-slate-800">{isAr ? 'مصروف الشهر' : 'This month'}</span>
          </div>
          <div className="flex flex-wrap items-baseline gap-1 mt-1">
            <strong dir="ltr" className="text-xl sm:text-2xl font-black text-rose-700 break-all">{isBalanceHidden ? '••••' : formatNumber(monthExpenses)}</strong>
            <span className="text-[10px] text-slate-500">{currencyLabel}</span>
          </div>
          <span className="text-[10px] text-slate-500">{new Date().toLocaleDateString(isAr ? 'ar-EG' : 'en-US', {day:'numeric',month:'long'})}</span>
        </button>
      </div>
    </section>
  );
}
