import { TrendingUp } from 'lucide-react';
import { Transaction, Language } from '../types';
import { translations } from '../data/translations';

interface MonthSummaryCardProps {
  transactions: Transaction[];
  lang: Language;
}

export function MonthSummaryCard({ transactions, lang }: MonthSummaryCardProps) {
  const t = translations[lang];

  // Calculate this month's stats from transactions
  const now = new Date();
  const currentYearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const currentMonthTx = transactions.filter((tx) => tx.date.startsWith(currentYearMonth));

  let expensesTotal = 0;
  let incomeTotal = 0;

  currentMonthTx.forEach((tx) => {
    if (tx.type === 'expense') expensesTotal += tx.amount;
    else if (tx.type === 'income') incomeTotal += tx.amount;
  });

  // If no transactions yet, show the reference aesthetic baseline (3,250 / 12,000 / 8,750) or live calculations
  const hasTx = transactions.length > 0;
  const displayExpenses = hasTx ? expensesTotal : 3250;
  const displayIncome = hasTx ? incomeTotal : 12000;
  const displayNet = hasTx ? displayIncome - displayExpenses : 8750;
  const displayTotal = displayIncome + displayExpenses;

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
      maximumFractionDigits: 0,
    }).format(num);
  };

  // SVG Donut calculation
  const radius = 40;
  const circumference = 2 * Math.PI * radius; // ~251.3
  const totalForChart = Math.max(displayTotal, 1);

  const expenseRatio = displayExpenses / totalForChart;
  const incomeRatio = displayIncome / totalForChart;
  const netRatio = Math.max(displayNet, 0) / totalForChart;

  const expenseDash = expenseRatio * circumference;
  const incomeDash = incomeRatio * circumference;
  const netDash = netRatio * circumference;

  return (
    <section className="space-y-2.5">
      {/* Title */}
      <div className="flex items-center justify-between px-0.5">
        <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
          {t.thisMonthSummary}
        </h2>
      </div>

      {/* Main Card */}
      <div className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4">
          {/* Donut Chart with Center Text */}
          <div className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              {/* Background circle */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="stroke-slate-100"
                strokeWidth="12"
                fill="none"
              />

              {/* Expense Segment (Pink/Rose) */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="stroke-rose-400 transition-all duration-500"
                strokeWidth="12"
                strokeDasharray={`${expenseDash} ${circumference}`}
                strokeDashoffset="0"
                fill="none"
                strokeLinecap="round"
              />

              {/* Income Segment (Emerald/Mint) */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="stroke-emerald-400 transition-all duration-500"
                strokeWidth="12"
                strokeDasharray={`${incomeDash} ${circumference}`}
                strokeDashoffset={-expenseDash}
                fill="none"
                strokeLinecap="round"
              />

              {/* Net Segment (Sky/Blue) */}
              <circle
                cx="50"
                cy="50"
                r={radius}
                className="stroke-sky-400 transition-all duration-500"
                strokeWidth="12"
                strokeDasharray={`${netDash} ${circumference}`}
                strokeDashoffset={-(expenseDash + incomeDash)}
                fill="none"
                strokeLinecap="round"
              />
            </svg>

            {/* Inner Donut Text */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="text-[10px] text-slate-400 font-bold leading-none">
                {t.totalLabel}
              </span>
              <span className="text-sm sm:text-base font-black text-slate-900 leading-tight mt-0.5">
                {formatNumber(hasTx ? displayTotal : 24000)}
              </span>
              <span className="text-[9px] text-slate-400 font-semibold font-mono">
                EGP
              </span>
            </div>
          </div>

          {/* Breakdown Stats */}
          <div className="flex-1 space-y-2">
            {/* Expenses */}
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400 shrink-0" />
                <span>{t.expensesLabel}</span>
              </div>
              <span className="font-extrabold text-slate-900 font-mono">
                {formatNumber(displayExpenses)} EGP
              </span>
            </div>

            {/* Income */}
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
                <span>{t.incomeLabel}</span>
              </div>
              <span className="font-extrabold text-slate-900 font-mono">
                {formatNumber(displayIncome)} EGP
              </span>
            </div>

            {/* Net */}
            <div className="flex items-center justify-between text-xs sm:text-sm">
              <div className="flex items-center gap-1.5 font-bold text-slate-700">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shrink-0" />
                <span>{t.netLabel}</span>
              </div>
              <span className="font-extrabold text-slate-900 font-mono">
                {formatNumber(displayNet)} EGP
              </span>
            </div>
          </div>
        </div>

        {/* Comparison Badge matching reference: +12% بالمقارنة مع الشهر الماضي */}
        <div className="pt-2 border-t border-slate-100 flex items-center justify-start text-[11px] font-bold text-emerald-700">
          <div className="flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
            <span>{t.monthComparison}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
