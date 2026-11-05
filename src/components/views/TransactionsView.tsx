import { useState } from 'react';
import { Search, Plus, ArrowDownRight, ArrowUpRight, ArrowLeftRight, Trash2 } from 'lucide-react';
import { Transaction, FinancialAccount, Category, Language, currencyName } from '../../types';
import { translations } from '../../data/translations';

interface TransactionsViewProps {
  transactions: Transaction[];
  accounts: FinancialAccount[];
  categories: Category[];
  lang: Language;
  loadState: 'loading' | 'ready' | 'error';
  onOpenAddModal: () => void;
  onDeleteTransaction: (id: string) => void;
  initialFilter?: { period: 'today' | 'month'; currency: string } | null;
}

export function TransactionsView({
  transactions,
  accounts,
  categories,
  lang,
  loadState,
  onOpenAddModal,
  onDeleteTransaction,
  initialFilter,
}: TransactionsViewProps) {
  const t = translations[lang];
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income' | 'transfer'>(initialFilter ? 'expense' : 'all');
  const [filterPeriod, setFilterPeriod] = useState<'all' | 'today' | 'month' | 'year' | 'previousYear' | 'range'>(initialFilter?.period || 'all');
  const [rangeFrom, setRangeFrom] = useState('');
  const [rangeTo, setRangeTo] = useState('');
  const [filterCurrency, setFilterCurrency] = useState<string>(initialFilter?.currency || 'all');
  const now = new Date();
  const todayKey = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
  const monthKey = todayKey.slice(0, 7);
  const yearKey = todayKey.slice(0, 4);
  const previousYearKey = String(Number(yearKey) - 1);
  const currencies = Array.from(new Set([...accounts.map(acc => acc.currency), ...transactions.map(tx => tx.currency)])).sort();

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
    if (filterPeriod === 'today' && tx.date !== todayKey) return false;
    if (filterPeriod === 'month' && !tx.date.startsWith(monthKey)) return false;
    if (filterPeriod === 'year' && !tx.date.startsWith(yearKey + '-')) return false;
    if (filterPeriod === 'previousYear' && !tx.date.startsWith(previousYearKey + '-')) return false;
    if (filterPeriod === 'range' && (!rangeFrom || !rangeTo || rangeFrom > rangeTo || tx.date < rangeFrom || tx.date > rangeTo)) return false;
    if (filterCurrency !== 'all' && tx.currency !== filterCurrency) return false;
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
          <h1 className="text-xl font-extrabold text-slate-900 ">
            {t.allTransactions}
          </h1>
          <p className="text-xs text-slate-500">
            {loadState === 'ready' ? `${filtered.length} ${lang === 'ar' ? 'عملية مسجلة' : 'records found'}` : ''}
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

        {/* Date period and currency are independent filters, with clear labels. */}
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-2.5 sm:p-3">
          <div className="space-y-1.5">
            <span className="block text-xs font-bold text-slate-700">{lang === 'ar' ? 'الفترة الزمنية' : 'Date period'}</span>
            <div className="flex flex-wrap gap-1.5">
              {([
                ['all', lang === 'ar' ? 'كل الفترات' : 'All dates'],
                ['today', lang === 'ar' ? 'اليوم' : 'Today'],
                ['month', lang === 'ar' ? 'هذا الشهر' : 'This month'],
                ['year', lang === 'ar' ? 'هذه السنة' : 'This year'],
                ['previousYear', lang === 'ar' ? 'السنة السابقة' : 'Last year'],
                ['range', lang === 'ar' ? 'من تاريخ إلى تاريخ' : 'Custom range'],
              ] as const).map(([period, label]) => (
                <button
                  key={period}
                  type="button"
                  aria-pressed={filterPeriod === period}
                  onClick={() => setFilterPeriod(period)}
                  className={`rounded-xl border px-2.5 py-1.5 text-xs font-bold transition-colors ${filterPeriod === period ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {filterPeriod === 'range' && (
              <div className="grid grid-cols-1 gap-2 pt-1 sm:grid-cols-2">
                <label className="space-y-1 text-xs font-semibold text-slate-700">
                  <span>{lang === 'ar' ? 'من تاريخ' : 'From date'}</span>
                  <input type="date" value={rangeFrom} onChange={event => setRangeFrom(event.target.value)} max={rangeTo || undefined} className="block w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm" />
                </label>
                <label className="space-y-1 text-xs font-semibold text-slate-700">
                  <span>{lang === 'ar' ? 'إلى تاريخ' : 'To date'}</span>
                  <input type="date" value={rangeTo} onChange={event => setRangeTo(event.target.value)} min={rangeFrom || undefined} className="block w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm" />
                </label>
                {(!rangeFrom || !rangeTo || rangeFrom > rangeTo) && (
                  <p role="status" className="text-xs text-amber-700 sm:col-span-2">
                    {lang === 'ar' ? 'حدد تاريخ البداية والنهاية بصورة صحيحة لعرض العمليات.' : 'Choose a valid start and end date to show transactions.'}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2">
            <label htmlFor="transaction-currency-filter" className="text-xs font-bold text-slate-700">
              {lang === 'ar' ? 'فلتر العملة (مستقل عن الفترة)' : 'Currency filter (separate)'}
            </label>
            <select
              id="transaction-currency-filter"
              value={filterCurrency}
              onChange={event => setFilterCurrency(event.target.value)}
              className="min-w-[155px] max-w-full rounded-xl border border-emerald-200 bg-emerald-50 px-2.5 py-2 text-xs font-bold text-emerald-900"
            >
              <option value="all">{lang === 'ar' ? 'جميع العملات' : 'All currencies'}</option>
              {currencies.map(currency => <option key={currency} value={currency}>{currencyName(currency, lang)} ({currency})</option>)}
            </select>
          </div>
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

      {loadState === 'ready' && filtered.length > 0 && (
        <div className="flex flex-wrap gap-1.5 rounded-xl border border-slate-200 bg-white p-2">
          {Array.from(new Set(filtered.map(item => item.currency))).map(code => (
            <span key={code} className="rounded-lg bg-slate-50 px-2 py-1 text-[11px]">
              {code}: {lang === 'ar' ? 'دخل' : 'Income'} {filtered.filter(item => item.currency === code && item.type === 'income').reduce((sum, item) => sum + item.amount, 0).toLocaleString()}
              {' · '}{lang === 'ar' ? 'مصروف' : 'Expense'} {filtered.filter(item => item.currency === code && item.type === 'expense').reduce((sum, item) => sum + item.amount, 0).toLocaleString()}
            </span>
          ))}
        </div>
      )}
      {/* Transactions List */}
      {loadState !== 'ready' ? (
        <div role="status" className="p-6 text-center bg-white rounded-3xl border border-slate-200 text-slate-600 text-sm">
          {loadState === 'loading' ? (lang === 'ar' ? 'جاري قراءة العمليات المحفوظة...' : 'Loading saved transactions...') : (lang === 'ar' ? 'تعذرت قراءة العمليات من قاعدة البيانات. تحقق من الاتصال وأعد فتح الموقع.' : 'Could not read transactions. Check your connection and reopen the site.')}
        </div>
      ) : filtered.length === 0 ? (
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
                    <div className="font-bold text-slate-900 text-sm  truncate">
                      {tx.description || getCategoryName(tx.categoryId) || (isTransfer ? (lang === 'ar' ? 'تحويل' : 'Transfer') : isIncome ? (lang === 'ar' ? 'دخل' : 'Income') : (lang === 'ar' ? 'مصروف' : 'Expense'))}
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
                      className={`text-sm sm:text-base font-extrabold  ${
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
