import { useState, useEffect, FormEvent } from 'react';
import { X, Check, Banknote, Building2, CreditCard, PiggyBank, Smartphone, ArrowLeftRight, FolderKanban, RotateCcw } from 'lucide-react';
import { FinancialAccount, Language } from '../types';
import { translations } from '../data/translations';

interface EditBalanceModalProps {
  isOpen: boolean;
  accounts: FinancialAccount[];
  selectedAccountId?: string | null; // If null, bulk mode for all accounts
  lang: Language;
  onClose: () => void;
  onUpdateSingleBalance: (accountId: string, newBalance: number) => void;
  onUpdateBulkBalances: (balances: Record<string, number>) => void;
}

export function EditBalanceModal({
  isOpen,
  accounts,
  selectedAccountId,
  lang,
  onClose,
  onUpdateSingleBalance,
  onUpdateBulkBalances,
}: EditBalanceModalProps) {
  const t = translations[lang];

  // State for single account edit
  const [singleAmount, setSingleAmount] = useState<string>('');

  // State for bulk accounts edit
  const [bulkAmounts, setBulkAmounts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      if (selectedAccountId) {
        const target = accounts.find((a) => a.id === selectedAccountId);
        setSingleAmount(target ? String(target.balance) : '0');
      } else {
        // Initialize all accounts with their current balance (or empty if 0)
        const initial: Record<string, string> = {};
        accounts.forEach((acc) => {
          initial[acc.id] = acc.balance !== 0 ? String(acc.balance) : '0';
        });
        setBulkAmounts(initial);
      }
    }
  }, [isOpen, selectedAccountId, accounts]);

  if (!isOpen) return null;

  const getAccountIcon = (type: string) => {
    switch (type) {
      case 'cash':
        return <Banknote className="w-5 h-5 text-emerald-600" />;
      case 'bank':
        return <Building2 className="w-5 h-5 text-blue-600" />;
      case 'card':
        return <CreditCard className="w-5 h-5 text-purple-600" />;
      case 'wallet':
        return <Smartphone className="w-5 h-5 text-cyan-600" />;
      case 'other':
        return <ArrowLeftRight className="w-5 h-5 text-amber-600" />;
      case 'custom':
        return <FolderKanban className="w-5 h-5 text-indigo-600" />;
      case 'savings':
        return <PiggyBank className="w-5 h-5 text-amber-600" />;
      default:
        return <CreditCard className="w-5 h-5 text-slate-600" />;
    }
  };

  const handleSingleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedAccountId) return;
    const num = parseFloat(singleAmount) || 0;
    onUpdateSingleBalance(selectedAccountId, num);
    onClose();
  };

  const handleBulkSubmit = (e: FormEvent) => {
    e.preventDefault();
    const parsedBalances: Record<string, number> = {};
    accounts.forEach((acc) => {
      const val = parseFloat(bulkAmounts[acc.id] || '0') || 0;
      parsedBalances[acc.id] = val;
    });
    onUpdateBulkBalances(parsedBalances);
    onClose();
  };

  const handleResetAllToZero = () => {
    const zeroes: Record<string, string> = {};
    accounts.forEach((acc) => {
      zeroes[acc.id] = '0';
    });
    setBulkAmounts(zeroes);
  };

  const selectedAccount = selectedAccountId
    ? accounts.find((a) => a.id === selectedAccountId)
    : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-lg rounded-3xl p-6 shadow-2xl border border-slate-200 space-y-5 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3.5">
          <div>
            <h2 className="text-lg font-black text-slate-900 tracking-tight">
              {selectedAccount
                ? (lang === 'ar' ? `تعديل رصيد: ${selectedAccount.nameAr}` : `Edit Balance: ${selectedAccount.name}`)
                : t.setInitialBalances}
            </h2>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {selectedAccount
                ? (lang === 'ar' ? 'حدد الرصيد الافتتاحي أو الحالي لهذا الحساب' : 'Set the opening or current balance for this account')
                : (lang === 'ar' ? 'أدخل الرصيد الافتتاحي لكل حساب لديك للبدء بحسابات دقيقة' : 'Enter the opening balance for each account to start')}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center cursor-pointer transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form: Single Account */}
        {selectedAccount ? (
          <form onSubmit={handleSingleSubmit} className="space-y-4">
            {/* 1. الرصيد الحالي */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center shadow-2xs">
                  {getAccountIcon(selectedAccount.type)}
                </div>
                <div>
                  <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">
                    {lang === 'ar' ? '1. الرصيد الحالي' : '1. Current Balance'}
                  </span>
                  <span className="text-base font-black text-slate-900 block">
                    {lang === 'ar' ? selectedAccount.nameAr : selectedAccount.name}
                  </span>
                </div>
              </div>

              <div className="text-end">
                <div className="text-xl sm:text-2xl font-black text-emerald-700 font-mono tracking-tight">
                  {selectedAccount.balance.toLocaleString()}
                </div>
                <div className="text-[11px] font-bold text-slate-500">
                  {selectedAccount.currency}
                </div>
              </div>
            </div>

            {/* 2. تعديل الرصيد */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                {lang === 'ar' ? '2. تعديل الرصيد' : '2. Edit Balance'} ({selectedAccount.currency})
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  required
                  autoFocus
                  placeholder="0.00"
                  value={singleAmount}
                  onChange={(e) => setSingleAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3.5 text-xl font-black text-slate-900 focus:bg-white focus:border-emerald-500 focus:outline-hidden transition-colors"
                />
                <span className="absolute end-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">
                  {selectedAccount.currency}
                </span>
              </div>
            </div>

            {/* Quick Presets for Convenience */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] font-bold text-slate-400">
                {lang === 'ar' ? 'خيارات سريعة:' : 'Quick:'}
              </span>
              <button
                type="button"
                onClick={() => setSingleAmount('0')}
                className="text-xs font-semibold px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                0 ({lang === 'ar' ? 'تصفير' : 'Zero'})
              </button>
              {[100, 500, 1000, 5000].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setSingleAmount(String(preset))}
                  className="text-xs font-semibold px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg transition-colors cursor-pointer"
                >
                  +{preset.toLocaleString()}
                </button>
              ))}
            </div>

            {/* زر حفظ و إلغاء */}
            <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                {t.btnCancel}
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors active:scale-95"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{lang === 'ar' ? 'حفظ' : 'Save'}</span>
              </button>
            </div>
          </form>
        ) : (
          /* Form: Bulk Opening Balances for all accounts */
          <form onSubmit={handleBulkSubmit} className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-600">
                {lang === 'ar' ? 'حدد الرصيد الافتتاحي لكل حساب:' : 'Set opening balance for each account:'}
              </span>
              <button
                type="button"
                onClick={handleResetAllToZero}
                className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? 'تصفير الكل (0)' : 'Reset All to 0'}</span>
              </button>
            </div>

            <div className="space-y-2.5">
              {accounts.map((acc) => {
                const displayName = lang === 'ar' ? acc.nameAr : acc.name;
                const currentVal = bulkAmounts[acc.id] ?? '0';

                return (
                  <div
                    key={acc.id}
                    className="p-3 bg-slate-50 border border-slate-200/80 rounded-2xl flex items-center justify-between gap-3 hover:border-slate-300 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-white border border-slate-200 flex items-center justify-center shrink-0">
                        {getAccountIcon(acc.type)}
                      </div>
                      <div className="truncate">
                        <span className="text-xs font-bold text-slate-800 block truncate">
                          {displayName}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          {acc.currency}
                        </span>
                      </div>
                    </div>

                    <div className="relative w-36 sm:w-44 shrink-0">
                      <input
                        type="number"
                        step="any"
                        placeholder="0"
                        value={currentVal}
                        onChange={(e) =>
                          setBulkAmounts((prev) => ({
                            ...prev,
                            [acc.id]: e.target.value,
                          }))
                        }
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm font-black text-slate-900 focus:border-emerald-500 focus:outline-hidden text-end pe-10"
                      />
                      <span className="absolute end-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400 font-mono pointer-events-none">
                        {acc.currency}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                {t.btnCancel}
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors"
              >
                <Check className="w-4 h-4" />
                <span>{t.saveInitialBalances}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
