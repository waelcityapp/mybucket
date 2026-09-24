import { Check, Globe2, ShieldCheck, WalletCards } from 'lucide-react';
import type { Language } from '../../types';

type LoginViewProps = {
  lang: Language;
  onToggleLanguage: () => void;
  onLogin: (affiliateCode: string) => Promise<void> | void;
  isLoading: boolean;
  error: string | null;
  affiliateCode: string;
  onAffiliateCodeChange: (code: string) => void;
};

function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
      <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.8-.4-4.1H24v7.8h11a9.4 9.4 0 0 1-4.1 6.2v5h6.6c3.9-3.6 6.1-8.9 6.1-14.9Z" />
      <path fill="#34A853" d="M24 44c5.6 0 10.3-1.9 13.7-5.1l-6.6-5c-1.8 1.2-4.1 2-7.1 2-5.4 0-10-3.6-11.6-8.5h-6.8v5.2A20.7 20.7 0 0 0 24 44Z" />
      <path fill="#FBBC05" d="M12.4 27.4a12.4 12.4 0 0 1 0-7v-5.2H5.6a20.7 20.7 0 0 0 0 17.4l6.8-5.2Z" />
      <path fill="#EA4335" d="M24 11.9c3.1 0 5.9 1.1 8 3.2l6-6C34.2 5.7 29.6 4 24 4A20.7 20.7 0 0 0 5.6 15.2l6.8 5.2c1.6-4.9 6.2-8.5 11.6-8.5Z" />
    </svg>
  );
}

