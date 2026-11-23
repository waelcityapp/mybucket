import { useState, type FormEvent } from 'react';
import type { Language } from '../types';
import type { UserSubscription } from '../types/prototypeSubscription';

export function AffiliateCodeSection({ subscription, lang, onApply }: {
  subscription: UserSubscription;
  lang: Language;
  onApply: (code: string) => Promise<void>;
}) {
  const ar = lang === 'ar';
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [applied, setApplied] = useState(false);
  const [error, setError] = useState('');

  async function apply(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || applied || !code.trim()) return;
    setBusy(true);
    setError('');
    try {
      await onApply(code.trim());
      setApplied(true);
    } catch (failure) {
      const reason = failure instanceof Error ? failure.message : '';
      setError(reason === 'affiliate_code_already_applied'
        ? (ar ? 'الحساب مرتبط بالفعل بكود مسوّق.' : 'This account already has a marketer code.')
        : reason.startsWith('affiliate_code_')
          ? (ar ? 'الكود غير صالح أو غير متاح حاليًا.' : 'This code is invalid or unavailable.')
          : (ar ? 'تعذّر التحقق من الكود. حاول مرة أخرى.' : 'Could not verify the code. Try again.'));
    } finally {
      setBusy(false);
    }
  }

  if (subscription.hasAppliedAffiliateCode || applied) {
    return <p role="status" className="rounded-xl border border-emerald-200 p-3 text-sm dark:border-emerald-800">
      {ar ? 'كود خصم المسوّق مُفعّل.' : 'Your marketer discount code is active.'}
    </p>;
  }

  return <form onSubmit={apply} className="space-y-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
    <label htmlFor="account-marketer-code" className="block text-sm font-semibold">{ar ? 'كود المسوّق' : 'Marketer code'}</label>
    <p className="text-xs">{ar ? 'يُطبق الكود خصمًا على الاشتراك.' : 'The code applies a discount to your subscription.'}</p>
    <div className="flex flex-wrap gap-2">
      <input id="account-marketer-code" dir="ltr" value={code} maxLength={32} required disabled={busy}
        onChange={event => setCode(event.target.value)} className="min-h-11 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 dark:border-slate-600" />
      <button type="submit" disabled={busy || !code.trim()} className="min-h-11 rounded-lg bg-emerald-700 px-4 font-semibold text-white disabled:opacity-50">
        {busy ? (ar ? 'جارٍ التحقق…' : 'Checking…') : (ar ? 'تفعيل الخصم' : 'Apply discount')}
      </button>
    </div>
    {error && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{error}</p>}
  </form>;
}
