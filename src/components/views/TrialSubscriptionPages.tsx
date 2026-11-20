import { useCallback } from 'react';
import { ArrowRight, CalendarDays, Tag, ShieldCheck } from 'lucide-react';
import type { Language } from '../../types';
import type { UserSubscription } from '../../types/prototypeSubscription';
import { calculateRemainingTrialDays } from '../../utils/subscriptionUtils';
import { getTrialDurations, BASIC_PRICE_EGP, BASIC_MARKETER_PRICE_EGP, PRO_PRICE_EGP, PRO_MARKETER_PRICE_EGP, stageFor } from '../../config/subscriptionPolicy';
import { activeGrant } from '../../config/grantPolicy';
import { SubscriptionPayment } from './SubscriptionPayment';
import { AffiliateCodeSection } from '../AffiliateCodeSection';

interface Props {
  lang: Language;
  subscription: UserSubscription | null;
  guest?: boolean;
  guestBasicDays?: number | null;
  onSignIn?: () => void;
  error: string | null;
  page: 'trial-details' | 'subscription';
  onBack: () => void;
  onNavigate?: (path: string, replace?: boolean) => void;
  onSubscription: () => void;
  onUpdateSubscription: (sub: UserSubscription) => Promise<void>;
}

export function TrialSubscriptionPages({ lang, subscription, guest = false, guestBasicDays = null, onSignIn, error, page, onBack, onNavigate, onSubscription, onUpdateSubscription }: Props) {
  const proPlan = useCallback((node: HTMLDivElement | null) => {
    if (node && new URLSearchParams(window.location.search).get('plan') === 'pro') {
      node.scrollIntoView({ block: 'center' });
    }
  }, []);
  const ar = lang === 'ar';
  const basicDays = guest ? guestBasicDays : getTrialDurations().basicDays;
  const days = subscription ? calculateRemainingTrialDays(subscription) : null;
  const stage = subscription ? stageFor(subscription) : null;
  const checkout = new URLSearchParams(window.location.search).get('checkout');
  const plan = checkout === 'basic' || checkout === 'pro' ? checkout : null;
  const choosePlan = (selected: 'basic' | 'pro') => onNavigate?.(`/subscription?checkout=${selected}`);
  const closeCheckout = () => {
    const previous = window.history.state?.offerBack;
    if (typeof previous === 'string' && /^\/subscription(?:\?plan=pro)?$/.test(previous)) window.history.back();
    else onNavigate?.('/subscription', true);
  };

  if (page === 'subscription' && !guest && plan && onNavigate) {
    return <section className="mx-auto max-w-lg space-y-4 pb-8">
      <button type="button" onClick={closeCheckout} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-slate-600 hover:text-emerald-700 dark:text-slate-200">
        <ArrowRight aria-hidden="true" className={`size-4 ${ar ? '' : 'rotate-180'}`} />
        {ar ? 'العودة للخطط' : 'Back to plans'}
      </button>
      <SubscriptionPayment lang={lang} plan={plan} onClose={closeCheckout} />
    </section>;
  }

  const grant = stage !== 'paid' && stage !== 'paid-basic' ? activeGrant(subscription?.grant) : null;
  const grantEnd = grant ? new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-GB', { dateStyle: 'long', timeZone: 'Africa/Cairo' }).format(new Date(Date.parse(grant.endsAt) - 1)) : null;
  const start = subscription && Number.isFinite(Date.parse(subscription.trialStartedAt))
    ? new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-GB', { dateStyle: 'long' }).format(new Date(subscription.trialStartedAt)) : null;
  const expiry = subscription && Number.isFinite(Date.parse(subscription.trialExpiresAt))
    ? new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-GB', { dateStyle: 'long' }).format(new Date(subscription.trialExpiresAt)) : null;
  const planOptions = <>
      <p className="text-sm leading-7 text-slate-600">{ar ? 'اختر الخطة المناسبة لك. جميع بياناتك المالية محفوظة عند تغيير الخطة.' : 'Choose the plan that suits you. Your financial records remain saved when you change plans.'}</p>
      {subscription && <AffiliateCodeSection subscription={subscription} lang={lang} onUpdateSubscription={onUpdateSubscription} />}
      {guest && <button type="button" className="min-h-11 rounded-xl bg-emerald-700 px-3 font-bold text-white" onClick={onSignIn}>{ar ? 'ابدأ بحساب Google' : 'Get started with Google'}</button>}
      {!grant && stage === 'basic-free' && <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-bold text-sky-900">{ar ? `Basic مجانية حتى اليوم ${getTrialDurations().basicDays}. المتبقي: ` : `Basic remains free until day ${getTrialDurations().basicDays}. Days remaining: `}{days}</p>}
      {stage === 'expired' && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">{ar ? 'انتهت الفترة المجانية. اختر خطة اشتراك لمتابعة استخدام التطبيق.' : 'Your introductory period ended. Choose a subscription plan to continue.'}</p>}
      {start && <p className="text-xs text-slate-500">{ar ? `تاريخ تسجيلك: ${start}` : `Registration date: ${start}`}</p>}
      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4">
          <h2 className="text-lg font-black text-slate-900">Basic</h2>
          <p className="text-2xl font-black text-slate-900">{subscription?.hasAppliedAffiliateCode ? BASIC_MARKETER_PRICE_EGP : BASIC_PRICE_EGP} <span className="text-sm font-semibold">{ar ? 'جنيه / شهر' : 'EGP / month'}</span></p>
          <p className="text-sm leading-7 text-slate-600">{ar ? 'الخطة الأساسية؛ مميزاتها وحدودها قيد الاختبار.' : 'The essential plan; features and limits are being tested.'}</p>
          <p className="mt-auto rounded-xl bg-slate-100 px-3 py-2 text-center text-sm font-bold text-slate-700">{basicDays === null
            ? (ar ? 'تجربة مجانية عند التسجيل' : 'Free trial when you sign up')
            : ar ? `مجانية لأول ${new Intl.NumberFormat('ar-EG').format(basicDays)} يومًا` : `Free for the first ${basicDays} days`}</p>
          {!guest && onNavigate && <button type="button" onClick={() => choosePlan('basic')} className="min-h-11 rounded-xl bg-emerald-700 px-3 text-sm font-bold text-white">{ar ? 'اشترك أو جدّد Basic' : 'Subscribe or renew Basic'}</button>}
        </div>
        <div ref={proPlan} className="flex flex-col gap-3 rounded-2xl border-2 border-emerald-600 p-4">
          <h2 className="text-lg font-black text-slate-900">Pro</h2>
          <p className="text-2xl font-black text-slate-900">{subscription?.hasAppliedAffiliateCode ? PRO_MARKETER_PRICE_EGP : PRO_PRICE_EGP} <span className="text-sm font-semibold">{ar ? 'جنيه / شهر' : 'EGP / month'}</span></p>
          <p className="text-sm leading-7 text-slate-600">{ar ? 'الخطة المتقدمة؛ الفرق في المميزات سيحدد بعد تجارب الأصدقاء.' : 'Advanced features will be finalized after usability tests.'}</p>
          <p className="text-sm text-emerald-800">{subscription?.hasAppliedAffiliateCode ? (ar ? 'خصم المسوّق محفوظ بدون تمديد الفترة المجانية.' : 'Marketer discount saved; no extra trial days.') : (ar ? 'بكود مسوّق صالح: 120 جنيه شهريًا.' : 'With a valid marketer code: EGP 120/month.')}</p>
          {!guest && onNavigate && <button type="button" onClick={() => choosePlan('pro')} className="mt-auto min-h-11 rounded-xl bg-emerald-700 px-3 text-sm font-bold text-white">{ar ? 'اشترك أو جدّد Pro' : 'Subscribe or renew Pro'}</button>}
        </div>
      </div>
  </>;
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
        {grant && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-900">{ar ? `أنت تستخدم خطة ${grant.plan === 'pro' ? 'Pro' : 'Basic'} بمنحة مجانية حتى ${grantEnd}.` : `Your free ${grant.plan === 'pro' ? 'Pro' : 'Basic'} grant runs through ${grantEnd}.`}</p>}
        {error ? <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{error}</p> : !subscription && !guest ? <p className="text-sm text-slate-600">{ar ? 'جارٍ قراءة بيانات الاشتراك...' : 'Loading subscription details...'}</p> : page === 'trial-details' ? <>
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 space-y-3 text-sm text-slate-700">
            <p className="font-black text-slate-900">{grant ? (ar ? 'منحة مجانية نشطة' : 'Active free grant') : (stage === 'paid' || stage === 'paid-basic') ? (ar ? 'اشتراك نشط' : 'Subscription active') : stage === 'pro-trial' ? (ar ? 'تجربة Pro نشطة' : 'Pro trial active') : stage === 'basic-free' ? (ar ? 'فترة Basic المجانية' : 'Basic introductory period') : (ar ? 'انتهت الفترة المجانية' : 'Introductory period ended')}</p>
            <p>{ar ? `Basic مجانية حتى اليوم ${getTrialDurations().basicDays} من التسجيل.` : `Basic is free until day ${getTrialDurations().basicDays} after signup.`}</p>
            <p>{grant ? (ar ? 'الأيام المتبقية للتجربة الأصلية: ' : 'Original trial days remaining: ') : (ar ? 'الأيام المجانية المتبقية: ' : 'Introductory days remaining: ')}{days}</p>
            {start && <p>{ar ? `تاريخ تسجيلك: ${start}` : `Registration date: ${start}`}</p>}
            {expiry && <p>{ar ? `تاريخ نهاية التجربة: ${expiry}` : `Trial end date: ${expiry}`}</p>}
            <p>{subscription.hasAppliedAffiliateCode && subscription.affiliateCode ? (ar ? `كود المسوّق المسجل: ${subscription.affiliateCode}` : `Recorded marketer code: ${subscription.affiliateCode}`) : (ar ? 'لا يوجد كود مسوّق مسجّل في البيانات المتاحة.' : 'No marketer code is recorded in the available data.')}</p>
          </div>
          {!grant && !subscription.isPaid && days === 0 && <p className="text-sm leading-7 text-slate-700">{ar ? 'التجربة المجانية متاحة مرة واحدة لكل حساب. لا يمكن استخدام نفس الكود أو كود آخر للحصول على تجربة مجانية جديدة.' : 'The free trial is available once per account. Neither the same code nor another code grants a new trial.'}</p>}
          <p className="text-sm leading-7 text-slate-700">{subscription.hasAppliedAffiliateCode ? (ar ? 'حسابك مرتبط بكود مسوّق؛ يظهر سعر الخصم في تفاصيل الاشتراك.' : 'Your account has a marketer code; the discounted price appears in subscription details.') : (ar ? 'يمكن استخدام كود مسوّق للحصول على خصم الاشتراك، دون بدء تجربة جديدة بعد انتهائها.' : 'A marketer code can provide a subscription discount without starting another trial after expiry.')}</p>
          <button type="button" onClick={onSubscription} className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white hover:bg-emerald-800">{ar ? 'الانتقال إلى صفحة الاشتراك' : 'Go to subscription'}</button>
        </> : <>
          {guest || !onNavigate ? planOptions : <SubscriptionPayment lang={lang} plan={null} onClose={closeCheckout}>
            {planOptions}
          </SubscriptionPayment>}
        </>}
      </div>
    </section>
  );
}