export function LoginView({ lang, onToggleLanguage, onLogin, isLoading, error, affiliateCode, onAffiliateCodeChange }: LoginViewProps) {
  const isArabic = lang === 'ar';

  return (
    <main dir={isArabic ? 'rtl' : 'ltr'} className="relative min-h-[100svh] overflow-hidden bg-[#f5f7f6] font-sans text-slate-900">
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-[380px] bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-100/80 via-teal-50/45 to-transparent" />
      <div className="relative mx-auto flex min-h-[100svh] max-w-6xl flex-col px-5 py-5 sm:px-8 lg:px-10">
        <header className="flex items-center justify-between">
          <a href="/" className="inline-flex items-center gap-2.5 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" aria-label="MyBucket">
            <span className="grid h-10 w-10 place-items-center rounded-2xl bg-emerald-600 text-white shadow-lg shadow-emerald-900/15"><WalletCards className="h-5 w-5" /></span>
            <span className="text-lg font-extrabold tracking-tight">MyBucket</span>
          </a>
          <button type="button" onClick={onToggleLanguage} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white/80 px-3 text-sm font-semibold text-slate-700 transition hover:border-emerald-300 hover:text-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600" aria-label={isArabic ? 'Switch to English' : 'التبديل إلى العربية'}>
            <Globe2 className="h-4 w-4" />{isArabic ? 'English' : 'العربية'}
          </button>
        </header>

        <div className="grid flex-1 items-center gap-9 py-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16 lg:py-14">
          <section className="mx-auto w-full max-w-xl lg:mx-0">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/75 px-3.5 py-2 text-xs font-bold text-emerald-800 shadow-sm">
              <ShieldCheck className="h-4 w-4" />{isArabic ? 'حسابك وبياناتك في مكان واحد' : 'Your money, organized in one place'}
            </div>
            <h1 className="max-w-xl text-4xl font-extrabold leading-[1.2] tracking-tight text-slate-950 sm:text-5xl">
              {isArabic ? 'ابدأ بتنظيم أموالك بسهولة' : 'Make sense of your money'}
            </h1>
            <p className="mt-5 max-w-lg text-base leading-8 text-slate-600 sm:text-lg">
              {isArabic ? 'سجّل الدخول لمتابعة دخلك ومصروفاتك وحساباتك، مع مزامنة بياناتك بين أجهزتك.' : 'Sign in to track income, expenses, and accounts, with your data synced across your devices.'}
            </p>
            <div className="mt-8 hidden space-y-3 sm:block">
              {[
                isArabic ? 'تابع أرصدتك ومعاملاتك بوضوح' : 'See balances and transactions clearly',
                isArabic ? 'سجّل دخولك بحساب Google فقط' : 'Sign in securely with Google',
                isArabic ? 'استخدم حسابك نفسه على أجهزتك' : 'Use the same account across devices',
              ].map((item) => (
                <div key={item} className="flex items-center gap-3 text-sm font-medium text-slate-700">
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-emerald-100 text-emerald-700"><Check className="h-3.5 w-3.5" /></span>{item}
                </div>
              ))}
            </div>
          </section>

          <section className="mx-auto w-full max-w-md">
            <div className="rounded-[28px] border border-white bg-white p-6 shadow-[0_24px_80px_-32px_rgba(15,23,42,0.25)] sm:p-9">
              <div className="mb-7">
                <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-emerald-50 text-emerald-700"><WalletCards className="h-6 w-6" /></span>
                <h2 className="text-2xl font-extrabold tracking-tight text-slate-950">{isArabic ? 'تسجيل الدخول' : 'Welcome back'}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">{isArabic ? 'استخدم حساب Google للمتابعة إلى MyBucket.' : 'Use your Google account to continue to MyBucket.'}</p>
              </div>

              <div className="mb-5">
                <label htmlFor="marketer-code" className="mb-2 block text-sm font-bold text-slate-700">
                  {isArabic ? 'كود المسوّق (اختياري)' : 'Marketer code (optional)'}
                </label>
                <input
                  id="marketer-code"
                  type="text"
                  value={affiliateCode}
                  onChange={(event) => onAffiliateCodeChange(event.target.value)}
                  autoCapitalize="characters"
                  autoComplete="off"
                  maxLength={32}
                  dir="ltr"
                  placeholder={isArabic ? 'اكتب الكود هنا' : 'Enter code'}
                  disabled={isLoading}
                  className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 text-left font-semibold uppercase tracking-wide text-slate-800 outline-none transition placeholder:normal-case placeholder:tracking-normal placeholder:text-slate-400 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 disabled:opacity-60"
                />
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {isArabic ? 'أدخل الكود قبل المتابعة؛ وسيتم التحقق منه عند تسجيل الدخول. يمكنك أيضًا إدخاله لاحقًا.' : 'Enter it before continuing. The code is checked after Google sign-in, and you can also add it later.'}
                </p>
              </div>

              {error && <div role="alert" className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-6 text-rose-800">{error}</div>}

              <button type="button" onClick={() => onLogin(affiliateCode)} disabled={isLoading} className="flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 disabled:cursor-wait disabled:opacity-70">
                {isLoading ? <span aria-hidden="true" className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" /> : <GoogleMark />}
                <span>{isLoading ? (isArabic ? 'جارٍ الاتصال بحساب Google...' : 'Connecting to Google...') : (isArabic ? 'المتابعة باستخدام Google' : 'Continue with Google')}</span>
              </button>

              <div className="my-6 flex items-center gap-3 text-[11px] font-medium text-slate-400">
                <span className="h-px flex-1 bg-slate-100" /><span>{isArabic ? 'دخول آمن بحسابك' : 'Secure sign-in'}</span><span className="h-px flex-1 bg-slate-100" />
              </div>
              <p className="text-center text-xs leading-6 text-slate-500">
                {isArabic ? 'سنستخدم حساب Google للتعرّف عليك ومزامنة بياناتك المالية بأمان.' : 'Your Google account identifies you and securely syncs your financial data.'}
              </p>
            </div>
            <p className="mt-5 text-center text-[11px] leading-5 text-slate-400">
              {isArabic ? 'لا نطلب كلمة مرور منفصلة؛ الدخول يتم عبر Google.' : 'No separate password is needed. Sign in through Google.'}
            </p>
          </section>
        </div>

        <footer className="flex flex-col items-center justify-between gap-2 border-t border-slate-200/70 pt-4 text-[11px] text-slate-400 sm:flex-row">
          <span>© {new Date().getFullYear()} MyBucket</span><span>{isArabic ? 'إدارة أموالك تبدأ برؤية أوضح.' : 'A clearer view of your money.'}</span>
        </footer>
      </div>
    </main>
  );
}
