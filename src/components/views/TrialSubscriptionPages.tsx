import { useCallback } from 'react';
import { ArrowRight, CalendarDays } from 'lucide-react';
import type { Language } from '../../types';
import type { UserSubscription } from '../../types/prototypeSubscription';
import { calculateRemainingPaidDays, calculateRemainingTrialDays } from '../../utils/subscriptionUtils';
import { accessEndedLabel, getTrialDurations, BASIC_PRICE_EGP, BASIC_MARKETER_PRICE_EGP, PRO_PRICE_EGP, PRO_MARKETER_PRICE_EGP, stageFor } from '../../config/subscriptionPolicy';
import { activeGrant } from '../../config/grantPolicy';
import { SubscriptionPayment } from './SubscriptionPayment';

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
}

export function TrialSubscriptionPages({ lang, subscription, guest = false, guestBasicDays = null, onSignIn, error, page, onBack, onNavigate, onSubscription }: Props) {
  const proPlan = useCallback((node: HTMLDivElement | null) => {
    if (node && new URLSearchParams(window.location.search).get('plan') === 'pro') {
      node.scrollIntoView({ block: 'center' });
    }
  }, []);
  const ar = lang === 'ar';
  const basicDays = guest ? guestBasicDays : getTrialDurations().basicDays;
  const days = subscription ? calculateRemainingTrialDays(subscription) : null;
  const paidDays = subscription ? calculateRemainingPaidDays(subscription) : 0;
  const paidName = subscription?.paidPlan === 'basic' ? 'Basic' : 'Pro';
  const number = new Intl.NumberFormat(ar ? 'ar-EG' : 'en-GB');
  const paidEnd = paidDays > 0 && subscription?.paidExpiresAt
    ? new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-GB', { dateStyle: 'long', timeZone: 'Africa/Cairo' }).format(new Date(subscription.paidExpiresAt))
    : null;
  const expiryLabel = accessEndedLabel(subscription, ar);
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
  const features = [
    { label: ar ? 'تسجيل العمليات' : 'Recording transactions', basic: ar ? '١٥ عملية يوميًا إجمالًا، بالصوت أو يدويًا' : '15 transactions a day in total, by voice or manually', pro: ar ? '١٥ عملية يوميًا بالذكاء الاصطناعي، ثم ١٠ إضافية بالصوت أو يدويًا' : '15 AI-assisted transactions a day, then 10 more by voice or manually' },
    { label: ar ? 'الاستعلام عن فلوسك' : 'Financial queries', basic: ar ? '٣ يوميًا، بالصوت أو الكتابة' : '3 a day, by voice or text', pro: ar ? '١٠ يوميًا، بالصوت أو الكتابة' : '10 a day, by voice or text' },
    { label: ar ? 'الحسابات' : 'Accounts', basic: ar ? '٤ حسابات قابلة للتعديل' : '4 editable accounts', pro: ar ? 'حتى ١٠ حسابات إجمالًا، مع دعم الفيزا وبطاقة الائتمان' : 'Up to 10 accounts total, including debit and credit cards' },
    { label: ar ? 'بنود الصرف' : 'Expense categories', basic: ar ? '٧ بنود تقدر تعدّل أسماءها' : '7 categories you can rename', pro: ar ? 'حتى ٢٠ بندًا إجمالًا، مع الإضافة وتعديل الأسماء' : 'Up to 20 total, with the option to add and rename categories' },
    { label: ar ? 'مستحقاتي والتزاماتي' : 'Receivables and obligations', basic: ar ? 'بند مفتوح واحد في كل قسم' : '1 open item per section', pro: ar ? '٣ بنود مفتوحة في كل قسم' : '3 open items per section' },
    { label: ar ? 'التذكيرات' : 'Reminders', basic: ar ? '٥ تذكيرات نشطة إجمالًا' : '5 active reminders total', pro: ar ? '٢٠ تذكيرًا نشطًا إجمالًا' : '20 active reminders total' },
    { label: ar ? 'تصدير البيانات' : 'Data export', basic: ar ? 'غير متاح' : 'Unavailable', pro: ar ? '٤ عمليات تصدير يوميًا إجمالًا، تشمل Excel والصيغ الأخرى المتاحة' : '4 exports a day in total, including Excel and other available formats' },
  ];
  const planCards = [
    { id: 'basic', name: 'Basic', price: BASIC_PRICE_EGP, discountedPrice: BASIC_MARKETER_PRICE_EGP },
    { id: 'pro', name: 'Pro', price: PRO_PRICE_EGP, discountedPrice: PRO_MARKETER_PRICE_EGP },
  ] as const;
  const discountApplied = subscription?.hasAppliedAffiliateCode;
  const planOptions = <>
      <p className="text-sm leading-7 text-slate-600">{ar ? 'اختر الخطة المناسبة لك. جميع بياناتك المالية محفوظة عند تغيير الخطة.' : 'Choose the plan that suits you. Your financial records remain saved when you change plans.'}</p>
      {guest && <button type="button" className="min-h-11 rounded-xl bg-emerald-700 px-3 font-bold text-white" onClick={onSignIn}>{ar ? 'ابدأ بحساب Google' : 'Get started with Google'}</button>}
      {!grant && stage === 'basic-free' && <p className="rounded-xl border border-sky-200 bg-sky-50 p-3 text-sm font-bold text-sky-900">{ar ? `Basic مجانية حتى اليوم ${getTrialDurations().basicDays}. المتبقي: ` : `Basic remains free until day ${getTrialDurations().basicDays}. Days remaining: `}{days}</p>}
      {stage === 'expired' && <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">{ar ? `${expiryLabel}. اختر خطة اشتراك لمتابعة الاستخدام.` : `${expiryLabel}. Choose a subscription plan to continue.`}</p>}
      {start && <p className="text-xs text-slate-500">{ar ? `تاريخ تسجيلك: ${start}` : `Registration date: ${start}`}</p>}
      <div className="grid gap-4 sm:grid-cols-2">
        {planCards.map(({ id, name, price, discountedPrice }) => (
          <div key={id} ref={id === 'pro' ? proPlan : undefined} className={`flex min-w-0 flex-col rounded-2xl border p-4 ${id === 'pro' ? 'border-emerald-600' : 'border-slate-200'}`}>
            <h2 className="text-lg font-black text-slate-900"><bdi>{name}</bdi></h2>
            <p className="mt-2 text-2xl font-black text-slate-900">
              {number.format(discountApplied ? discountedPrice : price)} <span className="text-sm font-semibold">{ar ? 'جنيه / شهر' : 'EGP / month'}</span>
            </p>
            <dl className="my-4 flex-1 divide-y divide-slate-100 border-y border-slate-100">
              {features.map(({ label, basic, pro }) => (
                <div key={label} className="py-2.5 text-sm leading-6">
                  <dt className="font-bold text-slate-900">{label}</dt>
                  <dd className="text-slate-600">{id === 'basic' ? basic : pro}</dd>
                </div>
              ))}
            </dl>
            {id === 'basic' && !paidEnd && <p className="mb-3 rounded-xl bg-slate-100 px-3 py-2 text-center text-sm font-bold text-slate-700">{basicDays === null
              ? (ar ? 'تجربة مجانية عند التسجيل' : 'Free trial when you sign up')
              : ar ? `مجانية لأول ${number.format(basicDays)} يومًا` : `Free for the first ${number.format(basicDays)} days`}</p>}
            {!guest && onNavigate && <button type="button" onClick={() => choosePlan(id)} className="min-h-11 rounded-xl bg-emerald-700 px-3 text-sm font-bold text-white hover:bg-emerald-800">
              {ar ? 'اشترك أو جدّد' : 'Subscribe or renew'} <bdi>{name}</bdi>
            </button>}
          </div>
        ))}
      </div>
      <details className="rounded-xl border border-slate-200 p-3 text-sm leading-7 text-slate-600">
        <summary className="min-h-8 cursor-pointer font-bold text-slate-900">{ar ? 'إزاي الحدود بتتحسب؟' : 'How are the limits counted?'}</summary>
        <ul className="mt-2 list-disc space-y-1 ps-5">
          <li>{ar ? 'الدخل والمصروف والتحويل بيشتركوا في حد التسجيل اليومي. الاستعلامات ليها حصة منفصلة.' : 'Income, expenses and transfers share the daily recording allowance. Queries have a separate allowance.'}</li>
          <li>{ar ? 'حد البنود المفتوحة بيتحسب لكل قسم على حدة في «مستحقاتي» و«التزاماتي». البند المتكرر بيتحسب مرة واحدة.' : 'The open-item limit applies separately to each section in Receivables and Obligations. A recurring item counts once.'}</li>
          <li>{ar ? 'حد التذكيرات مشترك بين «مستحقاتي» و«التزاماتي». التذكير المتكرر بيتحسب مرة واحدة طول ما هو مفعّل.' : 'The reminder limit is shared across Receivables and Obligations. A recurring reminder counts once while active.'}</li>
        </ul>
      </details>
  </>;
  return (
    <section className="space-y-5 pb-8" aria-labelledby="subscription-page-title">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-emerald-700">
        <ArrowRight className={`h-4 w-4 ${ar ? '' : 'rotate-180'}`} />{ar ? 'رجوع' : 'Back'}
      </button>
      <div className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-7 shadow-sm space-y-5">
        <div className="space-y-2">
          <div className="inline-flex rounded-full bg-emerald-50 p-3 text-emerald-700"><CalendarDays className="h-6 w-6" /></div>
          <h1 id="subscription-page-title" className="text-xl sm:text-2xl font-black text-slate-900">{page === 'trial-details' ? (paidEnd ? (ar ? 'تفاصيل اشتراكك' : 'Your subscription details') : (ar ? 'تفاصيل تجربتك' : 'Your trial details')) : (ar ? 'الاشتراك الشهري' : 'Monthly subscription')}</h1>
        </div>
        {grant && <p className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-900">{ar ? `أنت تستخدم خطة ${grant.plan === 'pro' ? 'Pro' : 'Basic'} بمنحة مجانية حتى ${grantEnd}.` : `Your free ${grant.plan === 'pro' ? 'Pro' : 'Basic'} grant runs through ${grantEnd}.`}</p>}
        {error ? <p role="alert" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{error}</p> : !subscription && !guest ? <p className="text-sm text-slate-600">{ar ? 'جارٍ قراءة بيانات الاشتراك...' : 'Loading subscription details...'}</p> : page === 'trial-details' && paidEnd ? <>
          <div className="space-y-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-950">
            <p className="font-extrabold">{ar ? `اشتراك ${paidName} نشط` : `Active ${paidName} subscription`}</p>
            <p>{ar ? 'تاريخ انتهاء الاشتراك' : 'Subscription ends'} <strong>{paidEnd}</strong></p>
            <p>{ar ? 'الأيام المتبقية' : 'Days remaining'} <strong>{number.format(paidDays)}</strong></p>
          </div>
          <button type="button" onClick={onSubscription} className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-bold text-white">{ar ? 'عرض الاشتراكات والتجديد' : 'View plans and renewal'}</button>
        </> : page === 'trial-details' ? <>
          <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 space-y-3 text-sm text-slate-700">
            <p className="font-black text-slate-900">{grant ? (ar ? 'منحة مجانية نشطة' : 'Active free grant') : (stage === 'paid' || stage === 'paid-basic') ? (ar ? 'اشتراك نشط' : 'Subscription active') : stage === 'pro-trial' ? (ar ? 'تجربة Pro نشطة' : 'Pro trial active') : stage === 'basic-free' ? (ar ? 'فترة Basic المجانية' : 'Basic introductory period') : expiryLabel}</p>
            <p>{ar ? `Basic مجانية حتى اليوم ${getTrialDurations().basicDays} من التسجيل.` : `Basic is free until day ${getTrialDurations().basicDays} after signup.`}</p>
            <p>{grant ? (ar ? 'الأيام المتبقية للتجربة الأصلية: ' : 'Original trial days remaining: ') : (ar ? 'الأيام المجانية المتبقية: ' : 'Introductory days remaining: ')}{days}</p>
            {start && <p>{ar ? `تاريخ تسجيلك: ${start}` : `Registration date: ${start}`}</p>}
            {expiry && <p>{ar ? `تاريخ نهاية التجربة: ${expiry}` : `Trial end date: ${expiry}`}</p>}
          </div>
          {!grant && !subscription.isPaid && days === 0 && <p className="text-sm leading-7 text-slate-700">{ar ? 'التجربة المجانية متاحة مرة واحدة لكل حساب.' : 'The free trial is available once per account.'}</p>}
          <button type="button" onClick={onSubscription} className="w-full rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white hover:bg-emerald-800">{ar ? 'الانتقال إلى صفحة الاشتراك' : 'Go to subscription'}</button>
        </> : <>
          {guest || !onNavigate ? planOptions : <SubscriptionPayment lang={lang} plan={null} activePaidPlan={paidEnd ? (subscription?.paidPlan ?? 'pro') : null} onClose={closeCheckout}>
            {planOptions}
          </SubscriptionPayment>}
        </>}
      </div>
    </section>
  );
}
