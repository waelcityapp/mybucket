import { normalizeArabicDigits } from '../utils/semanticParser';
import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ArrowDown,
  ArrowUpRight,
  ArrowLeftRight,
  Calendar as CalendarIcon,
  Clock,
  Check,
  ChevronDown,
  AlertTriangle,
  ArrowRightLeft,
} from 'lucide-react';
import {
  FinancialAccount,
  Category,
  Transaction,
  TransactionType,
  Language,
  CurrencyCode,
} from '../types';
import { translations } from '../data/translations';
import {
  getCurrentLocalDate,
  getCurrentLocalTime,
  toDateTimeISO,
  formatDateTimeDisplay,
} from '../utils/dateTime';
import { CategoryAutocomplete } from './CategoryAutocomplete';
import { AnalyzerFeedbackCard } from './AnalyzerFeedbackCard';
import type { AnalyzerFeedbackContext } from '../services/ai/analyzerFeedbackClient';

interface TransactionModalProps {
  isOpen: boolean;
  initialType?: TransactionType;
  initialValues?: Partial<Transaction> | null;
  feedbackContext?: AnalyzerFeedbackContext | null;
  missingFields?: string[];
  accounts: FinancialAccount[];
  categories: Category[];
  lang: Language;
  onClose: () => void;
  onRetryWithAi?: () => Promise<void>;
  onSaveTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => Promise<{ ok: boolean; message?: string }>;
  onAddCategory?: (category: Category) => void;
}

