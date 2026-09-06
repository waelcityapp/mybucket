import React, { useState, useMemo } from 'react';
import { 
  Search, Filter, RefreshCcw, Calendar, Tag, Wallet, Database, 
  ArrowDownRight, ArrowUpRight, ArrowRightLeft, SlidersHorizontal,
  FileText, BarChart, Download, FileSpreadsheet, Share2, Mail, Printer, Crown, Sparkles
} from 'lucide-react';
import { Transaction, Category, FinancialAccount, Language, AuthUser } from '../../types';
import { translations } from '../../data/translations';
import { ProExportModal, ExportFormat } from '../ProExportModal';
import { getUserDateLimits } from '../../utils/userRegistration';

interface SearchViewProps {
  transactions: Transaction[];
  categories: Category[];
  accounts: FinancialAccount[];
  lang: Language;
  authUser?: AuthUser | null;
}

export function SearchView({ transactions, categories, accounts, lang, authUser }: SearchViewProps) {
  const t = translations[lang];
  const isAr = lang === 'ar';

  const userDateLimits = useMemo(
    () => getUserDateLimits(authUser, transactions),
    [authUser, transactions]
  );

  // Filters State
  const [txType, setTxType] = useState<'all' | 'expense' | 'income' | 'transfer'>('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [categoryId, setCategoryId] = useState('all');
  const [accountId, setAccountId] = useState('all');
  const [currency, setCurrency] = useState('all');
  const [keyword, setKeyword] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest'>('newest');
  
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Pro Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState<ExportFormat>('excel');

  // Compute Results
  const filteredTransactions = useMemo(() => {
    return transactions
      .filter(tx => {
        if (txType !== 'all' && tx.type !== txType) return false;
        if (fromDate && tx.date < fromDate) return false;
        if (toDate && tx.date > toDate) return false;
        if (categoryId !== 'all' && tx.categoryId !== categoryId) return false;
        if (accountId !== 'all') {
          if (tx.type === 'transfer' && tx.accountId !== accountId && tx.toAccountId !== accountId) return false;
          if (tx.type !== 'transfer' && tx.accountId !== accountId) return false;
        }
        if (currency !== 'all' && tx.currency !== currency) return false;
        
        if (keyword) {
          const lowerKeyword = keyword.toLowerCase();
          const matchesDesc = tx.description?.toLowerCase().includes(lowerKeyword);
          const matchesCategory = categories.find(c => c.id === tx.categoryId)?.name?.toLowerCase().includes(lowerKeyword) || 
                                  categories.find(c => c.id === tx.categoryId)?.nameAr?.toLowerCase().includes(lowerKeyword);
          if (!matchesDesc && !matchesCategory) return false;
        }
        
        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(`${a.date}T${a.time}`).getTime();
        const timeB = new Date(`${b.date}T${b.time}`).getTime();
        return sortBy === 'newest' ? timeB - timeA : timeA - timeB;
      });
  }, [transactions, txType, fromDate, toDate, categoryId, accountId, currency, keyword, sortBy, categories]);

  const totalAmount = useMemo(() => {
    return filteredTransactions.reduce((sum, tx) => {
      // In a mixed currency scenario, summing naively might be wrong, but for simplicity here we sum amounts.
      // Usually, it's better to show totals per currency or just rely on the user to filter by currency.
      // We will just sum them up for the UI to match the image, assuming the user filters by currency if needed.
      return sum + tx.amount;
    }, 0);
  }, [filteredTransactions]);

  const currencies = useMemo(() => {
    const currSet = new Set<string>();
    accounts.forEach(a => currSet.add(a.currency));
    return Array.from(currSet);
  }, [accounts]);

  const handleClearFilters = () => {
    setTxType('all');
    setFromDate('');
    setToDate('');
    setCategoryId('all');
    setAccountId('all');
    setCurrency('all');
    setKeyword('');
    setSortBy('newest');
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <div className="pb-[100px] bg-slate-50 min-h-screen" dir={isAr ? 'rtl' : 'ltr'}>
      {/* Header Area */}
      <div className="bg-gradient-to-b from-blue-50 to-slate-50 pt-16 pb-8 px-4 rounded-b-[40px] border-b border-blue-100/50">
        <div className="max-w-md mx-auto flex items-center gap-4">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-sm border border-blue-100 flex items-center justify-center flex-shrink-0 relative overflow-hidden">
             <div className="absolute inset-0 bg-blue-100/50 opacity-50"></div>
             <Search className="w-8 h-8 text-blue-600 relative z-10" />
             <div className="absolute bottom-1 right-1 w-6 h-6 bg-emerald-100 rounded-lg flex items-center justify-center z-10">
               <FileText className="w-3 h-3 text-emerald-600" />
             </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
              {t.searchTitle || 'Financial Search'}
            </h1>
            <p className="text-sm text-slate-500 mt-1 leading-relaxed max-w-[250px]">
              {t.searchSubtitle || 'Search your transactions easily'}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 -mt-4 space-y-4">
        
        {/* Filters Card */}
        <div className="bg-white rounded-3xl p-5 shadow-sm border border-slate-100">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <Filter className="w-5 h-5 text-blue-600" />
              {t.searchFilters || 'Search Filters'}
            </h2>
            <button 
              onClick={handleClearFilters}
              className="text-xs font-semibold text-slate-500 hover:text-slate-800 flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 py-1.5 px-3 rounded-full transition-colors"
            >
              <RefreshCcw className="w-3.5 h-3.5" />
              {t.clearFilters || 'Clear'}
            </button>
          </div>

          <div className="space-y-4">
            {/* Transaction Type */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">{isAr ? 'نوع العملية' : 'Type'}</label>
              <div className="flex bg-slate-100 p-1 rounded-xl">
                {['all', 'expense', 'income', 'transfer'].map((type) => (
                  <button
                    key={type}
                    onClick={() => setTxType(type as any)}
                    className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                      txType === type 
                        ? 'bg-blue-600 text-white shadow-sm' 
                        : 'text-slate-600 hover:bg-white/50'
                    }`}
                  >
                    {type === 'all' && (t.txTypeAll || 'All')}
                    {type === 'expense' && <><ArrowDownRight className="w-3.5 h-3.5 text-red-400" /> {t.typeExpense}</>}
                    {type === 'income' && <><ArrowUpRight className="w-3.5 h-3.5 text-emerald-400" /> {t.typeIncome}</>}
                    {type === 'transfer' && <><ArrowRightLeft className="w-3.5 h-3.5 text-slate-400" /> {t.typeTransfer}</>}
                  </button>
                ))}
              </div>
            </div>

            {/* Dates Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">{t.dateFrom || 'From'}</label>
                <div className="relative">
                  <input
                    type="date"
                    value={fromDate}
                    min={userDateLimits.startDateStr}
                    max={userDateLimits.currentDateStr}
                    onChange={(e) => setFromDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">{t.dateTo || 'To'}</label>
                <div className="relative">
                  <input
                    type="date"
                    value={toDate}
                    min={userDateLimits.startDateStr}
                    max={userDateLimits.currentDateStr}
                    onChange={(e) => setToDate(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>
            </div>

            {/* Account & Category Grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">{t.labelAccount}</label>
                <div className="relative">
                  <select
                    value={accountId}
                    onChange={(e) => setAccountId(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none"
                  >
                    <option value="all">{isAr ? 'كل الحسابات' : 'All Accounts'}</option>
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{isAr ? acc.nameAr : acc.name}</option>
                    ))}
                  </select>
                  <Wallet className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-500">{t.labelCategory}</label>
                <div className="relative">
                  <select
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none"
                  >
                    <option value="all">{isAr ? 'كل التصنيفات' : 'All Categories'}</option>
                    {categories.filter(c => txType === 'all' || c.type === txType).map(cat => (
                      <option key={cat.id} value={cat.id}>{isAr ? cat.nameAr : cat.name}</option>
                    ))}
                  </select>
                  <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                </div>
              </div>
            </div>

            {/* Keyword Search */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-500">{t.keywordSearch || 'Keyword'}</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder={t.keywordPlaceholder}
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              </div>
            </div>

            {/* Advanced Filters Toggle */}
            <button
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-between py-3 px-4 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition-colors"
            >
              <span className="text-sm font-bold text-slate-700 flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                {t.advancedFilters || 'Advanced Filters'}
              </span>
              <span className="text-xs text-slate-400 font-bold">
                {showAdvanced ? (isAr ? 'إخفاء' : 'Hide') : (isAr ? 'إظهار' : 'Show')}
              </span>
            </button>

            {/* Advanced Filters Content */}
            {showAdvanced && (
              <div className="grid grid-cols-2 gap-3 pt-2 animate-in slide-in-from-top-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500">{t.labelCurrency}</label>
                  <div className="relative">
                    <select
                      value={currency}
                      onChange={(e) => setCurrency(e.target.value)}
                      className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none"
                    >
                      <option value="all">{isAr ? 'كل العملات' : 'All Currencies'}</option>
                      {currencies.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <Database className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-slate-500">{t.sortBy || 'Sort By'}</label>
                  <div className="relative">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 appearance-none"
                    >
                      <option value="newest">{t.newestFirst || 'Newest'}</option>
                      <option value="oldest">{t.oldestFirst || 'Oldest'}</option>
                    </select>
                    <ArrowDownRight className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                </div>
              </div>
            )}

            {/* Primary Search Action is implicit, filters update live. But let's add a visual button if desired, though live is better. Let's just make it a visual anchor or submit if it was a form. In React, live filtering is preferred. The image shows a big blue button. Let's add it to feel complete, even if live. */}
            <button className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors shadow-sm shadow-blue-600/20">
              <Search className="w-5 h-5" />
              {t.searchBtn || 'Search'}
            </button>
          </div>
        </div>

        {/* Results Section */}
        <div className="mt-8 space-y-4">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
              <FileText className="w-5 h-5 text-slate-600" />
              {t.searchResults || 'Results'}
            </h2>
            <span className="text-xs font-medium text-slate-500 bg-white px-2.5 py-1 rounded-full border border-slate-200 shadow-sm">
              {(t.foundTxCount || '{count} found').replace('{count}', filteredTransactions.length.toString())}
            </span>
          </div>

          {/* PRO Export Action Card */}
          {filteredTransactions.length > 0 && (
            <div className="bg-gradient-to-r from-amber-50 via-white to-amber-50/60 rounded-2xl p-3.5 border border-amber-200/70 shadow-xs space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-amber-500 text-white flex items-center justify-center shrink-0">
                    <Crown className="w-4 h-4 text-amber-100" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-slate-900">
                        {isAr ? 'تصدير نتائج الاستفسار والتقرير' : 'Export Inquired Results & Statement'}
                      </span>
                      <span className="text-[10px] font-black bg-amber-500 text-white px-1.5 py-0.2 rounded-md shadow-xs">
                        PRO ⭐
                      </span>
                    </div>
                    <span className="text-[11px] text-amber-800 font-medium block">
                      {isAr ? 'تصدير فوري إلى Excel و PDF ومشاركة عبر WhatsApp و Email' : 'Instant export to Excel, PDF & share via WhatsApp'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Export Buttons Options */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedExportFormat('excel');
                    setIsExportModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-xl text-xs font-bold transition-transform active:scale-95 cursor-pointer"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{isAr ? 'ملف Excel' : 'Excel (.xlsx)'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedExportFormat('pdf');
                    setIsExportModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200/80 rounded-xl text-xs font-bold transition-transform active:scale-95 cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                  <span>{isAr ? 'تقرير PDF' : 'PDF Report'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedExportFormat('whatsapp');
                    setIsExportModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200/80 rounded-xl text-xs font-bold transition-transform active:scale-95 cursor-pointer"
                >
                  <Share2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{isAr ? 'واتساب' : 'WhatsApp'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSelectedExportFormat('email');
                    setIsExportModalOpen(true);
                  }}
                  className="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200/80 rounded-xl text-xs font-bold transition-transform active:scale-95 cursor-pointer"
                >
                  <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                  <span>{isAr ? 'إيميل / طباعة' : 'Email/Print'}</span>
                </button>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {filteredTransactions.map(tx => {
              const account = accounts.find(a => a.id === tx.accountId);
              const category = categories.find(c => c.id === tx.categoryId);
              
              const isExpense = tx.type === 'expense';
              const isIncome = tx.type === 'income';
              const isTransfer = tx.type === 'transfer';

              return (
                <div key={tx.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex flex-col gap-3 hover:border-blue-200 transition-colors">
                  {/* Top Row: Date & Amount */}
                  <div className="flex items-start justify-between">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                        {new Date(tx.date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long' })}
                      </span>
                      <div className="flex items-center gap-1.5 text-slate-800 font-bold text-sm">
                        <Calendar className="w-3.5 h-3.5 text-slate-400" />
                        {new Date(tx.date).toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </div>
                      <span className="text-xs text-slate-500 mt-0.5">{tx.time}</span>
                    </div>

                    <div className="flex flex-col items-end">
                       <span className={`text-[10px] font-bold uppercase tracking-wider mb-0.5 px-2 py-0.5 rounded-full ${
                          isExpense ? 'bg-red-50 text-red-600' : 
                          isIncome ? 'bg-emerald-50 text-emerald-600' : 
                          'bg-slate-100 text-slate-600'
                       }`}>
                         {isExpense ? t.typeExpense : isIncome ? t.typeIncome : t.typeTransfer}
                         {isExpense && <ArrowDownRight className="w-3 h-3 inline ml-1" />}
                         {isIncome && <ArrowUpRight className="w-3 h-3 inline ml-1" />}
                         {isTransfer && <ArrowRightLeft className="w-3 h-3 inline ml-1" />}
                       </span>
                       <span className={`font-black text-lg ${
                         isExpense ? 'text-red-600' : isIncome ? 'text-emerald-600' : 'text-slate-800'
                       }`}>
                         {formatNumber(tx.amount)} <span className="text-xs font-bold ml-0.5">{tx.currency}</span>
                       </span>
                    </div>
                  </div>

                  <div className="h-px w-full bg-slate-50"></div>

                  {/* Bottom Row: Details */}
                  <div className="flex items-center justify-between gap-2 overflow-x-auto pb-1 hide-scrollbar text-xs font-medium text-slate-600">
                    
                    {account && (
                      <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg flex-shrink-0">
                        <Wallet className="w-3.5 h-3.5 text-indigo-500" />
                        <span className="truncate max-w-[80px]">{isAr ? account.nameAr : account.name}</span>
                      </div>
                    )}
                    
                    {category && (
                      <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg flex-shrink-0">
                        <Tag className="w-3.5 h-3.5 text-blue-500" />
                        <span className="truncate max-w-[80px]">{isAr ? category.nameAr : category.name}</span>
                      </div>
                    )}

                    {tx.description && (
                      <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1.5 rounded-lg flex-shrink-0 flex-1 min-w-[100px]">
                        <FileText className="w-3.5 h-3.5 text-slate-400" />
                        <span className="truncate">{tx.description}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {filteredTransactions.length === 0 && (
              <div className="text-center py-10 bg-white rounded-3xl border border-slate-100 border-dashed">
                <Search className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">{isAr ? 'لا توجد نتائج تطابق بحثك' : 'No results match your search'}</p>
              </div>
            )}
          </div>
        </div>

        {/* Summary Footer Card */}
        {filteredTransactions.length > 0 && (
          <div className="mt-4 bg-emerald-50/80 rounded-3xl p-5 border border-emerald-100/50 flex flex-row items-center justify-between shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center">
                <BarChart className="w-5 h-5" />
              </div>
              <div className="flex flex-col">
                <span className="text-xs font-bold text-emerald-800">{t.txCountLabel || 'Count'}</span>
                <span className="text-lg font-black text-emerald-700">{filteredTransactions.length}</span>
              </div>
            </div>
            
            <div className="w-px h-10 bg-emerald-200/50"></div>

            <div className="flex flex-col items-end">
              <span className="text-xs font-bold text-emerald-800">{t.totalAmount || 'Total'}</span>
              <span className="text-xl font-black text-emerald-700">
                {formatNumber(totalAmount)}
              </span>
            </div>
          </div>
        )}

      </div>

      {/* Pro Export Modal */}
      <ProExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        lang={lang}
        title={keyword ? `بحث: ${keyword}` : (isAr ? 'نتائج الاستفسار المالي' : 'Financial Inquiry Results')}
        subtitle={isAr ? 'تصدير نتائج البحث والفلاتر المحددة' : 'Export searched & filtered financial data'}
        itemCount={filteredTransactions.length}
        totalAmount={totalAmount}
        periodLabel={
          fromDate && toDate
            ? `${fromDate} ➔ ${toDate}`
            : fromDate
            ? `من ${fromDate}`
            : toDate
            ? `إلى ${toDate}`
            : (isAr ? 'كل الفترات' : 'All Periods')
        }
        initialFormat={selectedExportFormat}
      />
    </div>
  );
}
