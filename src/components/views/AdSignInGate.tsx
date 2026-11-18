import { useState } from 'react';
import { ArrowLeft, ArrowRight, LockKeyhole } from 'lucide-react';
import type { Language } from '../../types';

type Props = { lang: Language; checking?: boolean; onBack: () => void; onSignIn: () => Promise<unknown> };

export function AdSignInGate({ lang, checking = false, onBack, onSignIn }: Props) {
  const ar = lang === 'ar';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const Back = ar ? ArrowRight : ArrowLeft;
  const signIn = async () => {
    if (busy) return;
    setBusy(true); setError(false);
    try { await onSignIn(); }
    catch (err: unknown) {
      const code = err && typeof err === 'object' && 'code' in err ? err.code : '';
      if (code !== 'auth/popup-closed-by-user' && code !== 'auth/cancelled-popup-request') setError(true);
    } finally { setBusy(false); }
  };
  return <div dir={ar ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b border-slate-200 bg-white"><div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-4">
      <button type="button" onClick={onBack} disabled={busy} aria-label={ar ? 'العودة للعروض' : 'Back to offers'} className="flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-700 disabled:opacity-50"><Back className="h-5 w-5" /></button>
      <h1 className="text-lg font-extrabold">{ar ? 'إنشاء إعلان' : 'Create an advertisement'}</h1>
    </div></header>
    <main className="mx-auto max-w-xl px-4 py-10">{checking ? <p role="status" className="text-center text-sm font-semibold text-slate-600">{ar ? 'جاري التحقق من تسجيل الدخول...' : 'Checking sign-in…'}</p> : <section className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700"><LockKeyhole className="h-6 w-6" /></div>
      <h2 className="text-lg font-extrabold">{ar ? 'تسجيل الدخول مطلوب' : 'Sign-in required'}</h2>
      <p className="mt-3 text-sm leading-7 text-slate-600">{ar ? 'لإنشاء إعلان، سجّل الدخول إلى التطبيق باستخدام حساب Google أولًا.' : 'To create an advertisement, first sign in to the app with your Google account.'}</p>
      {error && <p role="alert" className="mt-3 text-sm font-bold text-red-700">{ar ? 'تعذر تسجيل الدخول. يرجى المحاولة مرة أخرى.' : 'Could not sign in. Please try again.'}</p>}
      <button type="button" onClick={() => void signIn()} disabled={busy} className="mt-5 w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-extrabold text-white disabled:opacity-50">{busy ? (ar ? 'جاري تسجيل الدخول...' : 'Signing in...') : (ar ? 'تسجيل الدخول بحساب Google' : 'Sign in with Google')}</button>
      <button type="button" onClick={onBack} disabled={busy} className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 disabled:opacity-50">{ar ? 'العودة لتصفح العروض' : 'Back to browsing offers'}</button>
    </section>}</main>
  </div>;
}
