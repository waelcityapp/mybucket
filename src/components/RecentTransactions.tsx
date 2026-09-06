import { Coffee, Briefcase, ShoppingCart, ArrowLeftRight, CreditCard, Banknote, Utensils, Zap, ShoppingBag, Trash2 } from 'lucide-react';
import { Transaction, FinancialAccount, Category, Language } from '../types';
import { translations } from '../data/translations';
import { formatDateTimeDisplay } from '../utils/dateTime';

interface RecentTransactionsProps {
  transactions: Transaction[];
  accounts: FinancialAccount[];
  categories: Category[];
  lang: Language;
  onViewAll?: () => void;
  onDeleteTransaction?: (id: string) => void;
}

export function RecentTransactions({
  transactions,
  accounts,
  categories,
  lang,
  onViewAll,
  onDeleteTransaction,
}: RecentTransactionsProps) {
  const t = translations[lang];

  const getAccountName = (accId: string) => {
    const acc = accounts.find((a) => a.id === accId);
    if (!acc) return accId;
    return lang === 'ar' ? acc.nameAr : acc.name;
  };

  const getTransactionIcon = (tx: Transaction) => {
    if (tx.type === 'transfer') {
      return (
        <div className="w-10 h-10 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center">
          <ArrowLeftRight className="w-4 h-4 stroke-[2.5]" />
        </div>
      );
    }

    const cat = categories.find((c) => c.id === tx.categoryId);
    const desc = tx.description.toLowerCase();

    if (desc.includes('قهوة') || desc.includes('coffee') || cat?.icon === 'Coffee') {
      return (
        <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-800 flex items-center justify-center text-base">
          <Coffee className="w-4 h-4 text-amber-800" />
        </div>
      );
    }
    if (desc.includes('راتب') || desc.includes('salary') || cat?.icon === 'Briefcase') {
      return (
        <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
          <Briefcase className="w-4 h-4 text-emerald-700" />
        </div>
      );
    }
    if (desc.includes('سوبر') || desc.includes('ماركت') || desc.includes('market') || cat?.icon === 'ShoppingCart') {
      return (
        <div className="w-10 h-10 rounded-2xl bg-sky-50 text-sky-700 flex items-center justify-center">
          <ShoppingCart className="w-4 h-4 text-sky-700" />
        </div>
      );
    }
    if (desc.includes('بنزين') || desc.includes('مواصلات')) {
      return (
        <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center text-sm">
          ⛽
        </div>
      );
    }
    if (desc.includes('اكل') || desc.includes('مطعم')) {
      return (
        <div className="w-10 h-10 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center">
          <Utensils className="w-4 h-4" />
        </div>
      );
    }
    if (tx.type === 'income') {
      return (
        <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
          <Banknote className="w-4 h-4" />
        </div>
      );
    }
    return (
      <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
        <CreditCard className="w-4 h-4" />
      </div>
    );
  };

  const formatAmount = (tx: Transaction) => {
    const num = new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
      maximumFractionDigits: 0,
    }).format(tx.amount);

    if (tx.type === 'expense') {
      return `- ${num} ${tx.currency}`;
    }
    if (tx.type === 'income') {
      return `+ ${num} ${tx.currency}`;
    }
    return `${num} ${tx.currency}`;
  };

  return (
    <section className="space-y-2.5">
      {/* Header Row: "أحدث العمليات" on start, "عرض الكل" on end */}
      <div className="flex items-center justify-between px-0.5">
        <h2 className="text-sm sm:text-base font-black text-slate-900 tracking-tight">
          {t.recentTransactions}
        </h2>

        {onViewAll && (
          <button
            type="button"
            onClick={onViewAll}
            className="text-xs font-semibold text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            {t.viewAll}
          </button>
        )}
      </div>

      {/* Transaction List Card matching reference image */}
      {transactions.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/80 p-6 text-center shadow-2xs space-y-2">
          <p className="text-xs font-semibold text-slate-400">
            {t.noTransactionsYet}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-3xl border border-slate-200/80 divide-y divide-slate-100/80 shadow-2xs overflow-hidden">
          {transactions.slice(0, 5).map((tx) => {
            const isExpense = tx.type === 'expense';
            const isIncome = tx.type === 'income';
            const isTransfer = tx.type === 'transfer';

            return (
              <div
                key={tx.id}
                className="p-3.5 sm:p-4 flex items-center justify-between gap-3 hover:bg-slate-50/50 transition-colors group"
              >
                {/* Right/Start: Icon + Title & Account Subtitle */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="shrink-0">{getTransactionIcon(tx)}</div>
                  <div className="min-w-0">
                    <h4 className="text-xs sm:text-sm font-bold text-slate-900 tracking-tight truncate">
                      {tx.description}
                    </h4>
                    <p className="text-[11px] text-slate-400 font-medium truncate mt-0.5">
                      {isTransfer
                        ? `${t.from} ${getAccountName(tx.accountId)}`
                        : getAccountName(tx.accountId)}
                    </p>
                  </div>
                </div>

                {/* Left/End: Amount & Formatted Date/Time */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-end">
                    <div
                      className={`text-xs sm:text-sm font-black tracking-tight ${
                        isExpense
                          ? 'text-rose-500'
                          : isIncome
                          ? 'text-emerald-500'
                          : 'text-slate-800'
                      }`}
                    >
                      {formatAmount(tx)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium mt-0.5">
                      {formatDateTimeDisplay(tx.date, tx.time, tx.dateTime, lang)}
                    </div>
                  </div>

                  {onDeleteTransaction && (
                    <button
                      type="button"
                      onClick={() => onDeleteTransaction(tx.id)}
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-all cursor-pointer"
                      title="حذف"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
