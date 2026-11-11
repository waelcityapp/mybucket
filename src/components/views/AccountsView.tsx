import React, { useState, FormEvent } from 'react';
import { Plus, CreditCard, Banknote, Building2, PiggyBank, Smartphone, ArrowLeftRight, FolderKanban, ShieldCheck, X, Pencil, RotateCcw, Trash2 } from 'lucide-react';
import { FinancialAccount, CurrencyCode, AccountType, Language, SUPPORTED_CURRENCIES, currencyName } from '../../types';
import { translations } from '../../data/translations';
import { formatAccountBalance } from '../../utils/formatBalance';

interface AccountsViewProps {
  accounts: FinancialAccount[];
  lang: Language;
  onAddAccount: (acc: Omit<FinancialAccount, 'id'>) => Promise<boolean>;
  onDeleteAccount: (accountId: string) => Promise<boolean>;
  onEditBalance?: (accId: string | null) => void;
  onZeroAllBalances: () => Promise<boolean>;
}

export function AccountsView({ accounts, lang, onAddAccount, onDeleteAccount, onEditBalance, onZeroAllBalances }: AccountsViewProps) {
  const t = translations[lang];
  const [showAddModal, setShowAddModal] = useState(() => window.location.pathname === '/accounts/new');
  const openAdd = () => { window.history.pushState({ accountCreate: true }, '', '/accounts/new'); setShowAddModal(true); };
  const closeAdd = () => { setShowAddModal(false); if (window.location.pathname === '/accounts/new') window.history.replaceState({}, '', '/'); };
  React.useEffect(() => { const onBack = () => setShowAddModal(window.location.pathname === '/accounts/new'); window.addEventListener('popstate', onBack); return () => window.removeEventListener('popstate', onBack); }, []);
  const [name, setName] = useState('');
  const [currency, setCurrency] = useState<CurrencyCode>('EGP');
  const [type, setType] = useState<AccountType>('bank');
  const [initialBalance, setInitialBalance] = useState('');
  const [linkMode, setLinkMode] = useState<'' | 'independent' | 'linked'>('');
  const [linkedBankId, setLinkedBankId] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  // Group balances by currency to strictly prevent combining different currencies
  const balancesByCurrency = accounts.reduce((acc, account) => {
    if (!account.linkedBankId && account.type !== 'credit') acc[account.currency] = (acc[account.currency] || 0) + account.balance;
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

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault();
    if (saving || !name.trim()) return;
    const linked = (type === 'card' || type === 'wallet') && linkMode === 'linked';
    const bank = linked ? accounts.find(account => account.id === linkedBankId && account.type === 'bank') : null;
    const amount = Number(initialBalance || 0);
    const limit = Number(creditLimit);
    if (((type === 'card' || type === 'wallet') && !linkMode) || (linked && !bank) || !Number.isFinite(amount) || amount < 0 || (type === 'credit' && (!Number.isFinite(limit) || limit <= 0 || amount > limit))) {
      setError(lang === 'ar' ? 'راجع الحساب البنكي أو الحد الائتماني والمبلغ المستحق.' : 'Check the bank, credit limit and outstanding amount.'); return;
    }
    setSaving(true); setError('');
    const ok = await onAddAccount({ name: name.trim(), nameAr: name.trim(), type, balance: linked ? 0 : type === 'credit' ? -amount : amount, currency: bank?.currency || currency, ...(bank ? { linkedBankId: bank.id } : {}), ...(type === 'credit' ? { creditLimit: limit } : {}) });
    setSaving(false);
    if (ok) { setName(''); setInitialBalance(''); setCreditLimit(''); setLinkedBankId(''); setLinkMode(''); closeAdd(); }
    else setError(lang === 'ar' ? 'تعذر حفظ الحساب. راجع الاتصال وحاول مرة أخرى.' : 'Could not save account. Check connection and try again.');
  };

  return (
    <div className="space-y-5 pb-20">
      {/* Header */}
      <div className={showAddModal ? "hidden" : "flex items-center justify-between"}>
        <div>
          <h1 className="text-xl font-extrabold text-slate-900 ">
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
            onClick={openAdd}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>{t.addAccount}</span>
          </button>
        </div>
      </div>

      {!showAddModal && <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
        <h2 className="text-sm font-bold text-slate-800">{lang === 'ar' ? 'إدارة الحسابات' : 'Manage accounts'}</h2>
        <p className="text-xs leading-5 text-slate-600">{lang === 'ar' ? 'يمكنك إضافة حساب وتعديل أرصدته من هذه الصفحة. تصفير الأرصدة لا يحذف الحسابات أو العمليات المسجلة.' : 'Add accounts and edit their balances here. Resetting balances does not delete accounts or transaction history.'}</p>
        <button type="button" disabled={resetting} onClick={async () => { if (resetting) return; setResetting(true); try { await onZeroAllBalances(); } finally { setResetting(false); } }} className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 disabled:opacity-50"><RotateCcw className="h-4 w-4" />{resetting ? (lang === 'ar' ? 'جارٍ التصفير...' : 'Resetting...') : (lang === 'ar' ? 'تصفير جميع أرصدة الحسابات' : 'Reset all account balances')}</button>
      </section>}

      {/* Balances by currency badge banner */}
      <div className={showAddModal ? "hidden" : "bg-slate-900 text-white p-5 rounded-3xl space-y-2"}>
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
                {formatAccountBalance(total, lang)} <span className="text-xs text-emerald-400 font-normal">{curr}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {!showAddModal && accounts.some(acc => acc.balance < 0 && acc.type !== 'credit') && (
        <p role="alert" className="text-sm font-semibold text-amber-900 bg-amber-50 border border-amber-200 rounded-xl p-3">
          {lang === 'ar' ? 'يوجد رصيد سالب مسجل سابقًا. راجع الحساب وصحح رصيده الفعلي.' : 'A previously recorded account balance is negative. Review the account and correct its actual balance.'}
        </p>
      )}
      {/* All account cards share the same compact size; deletion confirmation can expand. */}
      <div className={showAddModal ? "hidden" : "grid grid-cols-1 sm:grid-cols-2 gap-3.5"}>
        {accounts.map((acc) => (
          <div
            key={acc.id}
            className={`min-w-0 rounded-2xl border border-slate-200 bg-white px-3 py-2 shadow-2xs transition-all hover:shadow-xs group ${confirmDeleteId === acc.id ? 'min-h-[92px]' : 'h-[92px]'}`}
          >
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-slate-50">
                {getAccountIcon(acc.type)}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate text-[13px] font-bold leading-5 text-slate-900" title={lang === 'ar' ? acc.nameAr : acc.name}>
                  {lang === 'ar' ? acc.nameAr : acc.name}
                </h3>
                <p
                  className="truncate text-[10px] font-medium leading-4 text-slate-500"
                  title={`${acc.linkedBankId ? (lang === 'ar' ? 'مرتبطة بـ ' : 'Linked to ') + (accounts.find(a => a.id === acc.linkedBankId)?.[lang === 'ar' ? 'nameAr' : 'name'] || '—') : acc.type === 'credit' ? (lang === 'ar' ? 'بطاقة ائتمان' : 'Credit card') : acc.type} · ${acc.currency}`}
                >
                  {acc.linkedBankId ? `${lang === 'ar' ? 'مرتبطة بـ' : 'Linked to'} ${accounts.find(a => a.id === acc.linkedBankId)?.[lang === 'ar' ? 'nameAr' : 'name'] || '—'}` : acc.type === 'credit' ? (lang === 'ar' ? 'بطاقة ائتمان' : 'Credit card') : acc.type} · {acc.currency}
                </p>
              </div>
            </div>

            <div className="mt-1.5 flex min-w-0 items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-baseline gap-1">
                  <strong
                    dir="ltr"
                    className="min-w-0 max-w-full overflow-x-auto whitespace-nowrap text-sm font-black leading-5 tabular-nums text-slate-900 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                    title={String(acc.type === 'credit' ? Math.max(0, -acc.balance) : acc.linkedBankId ? (accounts.find(a => a.id === acc.linkedBankId)?.balance ?? 0) : acc.balance)}
                  >
                    {formatAccountBalance(acc.type === 'credit' ? Math.max(0, -acc.balance) : acc.linkedBankId ? (accounts.find(a => a.id === acc.linkedBankId)?.balance ?? 0) : acc.balance, lang)}
                  </strong>
                  <span className="shrink-0 text-[10px] font-semibold text-slate-500">{acc.currency}</span>
                </div>
                {acc.type === 'credit' && (
                  <p className="truncate text-[9px] leading-3 text-slate-500" title={`${lang === 'ar' ? 'المتاح' : 'Available'}: ${formatAccountBalance((acc.creditLimit || 0) + acc.balance, lang)}`}>
                    {lang === 'ar' ? 'المتاح' : 'Available'}: {formatAccountBalance((acc.creditLimit || 0) + acc.balance, lang)}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-1">
                {onEditBalance && acc.type !== 'credit' && (
                  <button
                    type="button"
                    title={lang === 'ar' ? 'تعديل الرصيد الافتتاحي' : 'Edit Balance'}
                    aria-label={lang === 'ar' ? `تعديل رصيد ${acc.nameAr}` : `Edit balance of ${acc.name}`}
                    onClick={() => onEditBalance(acc.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  disabled={deletingId !== null}
                  title={lang === 'ar' ? 'مسح الحساب غير المستخدم' : 'Delete unused account'}
                  aria-label={lang === 'ar' ? `مسح حساب ${acc.nameAr}` : `Delete account ${acc.name}`}
                  onClick={() => setConfirmDeleteId(acc.id)}
                  className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600 transition-colors hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {confirmDeleteId === acc.id && (
              <div className="mt-3 w-full rounded-xl border border-rose-200 bg-rose-50 p-3 text-start">
                <p className="text-xs font-bold text-rose-900">
                  {lang === 'ar' ? `هل تريد مسح حساب «${acc.nameAr}»؟ لن يتم حذف أي عمليات مالية، ولا يُسمح بمسح حساب له رصيد أو عمليات أو حسابات مرتبطة.` : `Delete “${acc.name}”? Transactions are never deleted; accounts with balances, transactions or linked methods cannot be removed.`}
                </p>
                <div className="mt-2 flex gap-2">
                  <button type="button" disabled={deletingId !== null}
                    onClick={async () => {
                      if (deletingId !== null) return;
                      setDeletingId(acc.id);
                      try {
                        const success = await onDeleteAccount(acc.id);
                        if (success) setConfirmDeleteId(null);
                      } finally { setDeletingId(null); }
                    }}
                    className="rounded-lg bg-rose-600 px-3 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50">
                    {deletingId === acc.id ? (lang === 'ar' ? 'جارٍ المسح...' : 'Deleting...') : (lang === 'ar' ? 'تأكيد المسح' : 'Confirm delete')}
                  </button>
                  <button type="button" disabled={deletingId !== null} onClick={() => setConfirmDeleteId(null)}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">
                    {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="w-full max-w-2xl mx-auto">
          <div className="bg-white w-full rounded-3xl p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">{t.addAccount}</h2>
              <button
                type="button"
                onClick={closeAdd}
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
                  maxLength={40}
                  onChange={(e) => setName(e.target.value.slice(0,40))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs font-medium focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                />
                <p className="text-end text-[11px] text-slate-500" dir="ltr">{name.length} / 40</p>
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
                    <option value="credit">{lang === 'ar' ? 'بطاقة ائتمان' : 'Credit card'}</option>
                    <option value="card">{lang === 'ar' ? 'بطاقة خصم مباشر / فيزا' : 'Debit card'}</option>
                    <option value="wallet">{lang === 'ar' ? 'إنستاباي / محفظة إلكترونية' : 'InstaPay / wallet'}</option>
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
                    value={((type === 'card' || type === 'wallet') && linkMode === 'linked' && linkedBankId) ? (accounts.find(a => a.id === linkedBankId)?.currency || currency) : currency}
                    disabled={(type === 'card' || type === 'wallet') && linkMode === 'linked'}
                    onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold font-mono"
                  >
                    {SUPPORTED_CURRENCIES.map(code => <option key={code} value={code}>{currencyName(code, lang)} ({code})</option>)}
                  </select>
                </div>
              </div>

              {(type === 'card' || type === 'wallet') && <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">{lang === 'ar' ? 'طريقة الحساب' : 'Account setup'}</label>
                <select required value={linkMode} onChange={e => setLinkMode(e.target.value as '' | 'independent' | 'linked')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold">
                  <option value="">{lang === 'ar' ? 'اختر نوع الحساب' : 'Choose account setup'}</option><option value="independent">{lang === 'ar' ? 'مستقلة برصيد خاص' : 'Independent balance'}</option><option value="linked">{lang === 'ar' ? 'مرتبطة بحساب بنكي' : 'Linked to a bank account'}</option>
                </select>
                {linkMode === 'linked' && <select value={linkedBankId} onChange={e => setLinkedBankId(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"><option value="">{lang === 'ar' ? 'اختر الحساب البنكي' : 'Choose a bank account'}</option>{accounts.filter(a => a.type === 'bank').map(a => <option key={a.id} value={a.id}>{a.nameAr} ({a.currency})</option>)}</select>}
              </div>}
              {(type === 'card' || type === 'wallet') && linkMode === 'linked' && <p className="text-xs text-slate-500">{lang === 'ar' ? 'تستخدم الوسيلة رصيد البنك وعملته، ولا يُحسب رصيدها مرة أخرى في الإجمالي.' : 'This method uses the bank account balance and currency.'}</p>}
              {type === 'credit' && <div><label className="block text-xs font-bold text-slate-700 mb-1">{lang === 'ar' ? 'الحد الائتماني' : 'Credit limit'}</label><input type="number" min="0.01" step="any" required value={creditLimit} onChange={e => setCreditLimit(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2" /></div>}
              {error && <p role="alert" className="text-xs text-rose-700">{error}</p>}
              {!((type === 'card' || type === 'wallet') && linkMode === 'linked') && <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  {type === 'credit' ? (lang === 'ar' ? 'المبلغ المستحق حاليًا' : 'Current amount owed') : (lang === 'ar' ? 'الرصيد الافتتاحي' : 'Initial Balance')}
                </label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.00"
                  value={initialBalance}
                  onChange={(e) => setInitialBalance(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm font-bold focus:bg-white focus:border-emerald-500 focus:outline-hidden"
                />
              </div>

              }
              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeAdd}
                  className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl cursor-pointer"
                >
                  {t.btnCancel}
                </button>
                <button
                  type="submit"
                  disabled={saving}
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
