import React, { useState } from 'react';
import { AlertCircle, Gift, ShieldCheck, Wallet } from 'lucide-react';
import { VALID_AFFILIATE_CODES } from '../../utils/subscriptionUtils';
import { loginWithGoogle } from '../../lib/firebase';
import { Language } from '../../types';
import type { AppIdentity } from '../../services/appIdentityClient';

interface AuthPageProps {
  lang: Language;
  onSuccess: (appliedCode?: string | null, signedInUid?: string) => Promise<void>;
  onToggleLanguage?: () => void;
  onOpenOffers: () => void;
  onOpenDemo?: () => void;
  simulation?: boolean;
  onSimulatedSignIn?: () => void;
  identity?: AppIdentity;
}

export const AuthPage: React.FC<AuthPageProps> = ({ lang, onSuccess, onToggleLanguage, onOpenOffers, onOpenDemo, simulation = false, onSimulatedSignIn, identity }) => {
  const [affiliateCode, setAffiliateCode] = useState('');
  const [codeValidStatus, setCodeValidStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isAr = lang === 'ar';
  const appName = (isAr ? identity?.appNameAr : identity?.appNameEn) || 'My Bucket';

  const handleCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.trim().toUpperCase();
    setAffiliateCode(val);
    if (!val) {
      setCodeValidStatus('idle');
    } else if (VALID_AFFILIATE_CODES[val]) {
      setCodeValidStatus('valid');
    } else {
      setCodeValidStatus('invalid');
    }
  };

  const handleGoogleSignIn = async () => {
    if (simulation) { onSimulatedSignIn?.(); return; }
    setErrorMsg(null);
    setIsLoading(true);
    try {
      const user = await loginWithGoogle();
      await onSuccess(codeValidStatus === 'valid' ? affiliateCode : null, user.uid);
    } catch (err: any) {
      console.error('Google Sign-in error:', err);
      if (err.code !== 'auth/popup-closed-by-user') {
        setErrorMsg(isAr ? 'تعذر إتمام الدخول بحساب جوجل. برجاء المحاولة مرة أخرى.' : 'Google sign-in failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-4 py-5 sm:px-8">
        <div className="flex items-center gap-2.5">
          <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl bg-emerald-700 font-black text-white">
            {identity?.icon192Url ? <img src={identity.icon192Url} alt="" className="size-full object-contain" /> : <Wallet className="size-5" aria-hidden="true" />}
          </span>
          <span className="font-black">{appName}</span>
        </div>
        {onToggleLanguage && <button type="button" onClick={onToggleLanguage}
          className="min-h-11 rounded-xl border border-slate-200 px-3 text-xs font-bold dark:border-slate-700">
          {isAr ? 'English' : 'عربي'}
        </button>}
      </header>

      <main className="mx-auto grid w-full max-w-5xl items-start gap-4 px-4 pb-8 pt-2 sm:px-8 sm:pt-8 lg:grid-cols-[1.1fr_1fr]">
        <section className="space-y-5 rounded-3xl bg-emerald-950 p-5 text-white sm:p-8">
          <div className="space-y-2">
            <h1 className="text-2xl font-black leading-tight sm:text-4xl">{isAr ? 'نظّم فلوسك بسهولة' : 'Make sense of your money'}</h1>
            <p className="text-sm leading-7 text-emerald-100">{isAr ? 'سجّل دخلك ومصروفاتك واعرف رصيدك وفلوسك بتروح فين.' : 'Record income and expenses, check your balance, and see where your money goes.'}</p>
          </div>
          {onOpenDemo && <button type="button" onClick={onOpenDemo}
            className="min-h-11 w-full rounded-xl bg-emerald-100 px-4 text-sm font-extrabold text-emerald-950 sm:w-auto">
            {isAr ? 'جرّب التطبيق بدون تسجيل' : 'Try without signing in'}
          </button>}
          <button type="button" onClick={onOpenOffers} className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-emerald-700 px-3 text-start text-sm font-bold hover:bg-emerald-900">
            <Gift className="size-4 shrink-0" aria-hidden="true" />
            {isAr ? 'وفّر مع My Bucket — تصفّح العروض' : 'Save with My Bucket — browse offers'}
          </button>
        </section>

        <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <h2 className="text-xl font-black">{isAr ? 'ابدأ بحسابك' : 'Get started with your account'}</h2>
          <p className="text-sm leading-6 text-slate-600 dark:text-slate-300">{isAr ? 'ادخل بحساب Google عشان تسجّل عملياتك وتتابعها من أجهزتك.' : 'Sign in with Google to record your own transactions and access them across your devices.'}</p>
          <details className="rounded-xl border border-slate-200 px-3 dark:border-slate-700">
            <summary className="min-h-11 cursor-pointer py-3 text-xs font-bold">{isAr ? 'عندك كود مسوّق أو هدية؟' : 'Have an affiliate or promo code?'}</summary>
            <label htmlFor="auth-page-affiliate-code" className="block text-xs font-bold">{isAr ? 'الكود (اختياري)' : 'Code (optional)'}</label>
            <input id="auth-page-affiliate-code" type="text" value={affiliateCode} onChange={handleCodeChange} dir="ltr"
              className="my-2 min-h-11 w-full rounded-lg border border-slate-300 bg-transparent px-3 font-mono text-sm dark:border-slate-700" />
            <p className="mb-3 text-xs text-slate-600 dark:text-slate-300">{isAr ? 'كود المسوّق الصالح يطبّق خصمًا على Pro.' : 'A valid affiliate code applies a Pro discount.'}</p>
          </details>
          {errorMsg && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-800">{errorMsg}</p>}
          <button id="btn-auth-page-google" type="button" onClick={handleGoogleSignIn} disabled={isLoading}
            className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-emerald-700 px-4 text-sm font-extrabold text-white hover:bg-emerald-800 disabled:opacity-60">
                <svg aria-hidden="true" className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
            <span>{simulation ? (isAr ? 'محاكاة المتابعة بحساب Google' : 'Simulate Google sign-in') : isLoading ? (isAr ? 'جاري الاتصال...' : 'Connecting…') : (isAr ? 'المتابعة بحساب Google' : 'Continue with Google')}</span>
          </button>
          <p className="flex items-start gap-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
            <ShieldCheck className="mt-0.5 size-4 shrink-0 text-emerald-700 dark:text-emerald-300" aria-hidden="true" />
            {isAr ? 'بيانات الاستخدام الحقيقي اللي بتضيفها بتتحفظ في حسابك.' : 'The financial entries you add during real use are saved to your account.'}
          </p>
        </section>
      </main>
    </div>
  );
};
