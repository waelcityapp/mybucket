import React, { useState, useMemo } from 'react';
import {
  X,
  Calendar as CalendarIcon,
  Filter,
  Plus,
  Pencil,
  Trash2,
  Receipt,
  TrendingDown,
  TrendingUp,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Wallet,
  Check,
  ChevronDown,
  AlertCircle,
  Search,
  Sparkles,
  Coffee,
  Briefcase,
  ShoppingCart,
  ShoppingBag,
  HeartPulse,
  Coins,
  Car,
  MoreHorizontal,
  Crown,
  FileSpreadsheet,
  Download,
} from 'lucide-react';
import { Category, Transaction, FinancialAccount, Language, AuthUser } from '../types';
import { translations } from '../data/translations';
import { formatDateTimeDisplay, getCurrentLocalDate } from '../utils/dateTime';
import { getUserDateLimits, getAvailableMonthsForYear } from '../utils/userRegistration';
import { ProExportModal, ExportFormat } from './ProExportModal';

interface CategoryDetailModalProps {
  isOpen: boolean;
  category: Category | null;
  categories: Category[];
  accounts: FinancialAccount[];
  transactions: Transaction[];
  lang: Language;
  authUser?: AuthUser | null;
  onClose: () => void;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (txId: string) => void;
  onOpenAddTransaction: (prefilledCatId: string, type: 'expense' | 'income') => void;
}

type PeriodType = 'this_month' | 'last_month' | 'specific_month' | 'specific_year' | 'custom_range';

