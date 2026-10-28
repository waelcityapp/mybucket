import { Transaction, Language } from '../types';

interface MonthSummaryCardProps {
  transactions: Transaction[];
  lang: Language;
}

export function MonthSummaryCard({ transactions, lang }: MonthSummaryCardProps) {
  const isAr = lang === 'ar';
  const totals = new Map<string, { income: number; expenses: number }>();
  transactions.forEach((tx) => {
    if (tx.type !== 'income' && tx.type !== 'expense') return;
    if (!Number.isFinite(tx.amount) || !tx.currency) return;
    const current = totals.get(tx.currency) || { income: 0, expenses: 0 };
    if (tx.type === 'income') current.income += tx.amount;
    else current.expenses += tx.amount;
    totals.set(tx.currency, current);
  });

  const formatNumber = (num: number) => new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-US', {
    maximumFractionDigits: 2,
  }).format(num);
  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  return (
    <section className="space-y-2.5">
      <h2 className="text-sm sm:text-base font-black text-slate-900 px-0.5">
        {isAr ? 'ملخص الفترة المحددة' : 'Selected period summary'}
      </h2>
      {totals.size === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-5 text-sm font-semibold text-slate-500">
          {isAr ? 'لا توجد عمليات دخل أو مصروفات في هذه الفترة.' : 'No income or expense transactions in this period.'}
        </div>
      ) : Array.from(totals, ([currency, { income, expenses }]) => {
        const percentage = income > 0 ? (expenses / income) * 100 : null;
        const chartLength = percentage === null ? 0 : Math.min(percentage / 100, 1) * circumference;
        const net = income - expenses;
        return (
          <div key={currency} className="bg-white rounded-3xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 shrink-0 flex items-center justify-center" role="img" aria-label={percentage === null ? (isAr ? 'لا يوجد دخل لحساب النسبة' : 'No income to calculate the percentage') : (isAr ? `المصروفات ${formatNumber(percentage)}٪ من الدخل` : `Expenses are ${formatNumber(percentage)}% of income`)}>
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100" aria-hidden="true">
                  <circle cx="50" cy="50" r={radius} className="stroke-slate-100" strokeWidth="10" fill="none" />
                  {percentage !== null && percentage > 0 && <circle cx="50" cy="50" r={radius} className="stroke-rose-400" strokeWidth="10" strokeDasharray={`${chartLength} ${circumference}`} fill="none" strokeLinecap="round" />}
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-2">
                  <span className="text-[10px] text-slate-500 font-bold leading-tight">{isAr ? 'المصروف من الدخل' : 'Spent of income'}</span>
                  <span className="text-base sm:text-lg font-black text-slate-900 leading-tight mt-1" dir="ltr">{percentage === null ? '—' : `${formatNumber(percentage)}%`}</span>
                </div>
              </div>
              <div className="flex-1 min-w-0 space-y-2.5 text-xs sm:text-sm">
                <div className="flex items-center justify-between gap-2"><span className="font-bold text-slate-700">{isAr ? 'الدخل' : 'Income'}</span><span dir="ltr" className="font-extrabold text-emerald-700 text-end">{formatNumber(income)} {currency}</span></div>
                <div className="flex items-center justify-between gap-2"><span className="font-bold text-slate-700">{isAr ? 'المصروفات' : 'Expenses'}</span><span dir="ltr" className="font-extrabold text-[#8e3a42] text-end">{formatNumber(expenses)} {currency}</span></div>
                <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100"><span className="font-bold text-slate-700">{isAr ? 'فرق الفترة' : 'Period difference'}</span><span dir="ltr" className="font-extrabold text-slate-900 text-end">{formatNumber(net)} {currency}</span></div>
              </div>
            </div>
            <p className="pt-2 border-t border-slate-100 text-[11px] leading-relaxed text-slate-500 font-medium">
              {percentage === null
                ? (isAr ? 'لا يوجد دخل مسجل في الفترة لحساب النسبة. فرق الفترة هو الدخل ناقص المصروفات، وليس رصيد الحسابات.' : 'No income was recorded in this period, so the percentage is unavailable. The period difference is income minus expenses, not your account balance.')
                : (isAr ? 'النسبة = المصروفات ÷ الدخل. فرق الفترة هو الدخل ناقص المصروفات، وليس رصيد الحسابات.' : 'Percentage = expenses ÷ income. The period difference is income minus expenses, not your account balance.')}
            </p>
          </div>
        );
      })}
    </section>
  );
}