export function TransactionModal({
  isOpen,
  initialType = 'expense',
  initialValues,
  feedbackContext,
  missingFields = [],
  accounts,
  categories,
  lang,
  onClose,
  onRetryWithAi,
  onSaveTransaction,
  onAddCategory,
}: TransactionModalProps) {
  const t = translations[lang];
  const isAr = lang === 'ar';

  // Form Fields State (Shared Draft Model for both manual & AI)
  const [type, setType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<CurrencyCode>('EGP');
  const [accountId, setAccountId] = useState<string>('');
  const [toAccountId, setToAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Date and Time Fields
  const [date, setDate] = useState<string>(getCurrentLocalDate());
  const [time, setTime] = useState<string>(getCurrentLocalTime());
  const [showDateTimeEditor, setShowDateTimeEditor] = useState<boolean>(false);

  // Dropdown UI states
  const [showAccountDropdown, setShowAccountDropdown] = useState<boolean>(false);
  const [showToAccountDropdown, setShowToAccountDropdown] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [retryingWithAi, setRetryingWithAi] = useState(false);
  const [isAiProposal, setIsAiProposal] = useState<boolean>(false);

  const errorRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (error) errorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [error]);
  // Synchronize on modal open or when initialValues change
  useEffect(() => {
    if (isOpen) {
      if (initialValues) {
        setIsAiProposal(true);
        if (initialValues.type) setType(initialValues.type);
        if (initialValues.amount !== undefined && initialValues.amount !== null) {
          setAmount(String(initialValues.amount));
        } else {
          setAmount('');
        }
        if (initialValues.currency) setCurrency(initialValues.currency);

        // Strict Account Handling: Do NOT guess account if missing!
        if (initialValues.accountId) {
          setAccountId(initialValues.accountId);
        } else {
          setAccountId('');
        }

        if (initialValues.toAccountId) {
          setToAccountId(initialValues.toAccountId);
        } else {
          setToAccountId('');
        }

        if (initialValues.categoryId) {
          setCategoryId(initialValues.categoryId);
        } else {
          setCategoryId('');
        }

        if (initialValues.description) {
          setDescription(initialValues.description);
        } else {
          setDescription('');
        }

        if (initialValues.date) setDate(initialValues.date);
        if (initialValues.time) setTime(initialValues.time);
      } else {
        // Manual entry initialization
        setIsAiProposal(false);
        setType(initialType);
        setAmount('');
        setDescription('');
        setDate(getCurrentLocalDate());
        setTime(getCurrentLocalTime());
        
        setAccountId('');
        setToAccountId('');
        setCategoryId('');
      }

      setError('');
      setShowDateTimeEditor(Boolean(initialValues));
      setShowAccountDropdown(false);
      setShowToAccountDropdown(false);
    }
  }, [isOpen, initialType, initialValues]);

  if (!isOpen) return null;

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const selectedToAccount = accounts.find((a) => a.id === toAccountId);
  const selectedCategory = categories.find((c) => c.id === categoryId);

  const normalizedAmount = normalizeArabicDigits(amount.trim()).replace(/٫/g, '.');
  const parsedAmount = /^(?:[0-9]+(?:[.][0-9]*)?|[.][0-9]+)$/.test(normalizedAmount)
    ? Number(normalizedAmount)
    : NaN;

  // Switching type requires an explicit category or destination choice.
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    setError('');
    setCategoryId('');
    setToAccountId('');
  };

  // Swap Source and Destination Accounts in Transfer
  const handleSwapTransferAccounts = () => {
    const temp = accountId;
    setAccountId(toAccountId);
    setToAccountId(temp);
  };

  const handleSave = async (e?: React.FormEvent) => {
    if (isSaving || retryingWithAi) return;
    if (e) e.preventDefault();
    setError('');

    // 1. Validate Amount
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError(isAr ? 'يرجى إدخال مبلغ صحيح أكبر من الصفر' : 'Please enter a valid amount greater than 0');
      return;
    }

    // 2. Validate Source Account
    if (!accountId) {
      setError(
        type === 'transfer'
          ? isAr
            ? 'يرجى اختيار حساب المصدر (من حساب)'
            : 'Please select a source account'
          : isAr
          ? 'يرجى تحديد مصدر العملية: الكاش أو البنك أو المحفظة أو حساب آخر'
          : 'Please select a financial account'
      );
      return;
    }

    // 3. Validate Transfer Destination Account
    if (type === 'transfer') {
      if (!toAccountId) {
        setError(isAr ? 'يرجى اختيار حساب الوجهة (إلى حساب)' : 'Please select a destination account');
        return;
      }
      if (accountId === toAccountId) {
        setError(isAr ? 'لا يمكن التحويل لنفس الحساب' : 'Cannot transfer to the same account');
        return;
      }
      if (selectedAccount && selectedToAccount && selectedAccount.currency !== selectedToAccount.currency) {
        setError(isAr ? 'لا يمكن التحويل بين حسابين بعملتين مختلفتين. اختر حسابين بنفس العملة.' : 'Cannot transfer between accounts with different currencies. Choose accounts with the same currency.');
        return;
      }
    }

    // A missing category must never silently become the first available one.
    if (type !== 'transfer' && !categories.some(c => c.id === categoryId && c.type === type)) {
      setError(isAr ? 'يرجى اختيار البند المناسب للعملية.' : 'Please select a category for this transaction.');
      return;
    }

    const isoString = toDateTimeISO(date, time);

    // Notes are optional. Do not persist an invented description or category.
    const finalDesc = description.trim();
    if (finalDesc.length > 150) {
      setError(isAr ? 'الحد الأقصى للملاحظات 150 حرفًا.' : 'Notes must be 150 characters or less.');
      return;
    }

    setIsSaving(true);
    try {
      const saved = await onSaveTransaction({
        type,
        amount: parsedAmount,
        currency: selectedAccount ? selectedAccount.currency : currency,
        accountId,
        toAccountId: type === 'transfer' ? toAccountId : undefined,
        categoryId: type !== 'transfer' ? categoryId : undefined,
        description: finalDesc,
        date,
        time,
        dateTime: isoString,
      });
      if (saved.ok) onClose();
      else setError(saved.message || (isAr ? 'تعذر تأكيد الحفظ. راجع قائمة العمليات قبل إعادة المحاولة حتى لا تتكرر.' : 'Could not confirm the save. Check your connection and try again.'));
    } catch (err) {
      console.error('Transaction submission failed:', err);
      setError(isAr ? 'تعذر تأكيد الحفظ. راجع قائمة العمليات قبل إعادة المحاولة حتى لا تتكرر.' : 'Could not confirm the save. Check the transactions list before retrying.');
    } finally {
      setIsSaving(false);
    }
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-US', {
      maximumFractionDigits: 2,
    }).format(num);
  };

  const getAccountDisplayName = (acc?: FinancialAccount) => {
    if (!acc) return '';
    return isAr ? acc.nameAr : acc.name;
  };

  const getCategoryDisplayName = (cat?: Category) => {
    if (!cat) return '';
    return isAr ? cat.nameAr : cat.name;
  };

  const isMissingAccount = !accountId;
  const isReviewPage = window.location.pathname === '/transactions/new';

  return (
    <div className={isReviewPage ? "fixed inset-0 z-50 bg-slate-50 overflow-y-auto" : "fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200"}>
      <div
        className={isReviewPage ? "bg-white w-full min-h-full max-w-2xl mx-auto flex flex-col" : "bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh]"}
        role="dialog"
        aria-modal="true"
      >
        {/* Unified Form Top Bar */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-slate-900 text-sm sm:text-base ">
              {isReviewPage ? (isAr ? 'مراجعة العملية' : 'Review transaction') : (isAr ? 'إضافة عملية جديدة' : 'New Transaction')}
            </h3>
          </div>

          <button
            type="button"
            disabled={retryingWithAi}
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {onRetryWithAi && <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            <button type="button" disabled={retryingWithAi || isSaving}
              className="min-h-10 rounded-xl border border-emerald-200 px-3 font-bold text-emerald-800 disabled:opacity-50"
              onClick={async () => {
                setRetryingWithAi(true);
                try { await onRetryWithAi(); } finally { setRetryingWithAi(false); }
              }}>
              {retryingWithAi ? (isAr ? 'جارٍ إعادة التحليل…' : 'Analyzing again…')
                : (isAr ? 'أعد التحليل بالذكاء الاصطناعي' : 'Analyze again with AI')}
            </button>
            <span className="text-slate-600">{isAr ? 'يحلّل نصك الأصلي ويحدّث الحقول، ويستخدم محاولة واحدة.' : 'Uses one attempt to analyze your original text and update the draft.'}</span>
          </div>}
          {/* Missing Account Warning Notice (from AI utterance) */}
          {isMissingAccount && isAiProposal && (
            <div className="p-3 rounded-2xl bg-amber-50/90 border border-amber-300 flex items-start gap-2.5 text-xs text-amber-900 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-bold text-amber-950">
                  {isAr ? 'يرجى اختيار الحساب المالي' : 'Please choose an account'}
                </div>
                <div className="text-[11px] text-amber-800">
                  {isAr
                    ? 'لم يتم تحديد الحساب في جملتك، اختر الحساب أدناه لحفظ العملية.'
                    : 'Account was not specified. Please pick the account to complete.'}
                </div>
              </div>
            </div>
          )}

          {isAiProposal && <p className="text-sm font-semibold text-slate-700">{isAr ? 'قد يخطئ التحليل. راجع الحقول وعدّلها عند الحاجة، ثم أكّد العملية لحفظها.' : 'Analysis can make mistakes. Review the fields, edit them if needed, then confirm to save.'}</p>}
          <form onSubmit={handleSave} className="space-y-3.5">
            {/* 1. Transaction Type Segmented Toggle (مصروف, دخل, تحويل) */}
            <div className="grid grid-cols-3 gap-2 bg-slate-100/80 p-1 rounded-2xl transition-all duration-300">
              {/* Expense */}
              <button
                type="button"
                onClick={() => handleTypeChange('expense')}
                className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer text-xs font-bold ${
                  type === 'expense'
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{t.quickExpense}</span>
              </button>

              {/* Income */}
              <button
                type="button"
                onClick={() => handleTypeChange('income')}
                className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer text-xs font-bold ${
                  type === 'income'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{t.quickIncome}</span>
              </button>

              {/* Transfer */}
              <button
                type="button"
                onClick={() => handleTypeChange('transfer')}
                className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer text-xs font-bold ${
                  type === 'transfer'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{t.quickTransfer}</span>
              </button>
            </div>

            {/* 2. Amount Input ("المبلغ") with currency badge */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                {t.labelAmount}
              </label>
              <div className="flex items-center rounded-2xl border bg-white p-1.5 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/10 shadow-2xs transition-all duration-300 border-slate-200">
                <div className="px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-mono font-bold text-slate-700 border border-slate-200/70 shrink-0">
                  {selectedAccount?.currency || currency}
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  aria-label={t.labelAmount}
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  autoFocus={!amount}
                  className="flex-1 text-right px-2.5 text-xl font-black text-slate-900 focus:outline-hidden"
                />
              </div>
            </div>

            {/* 3. Account Selectors (Single Account for Expense/Income, Two Accounts for Transfer) */}
            {type !== 'transfer' ? (
              /* Single Account for Expense / Income */
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  {t.labelAccount}
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                    className={`w-full flex items-center justify-between p-2.5 sm:p-3 rounded-2xl border text-xs font-bold transition-colors cursor-pointer shadow-2xs ${
                      isMissingAccount
                        ? 'border-amber-400 bg-amber-50/60 hover:bg-amber-100/60 text-amber-900 ring-2 ring-amber-400/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    {selectedAccount ? (
                      <div className="flex items-center gap-2">
                        <span className="text-base">
                          {selectedAccount.type === 'cash'
                            ? '💰'
                            : selectedAccount.type === 'bank'
                            ? '🏛️'
                            : selectedAccount.type === 'card'
                            ? '💳'
                            : selectedAccount.type === 'wallet'
                            ? '📱'
                            : selectedAccount.type === 'other'
                            ? '🔄'
                            : selectedAccount.type === 'custom'
                            ? '💼'
                            : '💲'}
                        </span>
                        <span>{getAccountDisplayName(selectedAccount)}</span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          ({selectedAccount.currency})
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-amber-700 font-bold">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>{isAr ? 'اضغط لاختيار الحساب (مطلوب)' : 'Select account (required)'}</span>
                      </div>
                    )}
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>

                  {showAccountDropdown && (
                    <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white rounded-2xl border border-slate-200 shadow-xl p-1.5 space-y-1">
                      {accounts.map((acc) => (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => {
                            setAccountId(acc.id);
                            setCurrency(acc.currency);
                            setShowAccountDropdown(false);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            acc.id === accountId
                              ? 'bg-emerald-50 text-emerald-900'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span>
                              {acc.type === 'cash'
                                ? '💰'
                                : acc.type === 'bank'
                                ? '🏛️'
                                : acc.type === 'card'
                                ? '💳'
                                : acc.type === 'wallet'
                                ? '📱'
                                : acc.type === 'other'
                                ? '🔄'
                                : acc.type === 'custom'
                                ? '💼'
                                : '💲'}
                            </span>
                            <span>{getAccountDisplayName(acc)}</span>
                          </div>
                          <span className="font-mono text-slate-400">
                            {formatNumber(acc.linkedBankId ? (accounts.find(a => a.id === acc.linkedBankId)?.balance ?? 0) : acc.type === 'credit' ? (acc.creditLimit || 0) + acc.balance : acc.balance)} {acc.currency}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Two Accounts for Transfer (From & To) */
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 relative">
                  {/* From Account */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">
                      {t.labelFromAccount}
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                        className="w-full flex items-center justify-between p-2.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 transition-colors cursor-pointer shadow-2xs"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-sm">
                            {selectedAccount?.type === 'cash'
                              ? '💰'
                              : selectedAccount?.type === 'bank'
                              ? '🏛️'
                              : selectedAccount?.type === 'card'
                              ? '💳'
                              : selectedAccount?.type === 'wallet'
                              ? '📱'
                              : selectedAccount?.type === 'other'
                              ? '🔄'
                              : selectedAccount?.type === 'custom'
                              ? '💼'
                              : '💲'}
                          </span>
                          <span className="truncate">{getAccountDisplayName(selectedAccount) || (isAr ? 'اختر المصدر' : 'Select Source')}</span>
                        </div>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </button>

                      {showAccountDropdown && (
                        <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white rounded-2xl border border-slate-200 shadow-xl p-1.5 space-y-1">
                          {accounts.map((acc) => (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => {
                                setAccountId(acc.id);
                                setShowAccountDropdown(false);
                              }}
                              className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                                acc.id === accountId ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <span>{getAccountDisplayName(acc)}</span>
                              <span className="font-mono text-slate-400 text-[11px]">{acc.currency}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* To Account */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">
                      {t.labelToAccount}
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowToAccountDropdown(!showToAccountDropdown)}
                        className="w-full flex items-center justify-between p-2.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 transition-colors cursor-pointer shadow-2xs"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-sm">
                            {selectedToAccount?.type === 'cash'
                              ? '💰'
                              : selectedToAccount?.type === 'bank'
                              ? '🏛️'
                              : selectedToAccount?.type === 'card'
                              ? '💳'
                              : selectedToAccount?.type === 'wallet'
                              ? '📱'
                              : selectedToAccount?.type === 'other'
                              ? '🔄'
                              : selectedToAccount?.type === 'custom'
                              ? '💼'
                              : '💲'}
                          </span>
                          <span className="truncate">{getAccountDisplayName(selectedToAccount) || (isAr ? 'اختر الوجهة' : 'Select Dest')}</span>
                        </div>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </button>

                      {showToAccountDropdown && (
                        <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white rounded-2xl border border-slate-200 shadow-xl p-1.5 space-y-1">
                          {accounts.map((acc) => (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => {
                                setToAccountId(acc.id);
                                setShowToAccountDropdown(false);
                              }}
                              className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                                acc.id === toAccountId ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <span>{getAccountDisplayName(acc)}</span>
                              <span className="font-mono text-slate-400 text-[11px]">{acc.currency}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Swap button */}
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleSwapTransferAccounts}
                    className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>{isAr ? 'تبديل الحسابين' : 'Swap Accounts'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* 4. Category Autocomplete (for Expense and Income) */}
            {type !== 'transfer' && (
              <CategoryAutocomplete
                categories={categories}
                selectedCategoryId={categoryId}
                transactionType={type}
                lang={lang}
                onSelectCategory={(id) => setCategoryId(id)}
                onAddNewCategory={onAddCategory}
              />
            )}

            {/* 5. Description / Note ("الوصف / ملاحظة") */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                {t.labelDescription}
              </label>
              <textarea
                rows={3}
                value={description}
                maxLength={150}
                onChange={(e) => setDescription(e.target.value.slice(0, 150))}
                placeholder={
                  selectedCategory
                    ? getCategoryDisplayName(selectedCategory)
                    : t.descPlaceholder
                }
                className="block w-full min-h-[88px] p-2.5 sm:p-3 rounded-2xl border bg-white text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-500 shadow-2xs transition-all duration-300 resize-y whitespace-pre-wrap break-words border-slate-200"
              />
              <p aria-live="polite" className={`text-[11px] text-end font-semibold ${
                150 - description.length <= 15 ? 'text-red-600' : 'text-slate-500'
              }`}>
                {isAr ? `المتبقي: ${150 - description.length} حرف` : `Remaining: ${150 - description.length} characters`}
              </p>
            </div>

            {/* 6. Date and Time with Derived Weekday & Interactive Editor */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 block">
                  {t.dateTimeLabel}
                </label>
                <button
                  type="button"
                  onClick={() => setShowDateTimeEditor(!showDateTimeEditor)}
                  className="text-[11px] text-emerald-600 font-bold hover:underline cursor-pointer"
                >
                  {showDateTimeEditor
                    ? isAr
                      ? 'إخفاء التعديل'
                      : 'Hide'
                    : isAr
                    ? 'تعديل التاريخ والوقت'
                    : 'Edit Date & Time'}
                </button>
              </div>

              {/* Show the read-only summary only while the editor is closed.
                  Showing both it and editable fields duplicated the same date and time. */}
              {!showDateTimeEditor && <button
                type="button"
                onClick={() => setShowDateTimeEditor(true)}
                className="w-full flex items-center justify-between p-2.5 sm:p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
              >
                <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <CalendarIcon className="w-4 h-4 text-slate-500" />
                  <span>{formatDateTimeDisplay(date, time, undefined, lang)}</span>
                </span>
                <Clock className="w-4 h-4 text-slate-400" />
              </button>}

              {/* Expanded Interactive Date & Time Picker */}
              {showDateTimeEditor && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5 sm:p-3 space-y-2 animate-in fade-in duration-150">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Date Picker */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 mb-1 block">
                        {t.labelDate}
                      </label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full p-2 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-hidden"
                      />
                    </div>

                    {/* Time Picker */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 mb-1 block">
                        {t.labelTime}
                      </label>
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="w-full p-2 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Quick Presets for Date and Time */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[11px]">
                    <span className="text-slate-400 shrink-0 font-medium">
                      {isAr ? 'سريع:' : 'Quick:'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDate(getCurrentLocalDate());
                        setTime(getCurrentLocalTime());
                      }}
                      className="px-2 py-0.5 bg-white border border-slate-200 hover:border-emerald-500 rounded-lg text-slate-700 font-medium cursor-pointer"
                    >
                      {isAr ? 'الآن' : 'Now'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        now.setHours(now.getHours() - 1);
                        setTime(
                          `${String(now.getHours()).padStart(2, '0')}:${String(
                            now.getMinutes()
                          ).padStart(2, '0')}`
                        );
                      }}
                      className="px-2 py-0.5 bg-white border border-slate-200 hover:border-emerald-500 rounded-lg text-slate-700 font-medium cursor-pointer"
                    >
                      {isAr ? 'منذ ساعة' : '1h ago'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        now.setDate(now.getDate() - 1);
                        const y = now.getFullYear();
                        const m = String(now.getMonth() + 1).padStart(2, '0');
                        const d = String(now.getDate()).padStart(2, '0');
                        setDate(`${y}-${m}-${d}`);
                      }}
                      className="px-2 py-0.5 bg-white border border-slate-200 hover:border-emerald-500 rounded-lg text-slate-700 font-medium cursor-pointer"
                    >
                      {isAr ? 'أمس' : 'Yesterday'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {isAiProposal && feedbackContext && <AnalyzerFeedbackCard lang={lang} context={feedbackContext} />}

            {/* Action Buttons: "✓ تأكيد وحفظ العملية" & "إلغاء" */}
            <div className="pt-2 space-y-2">
              {error && (
                <div ref={errorRef} role="alert" className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={isSaving || retryingWithAi}
                className={`w-full py-3.5 px-4 active:scale-[0.99] text-white text-xs sm:text-sm font-black rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                  !selectedAccount || (type === 'transfer' && !selectedToAccount)
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                }`}
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>
                  {!selectedAccount
                    ? isAr
                      ? 'يرجى اختيار الحساب أولاً'
                      : 'Please select an account first'
                    : type === 'transfer' && !selectedToAccount
                    ? isAr
                      ? 'يرجى اختيار حساب الوجهة'
                      : 'Please select destination account'
                    : t.confirmAndAddTransaction}
                </span>
              </button>

              <button
                type="button"
                disabled={retryingWithAi}
                onClick={onClose}
                className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors cursor-pointer text-center"
              >
                {t.btnCancel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
