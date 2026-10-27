import { ArrowRight, CalendarDays, Tag, ShieldCheck } from 'lucide-react';
import type { Language } from '../../types';
import type { UserSubscription } from '../../types/prototypeSubscription';
import { calculateRemainingTrialDays } from '../../utils/subscriptionUtils';

interface Props {
  lang: Language;
  subscription: UserSubscription | null;
  error: string | null;
  page: 'trial-details' | 'subscription';
  onBack: () => void;
  onSubscription: () => void;
}

export function TrialSubscriptionPages({ lang, subscription, error, page, onBack, onSubscription }: Props) {
  const ar = lang === 'ar';
  const days = subscription ? calculateRemainingTrialDays(subscription) : null;
  const start = subscription && Number.isFinite(Date.parse(subscription.trialStartedAt))
    ? new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-GB', { dateStyle: 'long' }).format(new Date(subscription.trialStartedAt)) : null;
  const expiry = subscription && Number.isFinite(Date.parse(subscription.trialExpiresAt))
    ? new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-GB', { dateStyle: 'long' }).format(new Date(subscription.trialExpiresAt)) : null;
  return (
    <section className="space-y-5 pb-8" aria-labelledby="subscription-page-title">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-emerald-700">
        <ArrowRight className={`h-4 w-4 ${ar ? '' : 'rotate-180'}`} />{ar ? 'رجوع' : 'Back'}
      </button>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm space-y-5">
        <div className="space-y-2">
          <div className="inline-flex rounded-full bg-emerald-50 p-3 text-emerald-700"><CalendarDays className="h-6 w-6" /></div>
          <h1 id="subscription-page-title" className="text-xl sm:text-2xl font-black text-slate-900">{page === 'trial-details' ? (ar ? 'تفاصيل تجربتك' : 'Your trial details') : (ar ? 'الاشتراك الشهري' : 'Monthly subscription')}</h1>
        </div>
        {error ? <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{error}</p> : !subscription ? <p className="text-sm text-slate-600">{ar ? 'جارٍ قراءة بيانات الاشتراك...' : 'Loading subscription details...'}</p> : subscription.trialDatesStored === false && page === 'trial-details' ? <>
          <div role="status" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-7 text-amber-950">
            {ar ? 'لا يوجد تاريخ بداية ونهاية مؤكَّدان للتجربة في سجل الاشتراك المتاح. لا يمكن تحديد المدة أو الأيام المتبقية بدقة حاليًا.' : 'Confirmed trial start and end dates are not available in the subscription record. The duration and remaining days cannot be determined accurately.'}
          </div>
          <p className="text-sm text-slate-700">{subscription.hasAppliedAffiliateCode && subscription.affiliateCode ? (ar ? `كود المسوّق الموجود في البيانات: ${subscription.affiliateCode}` : `Marketer code found in available data: ${subscription.affiliateCode}`) : (ar ? 'لم يظهر كود مسوّق في البيانات المتاحة؛ قد يحتاج سجلك السابق إلى مراجعة.' : 'No marketer code appeared in the available data; your earlier record may require review.')}</p>
          <button type="button" onClick={onSubscription} className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white hover:bg-emerald-800">{ar ? 'الانتقال إلى صفحة الاشتراك' : 'Go to subscription'}</button>
        </> : page === 'trial-details' ? <>
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 space-y-3 text-sm text-slate-700">
            <p className="font-black text-slate-900">{subscription.isPaid ? (ar ? 'اشتراكك نشط' : 'Your subscription is active') : days === 0 ? (ar ? 'انتهت تجربتك المجانية' : 'Your free trial has ended') : (ar ? `متبقي ${days} يوم من تجربتك` : `${days} trial days remaining`)}</p>
            <p>{ar ? `إجمالي مدة التجربة: ${subscription.totalTrialDays} يومًا` : `Total trial duration: ${subscription.totalTrialDays} days`}</p>
            {start && <p>{ar ? `تاريخ بداية التجربة: ${start}` : `Trial start date: ${start}`}</p>}
            {expiry && <p>{ar ? `تاريخ نهاية التجربة: ${expiry}` : `Trial end date: ${expiry}`}</p>}
            <p>{subscription.hasAppliedAffiliateCode && subscription.affiliateCode ? (ar ? `كود المسوّق المسجل: ${subscription.affiliateCode}` : `Recorded marketer code: ${subscription.affiliateCode}`) : (ar ? 'لا يوجد كود مسوّق مسجّل في البيانات المتاحة.' : 'No marketer code is recorded in the available data.')}</p>
          </div>
          {!subscription.isPaid && days === 0 && <p className="text-sm leading-7 text-slate-700">{ar ? 'التجربة المجانية متاحة مرة واحدة لكل حساب. لا يمكن استخدام نفس الكود أو كود آخر للحصول على تجربة مجانية جديدة.' : 'The free trial is available once per account. Neither the same code nor another code grants a new trial.'}</p>}
          <p className="text-sm leading-7 text-slate-700">{subscription.hasAppliedAffiliateCode ? (ar ? 'حسابك مرتبط بكود مسوّق؛ يظهر سعر الخصم في تفاصيل الاشتراك.' : 'Your account has a marketer code; the discounted price appears in subscription details.') : (ar ? 'يمكن استخدام كود مسوّق للحصول على خصم الاشتراك، دون بدء تجربة جديدة بعد انتهائها.' : 'A marketer code can provide a subscription discount without starting another trial after expiry.')}</p>
          <button type="button" onClick={onSubscription} className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white hover:bg-emerald-800">{ar ? 'الانتقال إلى صفحة الاشتراك' : 'Go to subscription'}</button>
        </> : <>
          <div className="rounded-2xl bg-emerald-50 border border-emerald-100 p-5 space-y-3">
            <div className="flex items-center gap-2 text-emerald-800"><Tag className="h-5 w-5" /><span className="font-bold">{ar ? 'سعر الاشتراك الشهري' : 'Monthly subscription'}</span></div>
            <p className="text-2xl font-black text-slate-900">{subscription.hasAppliedAffiliateCode ? '120' : '180'} <span className="text-sm">{ar ? 'جنيه / شهر' : 'EGP / month'}</span></p>
            {subscription.hasAppliedAffiliateCode ? <p className="text-sm text-emerald-800">{ar ? `السعر المخفض مرتبط بالكود المسجّل ${subscription.affiliateCode || ''}.` : `Discount associated with recorded code ${subscription.affiliateCode || ''}.`}</p> : <p className="text-sm text-emerald-800">{ar ? 'عند تسجيل كود مسوّق صالح، يكون السعر ١٢٠ جنيه شهريًا.' : 'A valid marketer code gives a price of 120 EGP per month.'}</p>}
          </div>
          <div className="flex gap-2 rounded-xl bg-slate-50 p-4 text-sm leading-6 text-slate-700"><ShieldCheck className="h-5 w-5 shrink-0 text-emerald-700" /><p>{ar ? 'الاشتراك والدفع قيد التجهيز. لا يتم تحصيل أي مبلغ من هذه الصفحة حاليًا.' : 'Subscription and payment are being prepared. No payment is collected on this page yet.'}</p></div>
        </>}
      </div>
    </section>
  );
}