export function CategoryDetailModal({
  isOpen,
  category,
  categories,
  accounts,
  transactions,
  lang,
  authUser,
  onClose,
  onEditTransaction,
  onDeleteTransaction,
  onOpenAddTransaction,
}: CategoryDetailModalProps) {
  const t = translations[lang];
  const isAr = lang === 'ar';

  const userDateLimits = useMemo(
    () => getUserDateLimits(authUser, transactions),
    [authUser, transactions]
  );

  const currentYear = userDateLimits.currentYear;
  const currentMonth = userDateLimits.currentMonth;

  // Date Filter State
  const [periodType, setPeriodType] = useState<PeriodType>('this_month');
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonth, setSelectedMonth] = useState<number>(currentMonth);
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    const startOfMonth = d.toISOString().split('T')[0];
    return startOfMonth < userDateLimits.startDateStr ? userDateLimits.startDateStr : startOfMonth;
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => getCurrentLocalDate());
  const [searchQuery, setSearchQuery] = useState('');
  const [displayCount, setDisplayCount] = useState<number>(30);

  // Pro Export Modal State
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedExportFormat, setSelectedExportFormat] = useState<ExportFormat>('excel');

  // Editing inline state
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editAmount, setEditAmount] = useState<string>('');
  const [editDesc, setEditDesc] = useState<string>('');
  const [editDate, setEditDate] = useState<string>('');
  const [editAccountId, setEditAccountId] = useState<string>('');

  const allMonthsList = [
    { value: 1, nameAr: 'يناير (01)', nameEn: 'January (01)' },
    { value: 2, nameAr: 'فبراير (02)', nameEn: 'February (02)' },
    { value: 3, nameAr: 'مارس (03)', nameEn: 'March (03)' },
    { value: 4, nameAr: 'أبريل (04)', nameEn: 'April (04)' },
    { value: 5, nameAr: 'مايو (05)', nameEn: 'May (05)' },
    { value: 6, nameAr: 'يونيو (06)', nameEn: 'June (06)' },
    { value: 7, nameAr: 'يوليو (07)', nameEn: 'July (07)' },
    { value: 8, nameAr: 'أغسطس (08)', nameEn: 'August (08)' },
    { value: 9, nameAr: 'سبتمبر (09)', nameEn: 'September (09)' },
    { value: 10, nameAr: 'أكتوبر (10)', nameEn: 'October (10)' },
    { value: 11, nameAr: 'نوفمبر (11)', nameEn: 'November (11)' },
    { value: 12, nameAr: 'ديسمبر (12)', nameEn: 'December (12)' },
  ];

  const availableMonths = useMemo(() => {
    return getAvailableMonthsForYear(selectedYear, userDateLimits, allMonthsList);
  }, [selectedYear, userDateLimits]);

  const yearsList = userDateLimits.yearsList;

  if (!isOpen || !category) return null;

  // Helper to render icon
  const renderCategoryIcon = (iconStr?: string) => {
    if (!iconStr) return '🏷️';
    if (iconStr.length <= 4) return iconStr; // Emoji
    switch (iconStr) {
      case 'Coffee': return <Coffee className="w-5 h-5" />;
      case 'Briefcase': return <Briefcase className="w-5 h-5" />;
      case 'ShoppingCart': return <ShoppingCart className="w-5 h-5" />;
      case 'Receipt': return <Receipt className="w-5 h-5" />;
      case 'ShoppingBag': return <ShoppingBag className="w-5 h-5" />;
      case 'HeartPulse': return <HeartPulse className="w-5 h-5" />;
      case 'Coins': return <Coins className="w-5 h-5" />;
      case 'TrendingUp': return <TrendingUp className="w-5 h-5" />;
      case 'Car': return <Car className="w-5 h-5" />;
      default: return <Receipt className="w-5 h-5" />;
    }
  };

  const getAccountName = (accId: string) => {
    const acc = accounts.find((a) => a.id === accId);
    if (!acc) return accId;
    return isAr ? acc.nameAr : acc.name;
  };

  // Filter transactions by category and date range
  const filteredTransactions = transactions.filter((tx) => {
    // 1. Must match this category
    if (tx.categoryId !== category.id) return false;

    // 2. Search text filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const descMatch = tx.description.toLowerCase().includes(q);
      const accMatch = getAccountName(tx.accountId).toLowerCase().includes(q);
      if (!descMatch && !accMatch) return false;
    }

    // 3. Date filtering
    const txDateStr = tx.date || tx.createdAt?.split('T')[0] || '';
    if (!txDateStr) return false;

    const txDate = new Date(txDateStr);
    const txYear = txDate.getFullYear();
    const txMonth = txDate.getMonth() + 1;

    switch (periodType) {
      case 'this_month': {
        return txYear === currentYear && txMonth === currentMonth;
      }
      case 'last_month': {
        const lastMonthYear = currentMonth === 1 ? currentYear - 1 : currentYear;
        const lastMonthVal = currentMonth === 1 ? 12 : currentMonth - 1;
        return txYear === lastMonthYear && txMonth === lastMonthVal;
      }
      case 'specific_month': {
        return txYear === selectedYear && txMonth === selectedMonth;
      }
      case 'specific_year': {
        return txYear === selectedYear;
      }
      case 'custom_range': {
        if (!customStartDate && !customEndDate) return true;
        if (customStartDate && txDateStr < customStartDate) return false;
        if (customEndDate && txDateStr > customEndDate) return false;
        return true;
      }
      default:
        return txYear === currentYear && txMonth === currentMonth;
    }
  }).sort((a, b) => {
    const dateA = a.date || a.createdAt || '';
    const dateB = b.date || b.createdAt || '';
    return dateB.localeCompare(dateA);
  });

  // Calculate statistics for filtered list
  const totalAmount = filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0);
  const avgAmount = filteredTransactions.length > 0 ? totalAmount / filteredTransactions.length : 0;

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-US', {
      maximumFractionDigits: 2,
    }).format(num);
  };

  // Start editing a transaction
  const handleStartEdit = (tx: Transaction) => {
    setEditingTx(tx);
    setEditAmount(String(tx.amount));
    setEditDesc(tx.description);
    setEditDate(tx.date || tx.createdAt?.split('T')[0] || getCurrentLocalDate());
    setEditAccountId(tx.accountId);
  };

  // Save edited transaction
  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTx) return;

    const parsedAmount = parseFloat(editAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert(isAr ? 'يرجى إدخال مبلغ صحيح' : 'Please enter a valid amount');
      return;
    }

    const updated: Transaction = {
      ...editingTx,
      amount: parsedAmount,
      description: editDesc.trim() || category.nameAr,
      date: editDate,
      accountId: editAccountId,
    };

    onEditTransaction(updated);
    setEditingTx(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl max-w-2xl w-full shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-white text-xl shadow-xs shrink-0"
              style={{ backgroundColor: category.color || '#6366f1' }}
            >
              {renderCategoryIcon(category.icon)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-black text-slate-900 truncate">
                  {isAr ? category.nameAr : category.name}
                </h2>
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${
                    category.type === 'expense'
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-emerald-100 text-emerald-800'
                  }`}
                >
                  {category.type === 'expense'
                    ? isAr ? 'بند صرف' : 'Expense'
                    : isAr ? 'بند دخل' : 'Income'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                {isAr ? 'كشف تفصيلي بالمعاملات وتحديد الفترات والتواريخ' : 'Detailed transaction statement & date filter'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Date Filter & Period Selector Bar */}
        <div className="p-4 bg-slate-50/90 border-b border-slate-200/80 space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-slate-500" />
              <span>{isAr ? 'تحديد الفترة الزمنية:' : 'Select Period:'}</span>
            </span>

            {/* Period Quick Filter Tabs */}
            <div className="flex items-center gap-1 flex-wrap">
              <button
                type="button"
                onClick={() => setPeriodType('this_month')}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  periodType === 'this_month'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200/80'
                }`}
              >
                {isAr ? 'هذا الشهر' : 'This Month'}
              </button>
              {userDateLimits.hasPriorMonth && (
                <button
                  type="button"
                  onClick={() => setPeriodType('last_month')}
                  className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                    periodType === 'last_month'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200/80'
                  }`}
                >
                  {isAr ? 'الشهر السابق' : 'Last Month'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setPeriodType('specific_month')}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  periodType === 'specific_month'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200/80'
                }`}
              >
                {isAr ? 'شهر محدد' : 'Specific Month'}
              </button>
              <button
                type="button"
                onClick={() => setPeriodType('specific_year')}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  periodType === 'specific_year'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200/80'
                }`}
              >
                {isAr ? 'سنة محددة' : 'Specific Year'}
              </button>
              <button
                type="button"
                onClick={() => setPeriodType('custom_range')}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                  periodType === 'custom_range'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200/80'
                }`}
              >
                {isAr ? 'فترة مخصصة (من - إلى)' : 'Custom Range'}
              </button>
            </div>
          </div>

          {/* Detailed Controls when Specific Month / Year / Custom Range is Selected */}
          {periodType === 'specific_month' && (
            <div className="flex items-center gap-2 pt-1 flex-wrap animate-in fade-in">
              <div className="flex-1 min-w-[140px]">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  {isAr ? 'اختر الشهر:' : 'Select Month:'}
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-hidden"
                >
                  {availableMonths.map((m) => (
                    <option key={m.value} value={m.value}>
                      {isAr ? m.nameAr : m.nameEn}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-28">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
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
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-hidden"
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

          {periodType === 'specific_year' && (
            <div className="flex items-center gap-2 pt-1 animate-in fade-in">
              <div className="w-36">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  {isAr ? 'اختر السنة:' : 'Select Year:'}
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-hidden"
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

          {periodType === 'custom_range' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 animate-in fade-in">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  {isAr ? 'من تاريخ:' : 'From Date:'}
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  min={userDateLimits.startDateStr}
                  max={userDateLimits.currentDateStr}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-hidden"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  {isAr ? 'إلى تاريخ:' : 'To Date:'}
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  min={userDateLimits.startDateStr}
                  max={userDateLimits.currentDateStr}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-800 outline-hidden"
                />
              </div>
            </div>
          )}
        </div>

        {/* Stats Summary Card */}
        <div className="px-4 sm:px-5 py-3.5 bg-white border-b border-slate-100 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-[11px] font-bold text-slate-400 block">
                {category.type === 'expense'
                  ? isAr ? 'إجمالي المنصرف بالفترة' : 'Total Spent'
                  : isAr ? 'إجمالي المقبوض بالفترة' : 'Total Received'}
              </span>
              <div className="text-base sm:text-lg font-black text-slate-900 flex items-baseline gap-1">
                <span className={category.type === 'expense' ? 'text-rose-600' : 'text-emerald-600'}>
                  {formatNumber(totalAmount)}
                </span>
                <span className="text-xs font-bold text-slate-400">EGP</span>
              </div>
            </div>

            <div className="h-8 w-px bg-slate-200 hidden sm:block" />

            <div>
              <span className="text-[11px] font-bold text-slate-400 block">
                {isAr ? 'عدد العمليات' : 'Transactions'}
              </span>
              <span className="text-xs sm:text-sm font-black text-slate-800">
                {filteredTransactions.length} {isAr ? 'عملية' : 'txs'}
              </span>
            </div>

            <div className="h-8 w-px bg-slate-200 hidden sm:block" />

            <div className="hidden sm:block">
              <span className="text-[11px] font-bold text-slate-400 block">
                {isAr ? 'متوسط العملية' : 'Average'}
              </span>
              <span className="text-xs font-black text-slate-700">
                {formatNumber(avgAmount)} <span className="text-[10px] text-slate-400">EGP</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Pro Export Statement Button */}
            {filteredTransactions.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedExportFormat('excel');
                  setIsExportModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-bold transition-transform active:scale-95 cursor-pointer shadow-xs"
              >
                <Crown className="w-3.5 h-3.5 text-amber-200" />
                <span>{isAr ? 'تصدير كشف الحساب' : 'Export Statement'}</span>
                <span className="text-[10px] font-black bg-white/25 px-1 py-0.2 rounded-md">PRO</span>
              </button>
            )}

            {/* Quick Add in This Category Button */}
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenAddTransaction(category.id, category.type);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-transform active:scale-95 cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>{isAr ? 'إضافة عملية' : 'Add in Category'}</span>
            </button>
          </div>
        </div>

        {/* Modal Body & Transactions List */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-3 flex-1">
          {/* Search in filtered transactions */}
          {filteredTransactions.length > 3 && (
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isAr ? 'بحث في معاملات هذا البند...' : 'Search in these transactions...'}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-8 pl-3 py-1.5 text-xs font-medium outline-hidden focus:border-indigo-400 focus:bg-white transition-all"
              />
            </div>
          )}

          {/* INLINE EDIT FORM */}
          {editingTx && (
            <form
              onSubmit={handleSaveEdit}
              className="bg-indigo-50/70 border-2 border-indigo-200 rounded-2xl p-3.5 space-y-3 shadow-xs animate-in slide-in-from-top-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                  <Pencil className="w-3.5 h-3.5 text-indigo-600" />
                  <span>{isAr ? 'تعديل المعاملة' : 'Edit Transaction'}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                    {isAr ? 'المبلغ (جنيه):' : 'Amount (EGP):'}
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={editAmount}
                    onChange={(e) => setEditAmount(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-black text-slate-900 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                    {isAr ? 'الحساب المستخدم:' : 'Account:'}
                  </label>
                  <select
                    value={editAccountId}
                    onChange={(e) => setEditAccountId(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 outline-hidden"
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {isAr ? acc.nameAr : acc.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                    {isAr ? 'الوصف / البيان:' : 'Description:'}
                  </label>
                  <input
                    type="text"
                    required
                    value={editDesc}
                    onChange={(e) => setEditDesc(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 outline-hidden"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-0.5">
                    {isAr ? 'التاريخ:' : 'Date:'}
                  </label>
                  <input
                    type="date"
                    required
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-900 outline-hidden"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-indigo-100">
                <button
                  type="button"
                  onClick={() => setEditingTx(null)}
                  className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl"
                >
                  {isAr ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-xs flex items-center gap-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>{isAr ? 'حفظ التعديل' : 'Save Changes'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Transactions List */}
          <div className="space-y-2">
            {filteredTransactions.slice(0, displayCount).map((tx) => {
              const txDateStr = tx.date || tx.createdAt?.split('T')[0] || '';
              const accountName = getAccountName(tx.accountId);

              return (
                <div
                  key={tx.id}
                  className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-3 flex items-center justify-between gap-3 shadow-2xs hover:shadow-xs transition-all group"
                >
                  {/* Icon & Details */}
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 shadow-2xs ${
                        tx.type === 'expense'
                          ? 'bg-rose-50 text-rose-600 border border-rose-100'
                          : 'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      }`}
                    >
                      {tx.type === 'expense' ? (
                        <ArrowDownRight className="w-4 h-4 stroke-[2.5]" />
                      ) : (
                        <ArrowUpRight className="w-4 h-4 stroke-[2.5]" />
                      )}
                    </div>

                    <div className="min-w-0">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 truncate block">
                        {tx.description}
                      </span>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400 font-medium flex-wrap mt-0.5">
                        <span className="flex items-center gap-1">
                          <CalendarIcon className="w-3 h-3 text-slate-400" />
                          <span>{txDateStr}</span>
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 bg-slate-50 px-1.5 py-0.2 rounded-md border border-slate-200/60 text-slate-600">
                          <Wallet className="w-3 h-3" />
                          <span>{accountName}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Amount & Actions */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-end">
                      <span
                        className={`text-xs sm:text-sm font-black block ${
                          tx.type === 'expense' ? 'text-rose-600' : 'text-emerald-600'
                        }`}
                      >
                        {tx.type === 'expense' ? '-' : '+'}
                        {formatNumber(tx.amount)}
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">{tx.currency || 'EGP'}</span>
                    </div>

                    {/* Edit & Delete Action Buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(tx)}
                        title={isAr ? 'تعديل العملية' : 'Edit'}
                        className="w-7 h-7 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-500 hover:text-indigo-600 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            window.confirm(
                              isAr
                                ? 'هل أنت متأكد من حذف هذه العملية؟ سيتم استرجاع الرصيد تلقائياً.'
                                : 'Are you sure you want to delete this transaction?'
                            )
                          ) {
                            onDeleteTransaction(tx.id);
                          }
                        }}
                        title={isAr ? 'حذف العملية' : 'Delete'}
                        className="w-7 h-7 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredTransactions.length > displayCount && (
              <div className="pt-2 text-center">
                <button
                  type="button"
                  onClick={() => setDisplayCount((prev) => prev + 30)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
                >
                  {isAr
                    ? `عرض المزيد من العمليات (+30 من أصل ${filteredTransactions.length})`
                    : `Show more (+30 of ${filteredTransactions.length})`}
                </button>
              </div>
            )}

            {filteredTransactions.length === 0 && (
              <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-200 space-y-2">
                <Receipt className="w-8 h-8 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600">
                  {isAr ? 'لا توجد عمليات مسجلة في هذا البند خلال الفترة المحددة' : 'No transactions recorded for this period'}
                </p>
                <p className="text-[11px] text-slate-400 font-medium">
                  {isAr ? 'يمكنك تغيير خيارات الفترة أعلاه أو إضافة معاملة جديدة' : 'Try changing the period filter or add a new transaction'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenAddTransaction(category.id, category.type);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-transform active:scale-95 cursor-pointer mt-2"
                >
                  <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  <span>{isAr ? 'إضافة معاملة في هذا البند' : 'Add Transaction'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-medium">
            {isAr
              ? `إجمالي ${filteredTransactions.length} عملية مسجلة`
              : `Total of ${filteredTransactions.length} transaction(s)`}
          </span>
          <div className="flex items-center gap-2">
            {filteredTransactions.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setSelectedExportFormat('excel');
                  setIsExportModalOpen(true);
                }}
                className="px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-200/80 rounded-xl text-xs font-bold transition-transform active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <Crown className="w-3.5 h-3.5 text-amber-600" />
                <span>{isAr ? 'تصدير (PRO)' : 'Export (PRO)'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-transform active:scale-95 cursor-pointer shadow-xs"
            >
              {isAr ? 'إغلاق' : 'Close'}
            </button>
          </div>
        </div>
      </div>

      {/* Pro Export Modal */}
      <ProExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        lang={lang}
        title={isAr ? `كشف بند: ${category.nameAr}` : `Category Statement: ${category.name}`}
        subtitle={isAr ? 'تصدير كشف حساب البند المالي' : 'Export category detailed statement'}
        itemCount={filteredTransactions.length}
        totalAmount={totalAmount}
        periodLabel={
          periodType === 'this_month'
            ? isAr ? 'هذا الشهر' : 'This Month'
            : periodType === 'last_month'
            ? isAr ? 'الشهر السابق' : 'Last Month'
            : periodType === 'specific_month'
            ? `${selectedMonth}/${selectedYear}`
            : periodType === 'specific_year'
            ? `${selectedYear}`
            : `${customStartDate} ➔ ${customEndDate}`
        }
        initialFormat={selectedExportFormat}
      />
    </div>
  );
}
