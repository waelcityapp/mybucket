import React, { useState } from 'react';
import { Sparkles, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle, Mail, Lock, User as UserIcon, Tag, Gift, Check, Clock } from 'lucide-react';
import { VALID_AFFILIATE_CODES } from '../../utils/subscriptionUtils';
import { loginWithGoogle } from '../../lib/firebase';
import { Language } from '../../types';

interface AuthPageProps {
  lang: Language;
  onSuccess: (appliedCode?: string | null, signedInUid?: string) => Promise<void>;
  onToggleLanguage?: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ lang, onSuccess, onToggleLanguage }) => {
  const [affiliateCode, setAffiliateCode] = useState('');
  const [codeValidStatus, setCodeValidStatus] = useState<'idle' | 'valid' | 'invalid'>('idle');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isAr = lang === 'ar';

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
    setErrorMsg(null);
    setIsLoading(true);
    try {
      const user = await loginWithGoogle();
      await onSuccess(codeValidStatus === 'valid' ? affiliateCode : null, user.uid);
    } catch (err: any) {
      console.error('Google Sign-in error:', err);
      if (err.code !== 'auth/popup-closed-by-user') {
        const code = typeof err?.code === 'string' && /^auth\/[a-z0-9-]+$/.test(err.code) ? err.code : null;
        const detail = code === 'auth/unauthorized-domain'
          ? (isAr ? 'عنوان نسخة الاختبار غير مضاف ضمن النطاقات المصرّح بها في Firebase.' : 'The preview domain is not authorized in Firebase.')
          : code === 'auth/popup-blocked'
          ? (isAr ? 'المتصفح منع نافذة تسجيل الدخول.' : 'The browser blocked the sign-in popup.')
          : code === 'auth/network-request-failed'
          ? (isAr ? 'تعذر الاتصال بخدمة تسجيل الدخول.' : 'Could not reach the sign-in service.')
          : (isAr ? 'تعذر إتمام الدخول بحساب جوجل.' : 'Google sign-in failed.');
        setErrorMsg(code ? `${detail} (${code})` : detail);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      dir={isAr ? 'rtl' : 'ltr'}
      className="min-h-screen bg-[#F8FAFC] flex flex-col justify-between text-slate-900 selection:bg-emerald-500 selection:text-white"
    >
      {/* Top Simple Brand Bar */}
      <header className="w-full max-w-lg mx-auto px-4 py-4 flex items-center justify-between border-b border-slate-200/60">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-sm font-black text-base">
            M
          </div>
          <div>
            <span className="text-base font-black text-slate-900  block leading-tight">My Bucket</span>
            <span className="text-[10px] text-slate-500 font-bold block">{isAr ? 'إدارة المصاريف والمال الشخصي' : 'Smart Personal Budget'}</span>
          </div>
        </div>

        {onToggleLanguage && (
          <button
            type="button"
            onClick={onToggleLanguage}
            className="text-xs font-bold px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 transition"
          >
            {isAr ? 'English' : 'عربي'}
          </button>
        )}
      </header>

      {/* Main Page Form Section */}
      <main className="flex-1 w-full max-w-md mx-auto p-4 sm:p-6 flex flex-col justify-center">
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-sm p-6 sm:p-8 space-y-5">
          
          {/* Headline & Title */}
          <div className="text-center space-y-1.5">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 mb-1 border border-emerald-100">
              <Sparkles className="w-6 h-6" />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 ">
              {isAr ? 'صفحة تسجيل الدخول والاشتراك' : 'Welcome to My Bucket'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 font-medium">
              {isAr
                ? 'سجّل الآن للوصول الكامل إلى محفظتك الذكية والنسخ الاحتياطي الفوري'
                : 'Sign in to access your smart wallet with secure cloud synchronization'}
            </p>
          </div>

          {/* Trial & Promo Info Card */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-2xl p-3.5 flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs mt-0.5">
              <Gift className="w-4 h-4" />
            </div>
            <div className="min-w-0 text-xs">
              <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                <span>{isAr ? 'عرض التجربة الحصري' : 'Exclusive Trial Offer'}</span>
                <span className="text-[10px] bg-emerald-200/80 text-emerald-900 font-black px-1.5 py-0.2 rounded">
                  {codeValidStatus === 'valid' ? (isAr ? '35 يوماً' : '35 Days') : (isAr ? '10 أيام' : '10 Days')}
                </span>
              </div>
              <div className="text-[11px] text-emerald-800/90 mt-0.5 leading-relaxed">
                {codeValidStatus === 'valid'
                  ? (isAr ? '🎉 تم تفعيل كود المسوق: 35 يوماً تجربة كاملة + اشتراك 4 ج/يوم عند التجديد!' : '🎉 Affiliate code verified: 35 days full trial + 4 EGP/day renewal!')
                  : (isAr ? 'تجربة مجانية كاملة بدون كارت ائتمان. وإذا كان لديك كود مسوّق ستحصل على 35 يوماً!' : 'Free full trial with zero commitment. Add an affiliate code to unlock 35 days!')}
              </div>
            </div>
          </div>

          {/* Affiliate / Promo Code Field */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="auth-page-affiliate-code" className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-amber-600" />
                <span>{isAr ? 'كود المسوّق أو كود الهدية (اختياري)' : 'Affiliate / Promo Code (Optional)'}</span>
              </label>
              {codeValidStatus === 'valid' && (
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded flex items-center gap-1">
                  <Check className="w-3 h-3" />
                  <span>{isAr ? 'مقبول (35 يوم)' : 'Verified (35d)'}</span>
                </span>
              )}
            </div>

            <div className="relative">
              <input
                id="auth-page-affiliate-code"
                type="text"
                placeholder={isAr ? 'مثال: WAEL2026 أو MARKET50' : 'e.g. WAEL2026 or MARKET50'}
                value={affiliateCode}
                onChange={handleCodeChange}
                className="w-full bg-white border border-amber-300 rounded-xl px-3 py-2 text-xs font-mono font-bold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/30 uppercase "
              />
            </div>
            <p className="text-[10px] text-amber-800/80 leading-relaxed">
              {isAr
                ? 'كود المسوّق يمد تجربتك إلى 35 يوماً ويخفض قيمة الاشتراك إلى 4 ج/يوم بدلاً من 6 ج/يوم.'
                : 'Affiliate code grants a 35-day trial and discounts renewal to 4 EGP/day.'}
            </p>
          </div>

          {/* Error Message if any */}
          {errorMsg && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl p-2.5 flex items-center gap-2 text-rose-700 text-xs font-bold">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Login / Register Actions */}

            <div className="space-y-3 pt-1">
              {/* Google Sign-in as Primary Option */}
              <button
                id="btn-auth-page-google"
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-3 bg-slate-900 hover:bg-slate-800 text-white font-black py-3 px-4 rounded-2xl shadow-sm transition-all hover:scale-[1.01] active:scale-95 disabled:opacity-50 text-xs sm:text-sm cursor-pointer"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                </svg>
                <span>{isLoading ? (isAr ? 'جاري الاتصال...' : 'Connecting...') : (isAr ? 'المتابعة بضغطة واحدة بحساب Google' : 'Continue with Google')}</span>
              </button>

            </div>

          {/* Security Note */}
          <div className="pt-2 border-t border-slate-100 flex items-center justify-center gap-1.5 text-[10px] text-slate-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>{isAr ? 'حسابك وبياناتك المالية محمية ومشفرة على السحابة' : 'Your data is encrypted and securely backed up'}</span>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-lg mx-auto px-4 py-4 text-center text-[11px] text-slate-400 font-medium">
        <span>My Bucket © 2026 • {isAr ? 'الخصوصية والأمان أولاً' : 'Privacy & Security First'}</span>
      </footer>
    </div>
  );
};
