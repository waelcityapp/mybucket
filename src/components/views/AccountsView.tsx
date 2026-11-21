import React, { useState, FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Plus, CreditCard, Banknote, Building2, PiggyBank, Smartphone, ArrowLeftRight, FolderKanban, ShieldCheck, X, Pencil, Trash2 } from 'lucide-react';
import { FinancialAccount, CurrencyCode, AccountType, Language, SUPPORTED_CURRENCIES, currencyName } from '../../types';
import { translations } from '../../data/translations';
import { isProtectedCashAccount } from '../../utils/accountDetails';
import { formatAccountBalance } from '../../utils/formatBalance';

interface AccountsViewProps {
  accounts: FinancialAccount[];
  lang: Language;
  canAddAccounts: boolean;
  onOpenProPlan: () => void;
  onAddAccount: (acc: Omit<FinancialAccount, 'id'>) => Promise<boolean>;
  editingAccount?: FinancialAccount;
  canChangeAccountDetails: boolean;
  onSaveAccount: (expected: FinancialAccount, account: FinancialAccount) => Promise<boolean>;
  onCloseEdit: () => void;
  onDeleteAccount: (accountId: string) => Promise<boolean>;
  onEditBalance?: (accId: string | null) => void;
}

export function AccountsView({ accounts, lang, canAddAccounts, onOpenProPlan, onAddAccount, editingAccount, canChangeAccountDetails, onSaveAccount, onCloseEdit, onDeleteAccount, onEditBalance }: AccountsViewProps) {
  const t = translations[lang];
  const lockDetails = Boolean(editingAccount) && !canChangeAccountDetails;
  const [originalAccount] = useState(editingAccount);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [lockedCard, setLockedCard] = useState<string | null>(null);
  const [addRequested, setShowAddModal] = useState(() => window.location.pathname === '/accounts/new');
  const showAddModal = Boolean(editingAccount) || (canAddAccounts && addRequested);
  const openAdd = () => { if (!canAddAccounts) { setShowUpgrade(true); return; } window.history.pushState({ accountCreate: true }, '', '/accounts/new'); setShowAddModal(true); };
  const closeAdd = () => { if (editingAccount) { onCloseEdit(); return; } setShowAddModal(false); if (window.location.pathname === '/accounts/new') window.history.replaceState({}, '', '/'); };
  React.useEffect(() => { const onBack = () => setShowAddModal(window.location.pathname === '/accounts/new'); window.addEventListener('popstate', onBack); return () => window.removeEventListener('popstate', onBack); }, []);
  const [name, setName] = useState(() => editingAccount ? (lang === 'ar' ? editingAccount.nameAr : editingAccount.name) : '');
  const [currency, setCurrency] = useState<CurrencyCode>(editingAccount?.currency ?? 'EGP');
  const [type, setType] = useState<AccountType>(editingAccount?.type ?? 'bank');
  const [initialBalance, setInitialBalance] = useState(editingAccount ? String(editingAccount.type === 'credit' ? -editingAccount.balance : editingAccount.balance) : '');
  const [linkMode, setLinkMode] = useState<'' | 'independent' | 'linked'>(editingAccount ? (editingAccount.linkedBankId ? 'linked' : 'independent') : '');
  const [linkedBankId, setLinkedBankId] = useState(editingAccount?.linkedBankId ?? '');
  const [creditLimit, setCreditLimit] = useState(editingAccount?.creditLimit?.toString() ?? '');
  const [saving, setSaving] = useState(false);
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
    if (saving || !name.trim() || name.trim().length > 40) return;
    const linked = (type === 'card' || type === 'wallet') && linkMode === 'linked';
    const bank = linked ? accounts.find(account => account.id === linkedBankId && account.type === 'bank') : null;
    const amount = Number(initialBalance || 0);
    const limit = Number(creditLimit);
    if (((type === 'card' || type === 'wallet') && !linkMode) || (linked && !bank) || !Number.isFinite(amount) || amount < 0 || (type === 'credit' && (!Number.isFinite(limit) || limit <= 0 || amount > limit))) {
      setError(lang === 'ar' ? 'راجع الحساب البنكي أو الحد الائتماني والمبلغ المستحق.' : 'Check the bank, credit limit and outstanding amount.'); return;
    }
    setSaving(true); setError('');
    const draft = { name: name.trim(), nameAr: name.trim(), type, balance: linked ? 0 : type === 'credit' ? -amount : amount, currency: bank?.currency || currency, ...(bank ? { linkedBankId: bank.id } : {}), ...(type === 'credit' ? { creditLimit: limit } : {}) };
    const unchangedName = originalAccount && name.trim() === (lang === 'ar' ? originalAccount.nameAr : originalAccount.name);
    const ok = originalAccount
      ? await onSaveAccount(originalAccount, { ...originalAccount, ...draft, linkedBankId: bank?.id, creditLimit: type === 'credit' ? limit : undefined,
          ...(unchangedName ? { name: originalAccount.name, nameAr: originalAccount.nameAr } : {}),
        })
      : await onAddAccount(draft);
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

      {!canAddAccounts && (showUpgrade || addRequested) && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-900">
          <p role="status">
            {lang === 'ar' ? 'يجب الترقية إلى خطة Pro لإضافة حساب آخر.' : 'Upgrade to Pro to add another account.'}
          </p>
          <button
            type="button"
            onClick={onOpenProPlan}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-2 text-xs hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-emerald-600"
          >
            {lang === 'ar' ? 'عرض خطة Pro' : 'View Pro plan'}
            {lang === 'ar' ? <ArrowLeft aria-hidden="true" className="size-4" /> : <ArrowRight aria-hidden="true" className="size-4" />}
          </button>
        </div>
      )}
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
                {onEditBalance && (
                  <button
                    type="button"
                    title={lang === 'ar' ? 'تعديل الحساب' : 'Edit account'}
                    aria-label={lang === 'ar' ? `تعديل حساب ${acc.nameAr}` : `Edit account ${acc.name}`}
                    onClick={() => onEditBalance(acc.id)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-50 text-slate-500 transition-colors hover:bg-slate-200 hover:text-slate-700"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                )}
                {!isProtectedCashAccount(acc) && (
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
                )}
              </div>
            </div>

            {!isProtectedCashAccount(acc) && confirmDeleteId === acc.id && (
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
        {!canAddAccounts && [
          { id: 'visa', label: lang === 'ar' ? 'فيزا' : 'Visa' },
          { id: 'credit', label: lang === 'ar' ? 'بطاقة الائتمان' : 'Credit card' },
        ].map(({ id, label }) => (
          <div key={id} className="overflow-hidden rounded-2xl border border-dashed border-slate-300 bg-slate-50 dark:border-slate-700 dark:bg-slate-900">
            <button type="button" onClick={() => setLockedCard(id)} aria-expanded={lockedCard === id}
              className="flex min-h-24 w-full items-center gap-3 px-4 text-start text-slate-700 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-slate-200 dark:hover:bg-slate-800">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <CreditCard className="size-5" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 text-sm font-bold">{label}</span>
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-900">Pro</span>
            </button>
            {lockedCard === id && <div className="mx-3 mb-3 flex items-center justify-between gap-2 rounded-lg bg-amber-50 px-3 text-xs font-bold text-amber-900">
              <span role="status">
              {lang === 'ar' ? 'يجب الترقية إلى الخطة برو.' : 'Upgrade to the Pro plan.'}</span>
              <button type="button" onClick={onOpenProPlan} aria-label={lang === 'ar' ? 'عرض اشتراك Pro' : 'View Pro plan'}
                className="grid size-11 shrink-0 place-items-center rounded-lg hover:bg-amber-100 focus-visible:outline-2 focus-visible:outline-emerald-600">
                {lang === 'ar' ? <ArrowLeft className="size-4" /> : <ArrowRight className="size-4" />}
              </button>
            </div>}
          </div>
        ))}

      </div>

      {/* Add Account Modal */}
      {showAddModal && (
        <div className="w-full max-w-2xl mx-auto">
          <div className="bg-white w-full rounded-3xl p-5 border border-slate-200 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h2 className="text-base font-bold text-slate-900">{editingAccount ? (lang === 'ar' ? 'تعديل الحساب' : 'Edit account') : t.addAccount}</h2>
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
                <p aria-live="polite" className={`text-end text-[11px] font-semibold ${40 - name.length <= 15 ? 'text-red-600' : 'text-slate-500'}`}>{lang === 'ar' ? `المتبقي: ${40 - name.length} حرف` : `Remaining: ${40 - name.length} characters`}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {lang === 'ar' ? 'النوع' : 'Type'}
                  </label>
                  <select
                    value={type}
                    disabled={lockDetails}
                    onChange={(e) => setType(e.target.value as AccountType)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"
                  >
                    <option value="cash">{lang === 'ar' ? 'كاش' : 'Cash'}</option>
                    <option value="bank">{lang === 'ar' ? 'بنك' : 'Bank'}</option>
                    <option value="credit" disabled={Boolean(editingAccount) && !canAddAccounts && editingAccount?.type !== 'credit'}>{lang === 'ar' ? 'بطاقة ائتمان' : 'Credit card'}</option>
                    <option value="card" disabled={Boolean(editingAccount) && !canAddAccounts && editingAccount?.type !== 'card'}>{lang === 'ar' ? 'بطاقة خصم مباشر / فيزا' : 'Debit card'}</option>
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
                    disabled={lockDetails || ((type === 'card' || type === 'wallet') && linkMode === 'linked')}
                    onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold font-mono"
                  >
                    {SUPPORTED_CURRENCIES.map(code => <option key={code} value={code}>{currencyName(code, lang)} ({code})</option>)}
                  </select>
                </div>
              </div>

              {(type === 'card' || type === 'wallet') && <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700">{lang === 'ar' ? 'طريقة الحساب' : 'Account setup'}</label>
                <select required disabled={lockDetails} value={linkMode} onChange={e => setLinkMode(e.target.value as '' | 'independent' | 'linked')} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold">
                  <option value="">{lang === 'ar' ? 'اختر نوع الحساب' : 'Choose account setup'}</option><option value="independent">{lang === 'ar' ? 'مستقلة برصيد خاص' : 'Independent balance'}</option><option value="linked">{lang === 'ar' ? 'مرتبطة بحساب بنكي' : 'Linked to a bank account'}</option>
                </select>
                {linkMode === 'linked' && <select disabled={lockDetails} value={linkedBankId} onChange={e => setLinkedBankId(e.target.value)} required className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold"><option value="">{lang === 'ar' ? 'اختر الحساب البنكي' : 'Choose a bank account'}</option>{accounts.filter(a => a.type === 'bank' && a.id !== editingAccount?.id).map(a => <option key={a.id} value={a.id}>{a.nameAr} ({a.currency})</option>)}</select>}
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
