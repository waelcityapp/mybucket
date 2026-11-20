import { useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, X } from 'lucide-react';
import { SUPPORTED_CURRENCIES, currencyName, type CurrencyCode, type FinancialAccount, type Language } from '../../types';
import { useAppConfirm } from '../AppConfirmDialog';

const starterAccounts = [
  { type: 'cash', name: 'Cash', nameAr: 'الكاش' },
  { type: 'bank', name: 'Bank account (Banque Misr)', nameAr: 'حساب بنك (بنك مصر)' },
  { type: 'wallet', name: 'InstaPay account', nameAr: 'حساب الإنستاباي' },
  { type: 'wallet', name: 'Vodafone Cash', nameAr: 'فودافون كاش' },
] as const;
type AccountDraft = { name: string; balance: string; currency: CurrencyCode };
interface Props {
  lang: Language;
  onSave: (accounts: Array<Omit<FinancialAccount, 'id'>>) => Promise<void>;
  preview?: boolean;
  onClosePreview?: () => void;
  onBack?: () => void | Promise<void>;
  onCancel?: () => void | Promise<void>;
  backLabel?: string;
  canAddAccounts?: boolean;
}

export function InitialSetupView({ lang, onSave, preview = false, onClosePreview, onBack, onCancel, backLabel, canAddAccounts = false }: Props) {
  const isAr = lang === 'ar';
  const confirmAction = useAppConfirm();
  const [drafts, setDrafts] = useState<AccountDraft[]>(() => starterAccounts.map(account => ({
    name: isAr ? account.nameAr : account.name, balance: '0', currency: 'EGP',
  })));
  const [addNotice, setAddNotice] = useState(false);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState('');
  const updateDraft = (index: number, update: Partial<AccountDraft>) => setDrafts(items => items.map((item, i) => i === index ? { ...item, ...update } : item));
  const leave = async (action: (() => void | Promise<void>) | undefined) => {
    if (!action || saving || leaving) return;
    const hasUnsavedChanges = drafts.some((draft, i) => draft.name !== (isAr ? starterAccounts[i].nameAr : starterAccounts[i].name) || draft.balance !== '0' || draft.currency !== 'EGP');
    if (hasUnsavedChanges) {
      const approved = await confirmAction({
        lang,
        title: isAr ? 'مغادرة إعداد الحساب؟' : 'Leave account setup?',
        description: isAr
          ? 'لديك تغييرات غير محفوظة في هذه الصفحة. إذا غادرت الآن ستفقد هذه التغييرات.'
          : 'You have unsaved changes on this page. Leaving now will discard those changes.',
        confirmLabel: isAr ? 'مغادرة دون حفظ' : 'Leave without saving',
        cancelLabel: isAr ? 'استكمال الإعداد' : 'Continue setup',
        tone: 'warning',
      });
      if (!approved) return;
    }
    setLeaving(true);
    setError('');
    try {
      await action();
    } catch (error) {
      console.error('Initial setup navigation failed:', error);
      setError(isAr ? 'تعذر الرجوع الآن. برجاء المحاولة مرة أخرى.' : 'Could not return right now. Please try again.');
    } finally {
      setLeaving(false);
    }
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || leaving || preview) return;
    if (drafts.some(draft => !draft.name.trim() || !draft.balance.trim() || !Number.isFinite(Number(draft.balance)) || Number(draft.balance) < 0)) {
      setError(isAr ? 'اكتب اسم كل حساب ورصيدًا صحيحًا لا يقل عن صفر.' : 'Enter an account name and a non-negative balance.');
      return;
    }
    const accounts = drafts.map((draft, i) => {
      const starter = starterAccounts[i];
      const name = draft.name.trim();
      const renamed = name !== (isAr ? starter.nameAr : starter.name);
      return { name: renamed ? name : starter.name, nameAr: renamed ? name : starter.nameAr,
        type: starter.type, balance: Number(draft.balance), currency: draft.currency };
    });
    setSaving(true); setError('');
    try { await onSave(accounts); }
    catch { setError(isAr ? 'تعذر حفظ الإعدادات. تأكد من الاتصال وحاول مرة أخرى.' : 'Could not save setup. Check your connection and retry.'); }
    finally { setSaving(false); }
  };
  return <main dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-5">
      {preview && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900 flex items-center justify-between gap-3"><span>{isAr ? 'معاينة مؤقتة — لن تُحفظ البيانات' : 'Temporary preview — nothing will be saved'}</span><button type="button" onClick={onClosePreview} className="shrink-0 underline">{isAr ? 'إغلاق' : 'Close'}</button></div>}
      <header className="space-y-3">
        {(onBack || onCancel) && (
          <nav aria-label={isAr ? 'التنقل أثناء إعداد الحساب' : 'Account setup navigation'} className="flex items-center justify-between gap-2">
            {onBack ? (
              <button type="button" disabled={saving || leaving} onClick={() => void leave(onBack)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50">
                {isAr ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
                {backLabel || (isAr ? 'العودة لتسجيل الدخول' : 'Back to sign-in')}
              </button>
            ) : <span />}
            {onCancel && (
              <button type="button" disabled={saving || leaving} onClick={() => void leave(onCancel)}
                className="inline-flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs sm:text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">
                <X className="w-4 h-4" />
                {isAr ? 'إلغاء الإعداد' : 'Cancel setup'}
              </button>
            )}
          </nav>
        )}
        <p className="text-sm font-bold text-emerald-700">My Bucket</p>
        <h1 className="mt-2 text-2xl font-black">{isAr ? 'خلّينا نجهّز حساباتك' : 'Set up your accounts'}</h1>
        <p className="mt-2 text-sm text-slate-600">{isAr ? 'راجع أسماء حساباتك الأربعة وأدخل أرصدتها الحالية.' : 'Review your four account names and enter their current balances.'}</p>
      </header>
      <a href="/guide" target="_blank" rel="noopener noreferrer" className="inline-block text-sm font-bold text-emerald-700 underline underline-offset-2">{isAr ? 'شرح استخدام التطبيق' : 'How to use the app'}</a>
      <section className="grid gap-3 sm:grid-cols-2">
        {drafts.map((draft, i) => <div key={starterAccounts[i].name} className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4">
          <label className="block text-sm font-bold">{isAr ? 'اسم الحساب' : 'Account name'}
            <input required maxLength={40} value={draft.name} onChange={e => updateDraft(i, { name: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 p-2" />
          </label>
          <label className="block text-sm">{isAr ? 'العملة' : 'Currency'}
            <select value={draft.currency} onChange={e => updateDraft(i, { currency: e.target.value as CurrencyCode })} className="mt-1 w-full rounded-xl border border-slate-300 p-2">
              {SUPPORTED_CURRENCIES.map(code => <option key={code} value={code}>{currencyName(code, lang)} ({code})</option>)}
            </select>
          </label>
          <label className="block text-sm">{isAr ? 'الرصيد الحالي' : 'Current balance'}
            <input type="number" required min="0" step="any" value={draft.balance} onChange={e => updateDraft(i, { balance: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 p-2" />
          </label>
        </div>)}
      </section>
      <button type="button" onClick={() => setAddNotice(true)} className="rounded-xl border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-700">
        {isAr ? '+ إنشاء حساب آخر' : '+ Create another account'}
      </button>
      {addNotice && <p role="status" className="text-sm font-semibold text-slate-700">
        {canAddAccounts
          ? (isAr ? 'احفظ الحسابات الأربعة أولًا، ثم أضف حسابًا من صفحة الحسابات.' : 'Save the four accounts first, then add one from Accounts.')
          : (isAr ? 'يجب الترقية إلى خطة Pro لإضافة حساب آخر.' : 'Upgrade to Pro to add another account.')}
      </p>}
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <button type="submit" disabled={saving || leaving || preview} className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white disabled:opacity-50">{preview ? (isAr ? 'حفظ والبدء — للعرض فقط' : 'Save and continue — preview only') : saving ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'حفظ والبدء' : 'Save and continue')}</button>
    </form>
  </main>;
}
