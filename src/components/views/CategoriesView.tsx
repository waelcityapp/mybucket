import React, { useState, useMemo } from 'react';
import {
  Coffee,
  Briefcase,
  ShoppingCart,
  Receipt,
  ShoppingBag,
  HeartPulse,
  Coins,
  TrendingUp,
  MoreHorizontal,
  Car,
  ChevronLeft,
  Filter,
  Calendar,
  Layers,
} from 'lucide-react';
import { Category, Transaction, Language, AuthUser } from '../../types';
import { translations } from '../../data/translations';
import { getCurrentLocalDate } from '../../utils/dateTime';
import { getUserDateLimits, getAvailableMonthsForYear } from '../../utils/userRegistration';

interface CategoriesViewProps {
  categories: Category[];
  transactions: Transaction[];
  lang: Language;
  authUser?: AuthUser | null;
  onSelectCategory?: (cat: Category) => void;
}

type ViewPeriod = 'this_month' | 'last_month' | 'specific_month' | 'specific_year' | 'custom_range';

export function CategoriesView({
  categories,
  transactions,
  lang,
  authUser,
  onSelectCategory,
}: CategoriesViewProps) {
  const t = translations[lang];
  const isAr = lang === 'ar';

  const userDateLimits = useMemo(
    () => getUserDateLimits(authUser, transactions),
    [authUser, transactions]
  );

  const currentYear = userDateLimits.currentYear;
  const currentMonth = userDateLimits.currentMonth;

  // View-level Period State
  const [period, setPeriod] = useState<ViewPeriod>('this_month');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    const startOfMonth = d.toISOString().split('T')[0];
    return startOfMonth < userDateLimits.startDateStr ? userDateLimits.startDateStr : startOfMonth;
  });
  const [customEnd, setCustomEnd] = useState<string>(() => getCurrentLocalDate());

  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const incomeCategories = categories.filter((c) => c.type === 'income');

  const allMonthsList = [
    { value: 1, nameAr: 'يناير (01)', nameEn: 'Jan (01)' },
    { value: 2, nameAr: 'فبراير (02)', nameEn: 'Feb (02)' },
    { value: 3, nameAr: 'مارس (03)', nameEn: 'Mar (03)' },
    { value: 4, nameAr: 'أبريل (04)', nameEn: 'Apr (04)' },
    { value: 5, nameAr: 'مايو (05)', nameEn: 'May (05)' },
    { value: 6, nameAr: 'يونيو (06)', nameEn: 'Jun (06)' },
    { value: 7, nameAr: 'يوليو (07)', nameEn: 'Jul (07)' },
    { value: 8, nameAr: 'أغسطس (08)', nameEn: 'Aug (08)' },
    { value: 9, nameAr: 'سبتمبر (09)', nameEn: 'Sep (09)' },
    { value: 10, nameAr: 'أكتوبر (10)', nameEn: 'Oct (10)' },
    { value: 11, nameAr: 'نوفمبر (11)', nameEn: 'Nov (11)' },
    { value: 12, nameAr: 'ديسمبر (12)', nameEn: 'Dec (12)' },
  ];

  const availableMonths = useMemo(() => {
    return getAvailableMonthsForYear(selectedYear, userDateLimits, allMonthsList);
  }, [selectedYear, userDateLimits]);

  const yearsList = userDateLimits.yearsList;

  const getCategoryIcon = (iconName?: string) => {
    if (!iconName) return '🏷️';
    if (iconName.length <= 4) return iconName; // Emoji
    switch (iconName) {
      case 'Coffee': return <Coffee className="w-5 h-5" />;
      case 'Briefcase': return <Briefcase className="w-5 h-5" />;
      case 'ShoppingCart': return <ShoppingCart className="w-5 h-5" />;
      case 'Receipt': return <Receipt className="w-5 h-5" />;
      case 'ShoppingBag': return <ShoppingBag className="w-5 h-5" />;
      case 'HeartPulse': return <HeartPulse className="w-5 h-5" />;
      case 'Coins': return <Coins className="w-5 h-5" />;
      case 'TrendingUp': return <TrendingUp className="w-5 h-5" />;
      case 'Car': return <Car className="w-5 h-5" />;
      default: return <MoreHorizontal className="w-5 h-5" />;
    }
  };

  // Filter transactions according to selected period
  const getCategoryPeriodTotal = (catId: string) => {
    const matching = transactions.filter((tx) => {
      if (tx.categoryId !== catId) return false;
      const txDateStr = tx.date || tx.createdAt?.split('T')[0] || '';
      if (!txDateStr) return period === 'all_time';

      const txDate = new Date(txDateStr);
      const txYear = txDate.getFullYear();
      const txMonth = txDate.getMonth() + 1;

      switch (period) {
        case 'this_month':
          return txYear === currentYear && txMonth === currentMonth;
        case 'last_month': {
          const lYear = currentMonth === 1 ? currentYear - 1 : currentYear;
          const lMonth = currentMonth === 1 ? 12 : currentMonth - 1;
          return txYear === lYear && txMonth === lMonth;
        }
        case 'specific_month':
          return txYear === selectedYear && txMonth === selectedMonth;
        case 'specific_year':
          return txYear === selectedYear;
        case 'custom_range':
          if (!customStart && !customEnd) return true;
          if (customStart && txDateStr < customStart) return false;
          if (customEnd && txDateStr > customEnd) return false;
          return true;
        default:
          return txYear === currentYear && txMonth === currentMonth;
      }
    });

    const sum = matching.reduce((acc, tx) => acc + tx.amount, 0);
    return { sum, count: matching.length };
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-US', {
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            {t.categoriesTitle}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {isAr
              ? 'اضغط على أي بند لعرض كشف المعاملات المسجلة فيه، الفترات الزمنية، وتعديل أي عملية'
              : 'Click any category to inspect its transaction history and filter by date/period'}
          </p>
        </div>
      </div>

      {/* Global Period Filter Selector */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-3.5 sm:p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-xs font-black text-slate-800 flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-600" />
            <span>{isAr ? 'الفترة الزمنية المعروضة:' : 'Display Period:'}</span>
          </span>

          <div className="flex items-center gap-1 flex-wrap">
            <button
              type="button"
              onClick={() => setPeriod('this_month')}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                period === 'this_month'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {isAr ? 'هذا الشهر' : 'This Month'}
            </button>
            {userDateLimits.hasPriorMonth && (
              <button
                type="button"
                onClick={() => setPeriod('last_month')}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  period === 'last_month'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {isAr ? 'الشهر السابق' : 'Last Month'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setPeriod('specific_month')}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                period === 'specific_month'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {isAr ? 'شهر محدد' : 'Specific Month'}
            </button>
            <button
              type="button"
              onClick={() => setPeriod('specific_year')}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                period === 'specific_year'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {isAr ? 'سنة محددة' : 'Specific Year'}
            </button>
            <button
              type="button"
              onClick={() => setPeriod('custom_range')}
              className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                period === 'custom_range'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {isAr ? 'فترة مخصصة' : 'Custom Range'}
            </button>
          </div>
        </div>

        {/* Dynamic Controls for Specific Month / Year / Custom Range */}
        {period === 'specific_month' && (
          <div className="flex items-center gap-2 pt-1 flex-wrap border-t border-slate-100 pt-2.5">
            <div className="flex-1 min-w-[130px]">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                {isAr ? 'اختر الشهر:' : 'Select Month:'}
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-hidden"
              >
                {availableMonths.map((m) => (
                  <option key={m.value} value={m.value}>
                    {isAr ? m.nameAr : m.nameEn}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-28">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                {isAr ? 'السنة:' : 'Year:'}
              </label>
              <select
                value={selectedYear}
                onChange={(e) => {
                  const y = Number(e.target.value);
                  setSelectedYear(y);
                  const validMonths = getAvailableMonthsForYear(y, userDateLimits, allMonthsList);
                  if (!validMonths.some((m) => m.value === selectedMonth)) {
                    setSelectedMonth(validMonths[validMonths.length - 1]?.value || 1);
                  }
                }}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-hidden"
              >
                {yearsList.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {period === 'specific_year' && (
          <div className="flex items-center gap-2 pt-1 border-t border-slate-100 pt-2.5">
            <div className="w-36">
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                {isAr ? 'اختر السنة:' : 'Select Year:'}
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-hidden"
              >
                {yearsList.map((y) => (
                  <option key={y} value={y}>
                    {isAr ? `سنة ${y}` : `Year ${y}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {period === 'custom_range' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-slate-100 pt-2.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                {isAr ? 'من تاريخ:' : 'From Date:'}
              </label>
              <input
                type="date"
                value={customStart}
                min={userDateLimits.startDateStr}
                max={userDateLimits.currentDateStr}
                onChange={(e) => setCustomStart(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-hidden"
              />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-slate-500 mb-1">
                {isAr ? 'إلى تاريخ:' : 'To Date:'}
              </label>
              <input
                type="date"
                value={customEnd}
                min={userDateLimits.startDateStr}
                max={userDateLimits.currentDateStr}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1.5 text-xs font-bold text-slate-800 outline-hidden"
              />
            </div>
          </div>
        )}
      </div>

      {/* Expense Categories */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shadow-xs" />
            <span>{t.expenseCategories}</span>
            <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.2 rounded-full">
              {expenseCategories.length} {isAr ? 'بند' : 'items'}
            </span>
          </h2>
          <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">
            {isAr ? '💡 انقر على أي بند لفتح كشف عملياته وتعديلها' : '💡 Click any category to view transactions'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {expenseCategories.map((cat) => {
            const { sum, count } = getCategoryPeriodTotal(cat.id);
            return (
              <button
                type="button"
                key={cat.id}
                onClick={() => onSelectCategory && onSelectCategory(cat)}
                className="bg-white hover:bg-slate-50/90 border border-slate-200/90 hover:border-rose-300 rounded-2xl p-3.5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between text-start cursor-pointer group active:scale-[0.99] relative overflow-hidden"
              >
                <div className="flex items-center justify-between gap-2 mb-2.5 w-full">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-base shadow-2xs group-hover:scale-105 transition-transform shrink-0"
                      style={{ backgroundColor: cat.color || '#ef4444' }}
                    >
                      {getCategoryIcon(cat.icon)}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-black text-slate-800 truncate block group-hover:text-rose-600 transition-colors">
                        {isAr ? cat.nameAr : cat.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {count} {isAr ? 'عملية مسجلة' : 'txs'}
                      </span>
                    </div>
                  </div>

                  <div className="w-6 h-6 rounded-full bg-slate-100 group-hover:bg-rose-50 flex items-center justify-center text-slate-400 group-hover:text-rose-600 transition-colors shrink-0">
                    <ChevronLeft className={`w-3.5 h-3.5 ${isAr ? '' : 'rotate-180'}`} />
                  </div>
                </div>

                <div className="flex items-baseline justify-between border-t border-slate-100 pt-2 w-full">
                  <span className="text-[10px] font-bold text-slate-400">
                    {isAr ? 'إجمالي المنصرف' : 'Total spent'}
                  </span>
                  <div className="text-xs sm:text-sm font-black text-rose-600">
                    <span>{formatNumber(sum)}</span>
                    <span className="text-[10px] font-bold text-slate-400"> EGP</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Income Categories */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-slate-800 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-xs" />
            <span>{t.incomeCategories}</span>
            <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-0.2 rounded-full">
              {incomeCategories.length} {isAr ? 'بند' : 'items'}
            </span>
          </h2>
          <span className="text-[11px] font-bold text-slate-400 hidden sm:inline">
            {isAr ? '💡 انقر على أي بند لفتح كشف عملياته وتعديلها' : '💡 Click any category to view transactions'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
          {incomeCategories.map((cat) => {
            const { sum, count } = getCategoryPeriodTotal(cat.id);
            return (
              <button
                type="button"
                key={cat.id}
                onClick={() => onSelectCategory && onSelectCategory(cat)}
                className="bg-white hover:bg-slate-50/90 border border-slate-200/90 hover:border-emerald-300 rounded-2xl p-3.5 shadow-2xs hover:shadow-xs transition-all flex flex-col justify-between text-start cursor-pointer group active:scale-[0.99] relative overflow-hidden"
              >
                <div className="flex items-center justify-between gap-2 mb-2.5 w-full">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-base shadow-2xs group-hover:scale-105 transition-transform shrink-0"
                      style={{ backgroundColor: cat.color || '#10b981' }}
                    >
                      {getCategoryIcon(cat.icon)}
                    </div>
                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-black text-slate-800 truncate block group-hover:text-emerald-600 transition-colors">
                        {isAr ? cat.nameAr : cat.name}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {count} {isAr ? 'عملية مسجلة' : 'txs'}
                      </span>
                    </div>
                  </div>

                  <div className="w-6 h-6 rounded-full bg-slate-100 group-hover:bg-emerald-50 flex items-center justify-center text-slate-400 group-hover:text-emerald-600 transition-colors shrink-0">
                    <ChevronLeft className={`w-3.5 h-3.5 ${isAr ? '' : 'rotate-180'}`} />
                  </div>
                </div>

                <div className="flex items-baseline justify-between border-t border-slate-100 pt-2 w-full">
                  <span className="text-[10px] font-bold text-slate-400">
                    {isAr ? 'إجمالي المقبوض' : 'Total income'}
                  </span>
                  <div className="text-xs sm:text-sm font-black text-emerald-600">
                    <span>{formatNumber(sum)}</span>
                    <span className="text-[10px] font-bold text-slate-400"> EGP</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
