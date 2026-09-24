import { CalendarDays, Clock3, ShieldCheck } from 'lucide-react';
import type { Language } from '../../types';
import type { UserSubscription } from '../../types/subscription';

type SubscriptionStatusCardProps = {
  lang: Language;
  subscription: UserSubscription | null;
  isLoading: boolean;
  error: string | null;
  affiliateCode: string;
  onAffiliateCodeChange: (code: string) => void;
  isApplyingCode: boolean;
  feedback: { type: 'success' | 'error'; message: string } | null;
  onApplyCode: () => void;
  onRetry: () => void;
};

export function SubscriptionStatusCard({
  lang,
  subscription,
  isLoading,
  error,
  affiliateCode,
  onAffiliateCodeChange,
  isApplyingCode,
  feedback,
  onApplyCode,
  onRetry,
}: SubscriptionStatusCardProps) {
  const isArabic = lang === 'ar';

  if (isLoading && !subscription) {
    return (
      <section aria-live="polite" className="rounded-3xl border border-emerald-100 bg-white p-5 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="h-10 w-10 animate-pulse rounded-2xl bg-emerald-100" />
          <div className="space-y-2">
            <div className="h-3 w-36 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-24 animate-pulse rounded bg-slate-100" />
          </div>
        </div>
      </section>
    );
  }

  if (!subscription) {
    return (
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5 text-slate-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-bold">{isArabic ? 'تعذر تحميل الاشتراك' : 'Could not load subscription'}</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">{error || (isArabic ? 'حاول مرة أخرى بعد قليل.' : 'Please try again in a moment.')}</p>
          </div>
          <button type="button" onClick={onRetry} className="shrink-0 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100">
            {isArabic ? 'إعادة المحاولة' : 'Retry'}
          </button>
        </div>
      </section>
    );
  }

  const expiryValue = subscription.isPaid ? subscription.paidExpiresAt : subscription.trialExpiresAt;
  const expiryTime = expiryValue ? Date.parse(expiryValue) : NaN;
  const remainingDays = Number.isFinite(expiryTime)
    ? Math.max(0, Math.ceil((expiryTime - Date.now()) / 86_400_000))
    : null;
  const isExpired = subscription.status === 'expired' || remainingDays === 0;
  const expiryLabel = expiryValue && Number.isFinite(expiryTime)
    ? new Intl.DateTimeFormat(isArabic ? 'ar-EG' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(expiryTime))
    : null;
  const price = subscription.monthlyPriceEgp ?? 180;
  const priceLabel = new Intl.NumberFormat(isArabic ? 'ar-EG' : 'en-GB', { maximumFractionDigits: 0 }).format(price);
  const isPaid = subscription.isPaid && !isExpired;
  const tone = isExpired
    ? 'border-slate-200 bg-slate-50'
    : isPaid
      ? 'border-sky-100 bg-gradient-to-br from-sky-50 via-white to-blue-50'
      : 'border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-teal-50';

  return (
    <section aria-live="polite" className={`rounded-3xl border p-5 shadow-sm ${tone}`}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${isExpired ? 'bg-slate-200 text-slate-600' : isPaid ? 'bg-sky-100 text-sky-700' : 'bg-emerald-100 text-emerald-700'}`}>
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{isArabic ? 'حالة اشتراكك' : 'Subscription status'}</p>
            <h2 className="mt-1 text-lg font-extrabold text-slate-900">
              {isExpired
                ? (isArabic ? 'انتهت الفترة التجريبية' : 'Trial has ended')
                : isPaid
                  ? (isArabic ? 'اشتراك مدفوع نشط' : 'Paid plan active')
                  : (isArabic ? 'فترة تجريبية نشطة' : 'Free trial active')}
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              {isArabic ? `السعر بعد التجربة: ${priceLabel} جنيهًا لكل 30 يومًا` : `After trial: EGP ${priceLabel} per 30 days`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 rounded-2xl border border-white/80 bg-white/80 px-4 py-3 sm:min-w-48 sm:justify-center">
          <div className="text-center">
            <div className={`text-4xl font-black tabular-nums ${isExpired ? 'text-slate-500' : isPaid ? 'text-sky-700' : 'text-emerald-700'}`}>
              {remainingDays === null ? '—' : remainingDays}
            </div>
            <div className="text-xs font-bold text-slate-500">
              {isArabic ? (remainingDays === 1 ? 'يوم متبقٍ' : 'أيام متبقية') : (remainingDays === 1 ? 'day remaining' : 'days remaining')}
            </div>
          </div>
          {expiryLabel && (
            <div className="border-s border-slate-200 ps-4 text-xs text-slate-500">
              <div className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{isArabic ? 'تنتهي في' : 'Expires'}</div>
              <div className="mt-1 font-bold text-slate-700">{expiryLabel}</div>
            </div>
          )}
        </div>
      </div>

      {subscription.hasAppliedAffiliateCode && subscription.affiliateCode && (
        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-200/70 pt-3 text-xs text-slate-600">
          <span>{isArabic ? 'كود المسوّق المفعّل:' : 'Applied marketer code:'}</span>
          <b dir="ltr" className="rounded-lg bg-white px-2 py-1 font-mono text-slate-800">{subscription.affiliateCode}</b>
          <span>{isArabic ? `إجمالي التجربة ${subscription.totalTrialDays} يومًا` : `${subscription.totalTrialDays} trial days total`}</span>
        </div>
      )}

      {subscription.temporaryLocalOnly && (
        <p className="mt-3 text-xs leading-5 text-amber-800">
          {isArabic ? 'تفعيل الكود محفوظ مؤقتًا على هذا المتصفح فقط حتى يكتمل ربط الاشتراكات.' : 'The code is saved temporarily in this browser until subscriptions are connected.'}
        </p>
      )}

      {!subscription.hasAppliedAffiliateCode && (
        <div className="mt-4 border-t border-slate-200/70 pt-4">
          <label htmlFor="home-marketer-code" className="mb-2 block text-sm font-bold text-slate-700">
            {isArabic ? 'عندك كود مسوّق؟' : 'Have a marketer code?'}
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              id="home-marketer-code"
              value={affiliateCode}
              onChange={(event) => onAffiliateCodeChange(event.target.value)}
              maxLength={32}
              autoComplete="off"
              dir="ltr"
              placeholder={isArabic ? 'اكتب الكود' : 'Enter code'}
              disabled={isApplyingCode}
              className="min-h-11 min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 text-left font-semibold uppercase tracking-wide text-slate-800 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
            />
            <button type="button" onClick={onApplyCode} disabled={isApplyingCode || !affiliateCode.trim()} className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
              {isApplyingCode ? (isArabic ? 'جارٍ التحقق...' : 'Checking...') : (isArabic ? 'تفعيل الكود' : 'Apply code')}
            </button>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            {isArabic ? 'يُستخدم كود واحد لكل حساب، ويبدأ احتساب مدته من بداية التجربة.' : 'One code per account. Its trial extension is calculated from the original trial start.'}
          </p>
        </div>
      )}

      {feedback && (
        <p role="status" className={`mt-3 rounded-xl px-3 py-2 text-sm leading-6 ${feedback.type === 'success' ? 'bg-emerald-100 text-emerald-900' : 'bg-rose-100 text-rose-900'}`}>
          {feedback.message}
        </p>
      )}
    </section>
  );
}
