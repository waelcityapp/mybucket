import { useState, type FormEvent } from 'react';
import type { FinancialAccount, Language } from '../../types';

type BankDraft = { name: string; balance: string };
interface Props {
  lang: Language;
  onSave: (accounts: Array<Omit<FinancialAccount, 'id'>>) => Promise<void>;
}

export function InitialSetupView({ lang, onSave }: Props) {
  const isAr = lang === 'ar';
  const [banks, setBanks] = useState<BankDraft[]>([]);
  const [cash, setCash] = useState('0');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const updateBank = (index: number, update: Partial<BankDraft>) => setBanks(items => items.map((item, i) => i === index ? { ...item, ...update } : item));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving) return;
    const cashAmount = Number(cash);
    if (!Number.isFinite(cashAmount) || cashAmount < 0 || banks.some(bank => !bank.name.trim() || !Number.isFinite(Number(bank.balance)) || Number(bank.balance) < 0)) {
      setError(isAr ? 'اكتب اسم كل بنك ورصيدًا صحيحًا لا يقل عن صفر.' : 'Enter a name and a non-negative balance for each bank.'); return;
    }
    const accounts: Array<Omit<FinancialAccount, 'id'>> = [
      { name: 'Cash', nameAr: 'كاش', type: 'cash', balance: cashAmount, currency: 'EGP' },
      ...banks.map(bank => ({ name: bank.name.trim(), nameAr: bank.name.trim(), type: 'bank' as const, balance: Number(bank.balance), currency: 'EGP' as const })),
    ];
    setSaving(true); setError('');
    try { await onSave(accounts); }
    catch { setError(isAr ? 'تعذر حفظ الإعدادات. تأكد من الاتصال وحاول مرة أخرى.' : 'Could not save setup. Check your connection and retry.'); }
    finally { setSaving(false); }
  };
  return <main dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 px-4 py-8 text-slate-900">
    <form onSubmit={submit} className="mx-auto max-w-xl space-y-5">
      <header><p className="text-sm font-bold text-emerald-700">My Bucket</p><h1 className="mt-2 text-2xl font-black">{isAr ? 'خلّينا نجهّز حساباتك' : 'Set up your accounts'}</h1><p className="mt-2 text-sm text-slate-600">{isAr ? 'ابدأ بالبنوك التي تستخدمها، أو تخطّها لو تعتمد على الكاش. يمكنك إضافة وسائل الدفع وربطها بعد ذلك.' : 'Add your banks, or skip them if you use cash. You can add and link payment methods later.'}</p></header>
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"><h2 className="font-bold">{isAr ? 'الحسابات البنكية' : 'Bank accounts'}</h2>
        {banks.map((bank, i) => <div key={i} className="space-y-2 rounded-xl border border-slate-200 p-3"><label className="block text-sm">{isAr ? 'اسم البنك أو الحساب' : 'Bank or account name'}<input required value={bank.name} onChange={e => updateBank(i, { name: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 p-2" /></label><label className="block text-sm">{isAr ? 'الرصيد الحالي بالجنيه' : 'Current balance (EGP)'}<input type="number" required min="0" step="any" value={bank.balance} onChange={e => updateBank(i, { balance: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-300 p-2" /></label><button type="button" onClick={() => setBanks(items => items.filter((_, n) => n !== i))} className="text-sm font-bold text-rose-700">{isAr ? 'إزالة البنك' : 'Remove bank'}</button></div>)}
        <button type="button" onClick={() => setBanks(items => [...items, { name: '', balance: '0' }])} className="rounded-xl border border-emerald-700 px-4 py-2 text-sm font-bold text-emerald-700">{isAr ? '+ إضافة حساب بنكي' : '+ Add bank account'}</button>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-4"><label className="block font-bold">{isAr ? 'رصيد الكاش الحالي بالجنيه' : 'Current cash balance (EGP)'}<input type="number" required min="0" step="any" value={cash} onChange={e => setCash(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-300 p-2" /></label></section>
      {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
      <button type="submit" disabled={saving} className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-bold text-white disabled:opacity-50">{saving ? (isAr ? 'جارٍ الحفظ...' : 'Saving...') : (isAr ? 'حفظ والبدء' : 'Save and continue')}</button>
    </form>
  </main>;
}
