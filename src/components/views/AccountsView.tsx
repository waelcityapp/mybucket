import { useState, FormEvent } from 'react';
import { Plus, CreditCard, Banknote, Building2, PiggyBank, Smartphone, ArrowLeftRight, FolderKanban, ShieldCheck, X, Pencil } from 'lucide-react';
import { FinancialAccount, CurrencyCode, AccountType, Language } from '../../types';
import { translations } from '../../data/translations';

interface AccountsViewProps {
  accounts: FinancialAccount[];
  lang: Language;
  onAddAccount: (acc: Omit<FinancialAccount, 'id'>) => void;
  onEditBalance?: (accId: string | null) => void;
}

export function AccountsView({ accounts, lang, onAddAccount, onEditBalance }: AccountsViewProps) {
  const t = translations[lang];
  const [showAddModal, setShowAddModal] = useState(false);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('EGP');
  const [type, setType] = useState<AccountType>('bank');
  const [initialBalance, setInitialBalance] = useState('');

  // Group balances by currency to strictly prevent combining different currencies
  const balancesByCurrency = accounts.reduce((acc, account) => {
    acc[account.currency] = (acc[account.currency] || 0) + account.balance;
    return acc;
  }, {} as Record<CurrencyCode, number>);

  const getAccountIcon = (accType: string) => {
    switch (accType) {
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

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
      maximumFractionDigits: 2,
    }).format(num);
  };

  const handleCreate = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const balance = parseFloat(initialBalance) || 0;

    onAddAccount({
      name: name.trim(),
      nameAr: name.trim(),
      type,
      balance,
      currency,
    });

    setName('');
    setInitialBalance('');
    setShowAddModal(false);
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
            {t.accountsTitle}
          </h1>
          <p className="text-xs text-slate-500">{t.accountsSubtitle}</p>
        </div>

        <div className="flex items-center gap-2">
          {onEditBalance && (
            <button
              type="button"
              onClick={() => onEditBalance(null)}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl shadow-2xs transition-colors cursor-pointer"
            >
              <Pencil className="w-3.5 h-3.5 text-slate-500" />
              <span>{t.setInitialBalances}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addAccount}</span>
          </button>
        </div>
      </div>

      {/* Balances by currency badge banner */}
      <div className="bg-slate-900 text-white p-5 rounded-3xl space-y-2">
        <div className="flex items-center gap-2 text-xs font-bold text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>{t.balancesByCurrency}</span>
        </div>
        <p className="text-[11px] text-slate-400 font-medium">
          {t.noCombinedCurrencyNote}
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2">
          {Object.entries(balancesByCurrency).map(([curr, total]) => (
            <div key={curr} className="bg-white/10 rounded-2xl p-3 border border-white/10">
              <span className="text-[11px] font-mono text-slate-300">{curr}</span>
              <div className="text-lg font-black text-white">
                {formatNumber(total)} <span className="text-xs text-emerald-400 font-normal">{curr}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* List of Accounts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs hover:shadow-xs transition-all flex items-center justify-between group"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center">
                {getAccountIcon(acc.type)}
              </div>
              <div>
                <h3 className="font-bold text-slate-900 text-sm">
                  {lang === 'ar' ? acc.nameAr : acc.name}
                </h3>
                <span className="text-[11px] text-slate-400 font-medium capitalize">
                  {acc.type} · {acc.currency}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="text-end">
                <div className="text-base font-black text-slate-900">
                  {formatNumber(acc.balance)}
                </div>
                <span className="text-xs font-bold text-slate-500 font-mono">
                  {acc.currency}
                </span>
              </div>

              {onEditBalance && (
                <button
                  type="button"
                  title={lang === 'ar' ? 'تعديل الرصيد الافتتاحي' : 'Edit Balance'}
                  onClick={() => onEditBalance(acc.id)}
                  className="w-8 h-8 rounded-xl bg-slate-50 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white w-full max-w-md rounded-3xl p-5 shadow-2xl border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">{t.addAccount}</h2>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="w-7 h-7 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === 'ar' ? 'اسم الحساب' : 'Account Name'}
                </label>
                <input
                  type="text"
                  required
                  placeholder={lang === 'ar' ? 'مثال: محفظة شخصية، بنك مصر...' : 'e.g. Personal Wallet'}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {lang === 'ar' ? 'النوع' : 'Type'}
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as AccountType)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    <option value="cash">{lang === 'ar' ? 'كاش' : 'Cash'}</option>
                    <option value="bank">{lang === 'ar' ? 'بنك' : 'Bank'}</option>
                    <option value="card">{lang === 'ar' ? 'بطاقة/فيزا' : 'Card'}</option>
                    <option value="wallet">{lang === 'ar' ? 'محفظة إلكترونية' : 'E-Wallet'}</option>
                    <option value="other">{lang === 'ar' ? 'وسائل دفع واستلام أخرى' : 'Other Methods'}</option>
                    <option value="custom">{lang === 'ar' ? 'حسابات أخرى' : 'Other Accounts'}</option>
                    <option value="savings">{lang === 'ar' ? 'ادخار' : 'Savings'}</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {lang === 'ar' ? 'العملة' : 'Currency'}
                  </label>
                  <select
                    value={currency}
                    onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold font-mono"
                  >
                    <option value="EGP">EGP (جنيه مصري)</option>
                    <option value="USD">USD ($)</option>
                    <option value="SAR">SAR (ريال سعودي)</option>
                    <option value="AED">AED (درهم إماراتي)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {lang === 'ar' ? 'الرصيد الافتتاحي' : 'Initial Balance'}
                </label>
                <input
                  type="number"
                  step="any"
                  placeholder="0.00"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  {t.btnCancel}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-emerald-600 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
                >
                  {lang === 'ar' ? 'حفظ الحساب' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
