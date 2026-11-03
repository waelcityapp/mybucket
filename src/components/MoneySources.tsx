import { ChevronLeft } from 'lucide-react';
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
  onEditBalance,
  onOpenExpenseCategories,
}: MoneySourcesProps) {
  const t = translations[lang];

  // Check if all zero
  const isAllZero = accounts.length > 0 && accounts.every((acc) => acc.balance === 0);

  return (
    <section className="@container space-y-2.5">
      {/* Accounts management header matches the Spending Categories card. */}
      <button
        type="button"
        onClick={onViewAll}
        className="w-full bg-white hover:bg-slate-50/90 border border-slate-200/90 hover:border-slate-300 rounded-2xl p-2.5 sm:p-3 flex items-center justify-between shadow-2xs hover:shadow-xs transition-all cursor-pointer group active:scale-[0.99]"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-100/80 flex items-center justify-center text-base shadow-2xs group-hover:scale-105 transition-transform shrink-0">
            💳
          </div>
          <div className="text-start min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-black text-slate-900 leading-tight">
                {t.yourAccounts}
              </span>
              <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">
                {lang === 'ar' ? 'تعديل وإضافة' : 'Edit & Add'}
              </span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium">
              {lang === 'ar'
                ? 'عرض حساباتك الحالية وإدارة الأرصدة وإضافة حسابات جديدة'
                : 'View accounts, manage balances, and add new accounts'}
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
