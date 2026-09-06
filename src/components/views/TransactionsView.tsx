import { useState } from 'react';
import { Search, Filter, Plus, ArrowDownRight, ArrowUpRight, ArrowLeftRight, Trash2 } from 'lucide-react';
import { Transaction, FinancialAccount, Category, Language } from '../../types';
import { translations } from '../../data/translations';

interface TransactionsViewProps {
  transactions: Transaction[];
  accounts: FinancialAccount[];
  categories: Category[];
  lang: Language;
  onOpenAddModal: () => void;
  onDeleteTransaction: (id: string) => void;
}

export function TransactionsView({
  transactions,
  accounts,
  categories,
  lang,
  onOpenAddModal,
  onDeleteTransaction,
}: TransactionsViewProps) {
  const t = translations[lang];
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income' | 'transfer'>('all');

  const getAccountName = (accId: string) => {
    const acc = accounts.find((a) => a.id === accId);
    if (!acc) return accId;
    return lang === 'ar' ? acc.nameAr : acc.name;
  };

  const getCategoryName = (catId?: string) => {
    if (!catId) return '';
    const cat = categories.find((c) => c.id === catId);
    if (!cat) return '';
    return lang === 'ar' ? cat.nameAr : cat.name;
  };

  const filtered = transactions.filter((tx) => {
    if (filterType !== 'all' && tx.type !== filterType) return false;
    if (!searchTerm.trim()) return true;

    const term = searchTerm.toLowerCase();
    const descMatch = tx.description.toLowerCase().includes(term);
    const catName = getCategoryName(tx.categoryId).toLowerCase();
    const accName = getAccountName(tx.accountId).toLowerCase();

    return descMatch || catName.includes(term) || accName.includes(term);
  });

  const formatAmount = (tx: Transaction) => {
    const num = new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
      maximumFractionDigits: 2,
    }).format(tx.amount);

    if (tx.type === 'expense') {
      return `-${num} ${tx.currency}`;
    }
    if (tx.type === 'income') {
      return `+${num} ${tx.currency}`;
    }
    return `${num} ${tx.currency}`;
  };

  return (
    <div className="space-y-4 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            {t.allTransactions}
          </h1>
          <p className="text-xs text-slate-500">
            {filtered.length} {lang === 'ar' ? 'عملية مسجلة' : 'records found'}
          </p>
        </div>

        <button
          type="button"
          onClick={onOpenAddModal}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>{t.addTransaction}</span>
        </button>
      </div>

      {/* Search & Filter Bar */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3.5 rtl:left-auto rtl:right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            placeholder={t.searchPlaceholder}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-2xl pl-10 pr-4 rtl:pl-4 rtl:pr-10 py-2.5 text-xs sm:text-sm font-medium focus:outline-hidden focus:border-emerald-500 transition-colors shadow-2xs"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              filterType === 'all'
                ? 'bg-slate-900 text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.filterAll}
          </button>
          <button
            type="button"
            onClick={() => setFilterType('expense')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              filterType === 'expense'
                ? 'bg-rose-600 text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.filterExpenses}
          </button>
          <button
            type="button"
            onClick={() => setFilterType('income')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              filterType === 'income'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.filterIncome}
          </button>
          <button
            type="button"
            onClick={() => setFilterType('transfer')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              filterType === 'transfer'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {t.filterTransfers}
          </button>
        </div>
      </div>

      {/* Transactions List */}
      {filtered.length === 0 ? (
        <div className="p-12 text-center bg-white rounded-3xl border border-slate-200 text-slate-400 text-xs font-medium">
          {t.noTransactionsYet}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 shadow-2xs overflow-hidden">
          {filtered.map((tx) => {
            const isExpense = tx.type === 'expense';
            const isIncome = tx.type === 'income';
            const isTransfer = tx.type === 'transfer';

            return (
              <div
                key={tx.id}
                className="p-3.5 sm:p-4 hover:bg-slate-50/60 transition-colors flex items-center justify-between gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center ${
                      isExpense
                        ? 'bg-rose-50 border border-rose-100 text-rose-600'
                        : isIncome
                        ? 'bg-emerald-50 border border-emerald-100 text-emerald-600'
                        : 'bg-blue-50 border border-blue-100 text-blue-600'
                    }`}
                  >
                    {isTransfer ? (
                      <ArrowLeftRight className="w-4 h-4" />
                    ) : isIncome ? (
                      <ArrowUpRight className="w-4 h-4" />
                    ) : (
                      <ArrowDownRight className="w-4 h-4" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="font-bold text-slate-900 text-sm tracking-tight truncate">
                      {tx.description}
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 flex-wrap">
                      {isTransfer ? (
                        <span>
                          {t.from} <strong className="text-slate-700">{getAccountName(tx.accountId)}</strong>{' '}
                          {t.to} <strong className="text-slate-700">{getAccountName(tx.toAccountId || '')}</strong>
                        </span>
                      ) : (
                        <span>
                          <strong className="text-slate-700">{getAccountName(tx.accountId)}</strong>
                          {tx.categoryId && (
                            <span className="text-slate-400"> · {getCategoryName(tx.categoryId)}</span>
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div
                      className={`text-sm sm:text-base font-extrabold tracking-tight ${
                        isExpense
                          ? 'text-slate-900'
                          : isIncome
                          ? 'text-emerald-600'
                          : 'text-blue-600'
                      }`}
                    >
                      {formatAmount(tx)}
                    </div>
                    <div className="text-[10px] text-slate-400 font-mono">
                      {tx.date}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => onDeleteTransaction(tx.id)}
                    className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-600 p-1.5 rounded-lg hover:bg-rose-50 transition-all cursor-pointer"
                    title="حذف"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
