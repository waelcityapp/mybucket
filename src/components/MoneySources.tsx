import { Plus, Pencil, ChevronLeft } from 'lucide-react';
import { FinancialAccount, Language } from '../types';
import { translations } from '../data/translations';

interface MoneySourcesProps {
  accounts: FinancialAccount[];
  lang: Language;
  onViewAll?: () => void;
  onAddAccountClick?: () => void;
  onSelectAccount?: (accId: string) => void;
  onEditBalance?: (accId: string | null) => void;
  onOpenExpenseCategories?: () => void;
}

export function MoneySources({
  accounts,
  lang,
  onViewAll,
  onAddAccountClick,
  onSelectAccount,
  onEditBalance,
  onOpenExpenseCategories,
}: MoneySourcesProps) {
  const t = translations[lang];

  const getAccountEmojiIcon = (type: string) => {
    switch (type) {
      case 'cash':
        return (
          <div className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-100/80 flex items-center justify-center text-lg">
            💰
          </div>
        );
      case 'bank':
        return (
          <div className="w-9 h-9 rounded-2xl bg-blue-50 border border-blue-100/80 flex items-center justify-center text-lg">
            🏛️
          </div>
        );
      case 'card':
        return (
          <div className="w-9 h-9 rounded-2xl bg-purple-50 border border-purple-100/80 flex items-center justify-center text-lg">
            💳
          </div>
        );
      case 'wallet':
        return (
          <div className="w-9 h-9 rounded-2xl bg-cyan-50 border border-cyan-100/80 flex items-center justify-center text-lg">
            📱
          </div>
        );
      case 'savings':
        return (
          <div className="w-9 h-9 rounded-2xl bg-emerald-50 border border-emerald-100/80 flex items-center justify-center text-lg">
            💲
          </div>
        );
      case 'other':
        return (
          <div className="w-9 h-9 rounded-2xl bg-amber-50 border border-amber-100/80 flex items-center justify-center text-lg">
            🔄
          </div>
        );
      case 'custom':
        return (
          <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-lg">
            💼
          </div>
        );
      default:
        return (
          <div className="w-9 h-9 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-lg">
            💼
          </div>
        );
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
      maximumFractionDigits: 2,
    }).format(num);
  };

  // Check if all zero
  const isAllZero = accounts.length > 0 && accounts.every((acc) => acc.balance === 0);

  return (
    <section className="space-y-2.5">
      {/* Header Row: "حساباتك" with black + button on start, "عرض الكل" on end */}
      <div className="flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
            {t.yourAccounts}
          </h2>
          <button
            type="button"
            onClick={onAddAccountClick}
            aria-label={t.addAccount}
            className="w-5 h-5 rounded-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center transition-transform active:scale-90 cursor-pointer shadow-xs"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
          </button>
        </div>

        <button
          type="button"
          onClick={onViewAll}
          className="text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
        >
          {t.viewAll}
        </button>
      </div>

      {/* When all accounts are zero, show friendly prompt to set opening balances */}
      {isAllZero && onEditBalance && (
        <div className="bg-emerald-50/80 border border-emerald-200/70 rounded-2xl p-3 flex items-center justify-between gap-2 text-xs">
          <span className="text-emerald-900 font-bold">
            {lang === 'ar' ? 'أرصدتك حالياً 0. أدخل الرصيد الافتتاحي للبدء:' : 'Balances are 0. Set your initial balances:'}
          </span>
          <button
            type="button"
            onClick={() => onEditBalance(null)}
            className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded-xl shadow-xs transition-colors shrink-0 cursor-pointer"
          >
            {t.setInitialBalances}
          </button>
        </div>
      )}

      {/* Accounts Grid - 3 items top row, 3 items bottom row */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {accounts.map((acc) => {
          const displayName = lang === 'ar' ? acc.nameAr : acc.name;
          return (
            <div
              key={acc.id}
              onClick={() => {
                if (acc.type === 'cash' || acc.id === 'acc_cash') {
                  if (onEditBalance) {
                    onEditBalance(acc.id);
                    return;
                  }
                }
                if (onSelectAccount) {
                  onSelectAccount(acc.id);
                }
              }}
              className="bg-white rounded-2xl border border-slate-200/80 p-2.5 sm:p-3 flex flex-col items-center justify-center text-center shadow-2xs hover:shadow-xs hover:border-slate-300 transition-all cursor-pointer group relative active:scale-95"
            >
              {/* Account Icon */}
              <div className="mb-2 group-hover:scale-105 transition-transform">
                {getAccountEmojiIcon(acc.type)}
              </div>

              {/* Account Name */}
              <span className="text-[11px] sm:text-xs font-bold text-slate-800 line-clamp-2 sm:truncate w-full mb-1 min-h-[2.2em] flex items-center justify-center leading-tight">
                {displayName}
              </span>

              {/* Balance & Currency */}
              <div className="text-[11px] sm:text-xs font-black text-slate-900 tracking-tight flex items-baseline justify-center gap-0.5 w-full">
                <span className="text-[10px] text-slate-400 font-bold font-mono">
                  {acc.currency}
                </span>
                <span className="truncate">{formatNumber(acc.balance)}</span>
              </div>

              {/* Pencil icon for editing balance */}
              {onEditBalance && (
                <button
                  type="button"
                  title={lang === 'ar' ? 'تعديل الرصيد' : 'Edit Balance'}
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditBalance(acc.id);
                  }}
                  className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 w-5 h-5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center transition-opacity cursor-pointer"
                >
                  <Pencil className="w-2.5 h-2.5" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Button for Spending Categories under the 6 accounts boxes */}
      {onOpenExpenseCategories && (
        <div className="pt-0.5">
          <button
            type="button"
            onClick={onOpenExpenseCategories}
            className="w-full bg-white hover:bg-slate-50/90 border border-slate-200/90 hover:border-slate-300 rounded-2xl p-2.5 sm:p-3 flex items-center justify-between shadow-2xs hover:shadow-xs transition-all cursor-pointer group active:scale-[0.99]"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-rose-50 border border-rose-100/80 flex items-center justify-center text-rose-600 text-base shadow-2xs group-hover:scale-105 transition-transform shrink-0">
                🏷️
              </div>
              <div className="text-start">
                <div className="flex items-center gap-2">
                  <span className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                    {lang === 'ar' ? 'بنود الصرف' : 'Spending Categories'}
                  </span>
                  <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded-md">
                    {lang === 'ar' ? 'تعديل وإضافة' : 'Edit & Add'}
                  </span>
                </div>
                <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium">
                  {lang === 'ar'
                    ? 'عرض وتعديل بنود الصرف الحالية وإضافة حتى 10 بنود جديدة'
                    : 'Manage spending items & add up to 10 custom items'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-slate-400 group-hover:text-slate-700 transition-colors shrink-0">
              <span className="text-xs font-bold text-slate-600 hidden sm:inline">
                {lang === 'ar' ? 'عرض القائمة' : 'View list'}
              </span>
              <ChevronLeft className={`w-4 h-4 ${lang === 'ar' ? '' : 'rotate-180'}`} />
            </div>
          </button>
        </div>
      )}
    </section>
  );
}
