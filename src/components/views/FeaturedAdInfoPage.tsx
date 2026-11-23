import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, X, Gift, Star, Bell } from 'lucide-react';
import type { Language } from '../../types';
import type { OfferTier, FreeOfferPolicy } from '../../data/offerAds';
import type { PaidAdPrices } from '../../utils/adCheckout';
import { offerAdsRequest } from '../../services/offerAdsClient';

type Value = boolean | string;
type Row = { label: string; free: Value; featured: Value; vip: Value };

export function AdPricingPage({ lang, onBack, onChoose, onlyFree = false }: {
  lang: Language; onBack: () => void; onChoose: (tier: OfferTier) => void; onlyFree?: boolean;
}) {
  const ar = lang === 'ar';
  const BackIcon = ar ? ArrowRight : ArrowLeft;
  const [prices, setPrices] = useState<PaidAdPrices | null>(null);
  const [policy, setPolicy] = useState<FreeOfferPolicy | null>(null);
  const [pricesError, setPricesError] = useState(false);
  const [policyError, setPolicyError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let mounted = true;
    setPrices(null);
    setPolicy(null);
    setPricesError(false);
    setPolicyError(false);
    // Read the CURRENT administrator settings every time this page opens.
    offerAdsRequest<PaidAdPrices>('ads.paidPrices', {}, true)
      .then(data => { if (mounted) setPrices(data); })
      .catch(() => { if (mounted) setPricesError(true); });
    offerAdsRequest<FreeOfferPolicy>('ads.freePolicy', {}, true)
      .then(data => { if (mounted) setPolicy(data); })
      .catch(() => { if (mounted) setPolicyError(true); });
    return () => { mounted = false; };
  }, [attempt]);

  const fmt = (value: number) => value.toLocaleString(ar ? 'ar-EG' : 'en-EG');
  const price = (tier: 'featured' | 'vip') => prices
    ? (ar ? fmt(prices[tier]) + ' جنيه / يوم' : 'EGP ' + fmt(prices[tier]) + ' / day')
    : (pricesError ? (ar ? 'السعر غير متاح حاليًا' : 'Price unavailable') : (ar ? 'جارٍ تحميل السعر…' : 'Loading price…'));
  const freeDays = policy ? (ar ? fmt(policy.freeDurationDays) + ' أيام' : fmt(policy.freeDurationDays) + ' days')
    : (ar ? 'جارٍ تحميل المدة…' : 'Loading duration…');
  const interval = policy
    ? (ar ? 'كل ' + fmt(policy.freeIntervalDays) + ' يوم من آخر موافقة' : 'Every ' + fmt(policy.freeIntervalDays) + ' days after approval')
    : (ar ? 'جارٍ تحميل فترة الانتظار…' : 'Loading waiting period…');

  const cards = [
    { tier: 'free' as const, label: ar ? 'مجاني' : 'Free', price: ar ? 'مجانًا' : 'Free',
      Icon: Gift, border: 'border-slate-200 dark:border-slate-700',
      highlights: [ar ? 'داخل قسم الإعلان' : 'Within the ad category',
        ar ? 'صورة واحدة اختيارية' : 'One optional image', freeDays] },
    { tier: 'featured' as const, label: ar ? 'مميز' : 'Featured', price: price('featured'),
      Icon: Star, border: 'border-emerald-300 dark:border-emerald-700',
      highlights: [ar ? 'قبل الإعلانات المجانية' : 'Before free ads',
        ar ? 'صورة أو فيديو 30 ثانية' : 'Image or video up to 30 seconds',
        ar ? 'مفضلة واتصال وواتساب وخريطة' : 'Favorites, call, WhatsApp and map'] },
    { tier: 'vip' as const, label: 'VIP', price: price('vip'),
      Icon: Bell, border: 'border-amber-300 dark:border-amber-700',
      highlights: [ar ? 'الواجهة الرئيسية ومقدمة القسم' : 'Homepage and top of category',
        ar ? 'صورة أو فيديو 60 ثانية' : 'Image or video up to 60 seconds',
        ar ? 'إشعار واحد للمشتركين عند الموافقة' : 'One push campaign on approval'] },
  ];
  const rows: Row[] = [
    { label: ar ? 'مكان ظهور الإعلان' : 'Ad placement',
      free: ar ? 'داخل القسم بعد الإعلانات المدفوعة' : 'Category after paid ads',
      featured: ar ? 'داخل القسم قبل المجاني' : 'Category before free',
      vip: ar ? 'واجهة العروض ومقدمة القسم' : 'Offers landing and category top' },
    { label: ar ? 'الصورة' : 'Image', free: ar ? 'صورة اختيارية' : 'Optional image',
      featured: ar ? 'صورة اختيارية' : 'Optional image', vip: ar ? 'صورة اختيارية' : 'Optional image' },
    { label: ar ? 'الفيديو' : 'Video', free: false,
      featured: ar ? 'حتى 30 ثانية' : 'Up to 30 seconds', vip: ar ? 'حتى 60 ثانية' : 'Up to 60 seconds' },
    { label: ar ? 'إعجاب ومشاركة' : 'Like and share', free: true, featured: true, vip: true },
    { label: ar ? 'حفظ في المفضلة' : 'Save as favorite', free: false, featured: true, vip: true },
    { label: ar ? 'الاتصال وواتساب' : 'Call and WhatsApp',
      free: ar ? 'تواصل نصي فقط' : 'Text contact only', featured: true, vip: true },
    { label: ar ? 'زر استخدم الخريطة' : 'Google Maps link', free: false, featured: true, vip: true },
    { label: ar ? 'إشعارات للأجهزة المشتركة' : 'Push notifications', free: false, featured: false,
      vip: ar ? 'بعد الموافقة للمشتركين المؤهلين' : 'After approval, for eligible subscribers' },
    { label: ar ? 'بدء النشر' : 'Publication begins',
      free: ar ? 'بعد الموافقة' : 'After approval',
      featured: ar ? 'الموعد المختار بعد الموافقة' : 'Selected date after approval',
      vip: ar ? 'فور الموافقة' : 'Immediately after approval' },
    { label: ar ? 'مدة النشر' : 'Publication duration',
      free: freeDays, featured: ar ? 'بحسب المواعيد المختارة' : 'Selected dates',
      vip: ar ? 'عدد الأيام المطلوبة' : 'Requested days' },
    { label: ar ? 'فترة الانتظار لإعلان جديد' : 'Waiting period',
      free: interval, featured: false, vip: false },
    { label: ar ? 'مراجعة الإدارة قبل النشر' : 'Administrator review', free: true, featured: true, vip: true },
  ];
  const showValue = (value: Value) => typeof value === 'boolean'
    ? (value ? <Check aria-label={ar ? 'متاح' : 'Included'} className="mx-auto h-5 w-5 text-emerald-700 dark:text-emerald-300" />
      : <X aria-label={ar ? 'غير متاح' : 'Not included'} className="mx-auto h-4 w-4 text-slate-400" />)
    : value;
  return <main dir={ar ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 px-3 py-6 pb-16 text-slate-900 dark:bg-slate-950 dark:text-slate-100 sm:px-6">
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="flex items-start gap-3">
        <button type="button" aria-label={ar ? 'العودة إلى إنشاء الإعلان' : 'Back to ad creation'}
          onClick={onBack} className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <BackIcon className="h-5 w-5" aria-hidden="true" />
        </button>
        <div>
          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-300">My Bucket</p>
          <h1 className="text-xl font-black sm:text-2xl">{ar ? 'المميزات والأسعار' : 'Benefits and pricing'}</h1>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {ar ? 'قارن أنواع الإعلانات واختار الأنسب ليك. الأسعار بتتحدث من لوحة الإدارة.' : 'Compare ad tiers. Prices update from the administrator settings.'}
          </p>
        </div>
      </header>
      {(pricesError || policyError) && <div role="alert" className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-950 dark:bg-amber-950 dark:text-amber-100">
        <span>{ar ? 'تعذّر تحميل بعض الأسعار أو المدد من إعدادات الإدارة.' : 'Could not load some prices or durations.'}</span>
        <button type="button" onClick={() => setAttempt(value => value + 1)} className="min-h-10 rounded-lg border border-amber-400 px-3 font-bold">
          {ar ? 'إعادة المحاولة' : 'Retry'}
        </button>
      </div>}
      <section aria-label={ar ? 'أنواع الإعلانات' : 'Ad types'} className="grid gap-3 md:grid-cols-3">
        {cards.map(card => {
          const Icon = card.Icon;
          return <article key={card.tier} className={'flex min-w-0 flex-col gap-3 rounded-2xl border-2 bg-white p-4 shadow-sm dark:bg-slate-900 ' + card.border}>
            <div className="flex items-center gap-2">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <h2 className="text-base font-extrabold">{card.label}</h2>
            </div>
            <p className="text-xl font-black text-emerald-800 dark:text-emerald-300">{card.price}</p>
            <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
              {card.highlights.map((point, index) => <li key={index} className="flex items-start gap-2">
                <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /><span>{point}</span>
              </li>)}
            </ul>
            <button type="button" disabled={(card.tier !== 'free' && !prices) || (onlyFree && card.tier !== 'free')}
              onClick={() => onChoose(card.tier)}
              className="mt-auto min-h-11 rounded-xl bg-emerald-700 px-3 py-2 text-sm font-extrabold text-white hover:bg-emerald-800 disabled:opacity-50">
              {onlyFree && card.tier !== 'free' ? (ar ? 'غير متاح عند تصحيح الإعلان المجاني' : 'Not available when correcting a free ad')
                : (ar ? 'اختيار ' + card.label : 'Choose ' + card.label)}
            </button>
          </article>;
        })}
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900 sm:p-5">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-base font-extrabold">{ar ? 'المقارنة بالتفصيل' : 'Detailed comparison'}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{ar ? 'حرّك الجدول يمين وشمال على الموبايل' : 'Scroll sideways on mobile'}</p>
        </div>
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700" tabIndex={0}>
          <table className="min-w-[660px] w-full border-collapse text-sm">
            <thead className="bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100">
              <tr>
                <th className="w-[28%] px-3 py-3 text-start" scope="col">{ar ? 'الميزة' : 'Feature'}</th>
                <th className="px-3 py-3" scope="col">{ar ? 'مجاني' : 'Free'}</th>
                <th className="px-3 py-3" scope="col">{ar ? 'مميز' : 'Featured'}</th>
                <th className="px-3 py-3" scope="col">VIP</th>
              </tr>
            </thead>
            <tbody>{rows.map((row, index) => <tr key={row.label} className={'border-t border-slate-100 dark:border-slate-700 ' + (index % 2 ? 'bg-slate-50/70 dark:bg-slate-800/30' : '')}>
              <th scope="row" className="px-3 py-3 text-start font-bold">{row.label}</th>
              <td className="px-3 py-3 text-center">{showValue(row.free)}</td>
              <td className="px-3 py-3 text-center">{showValue(row.featured)}</td>
              <td className="px-3 py-3 text-center">{showValue(row.vip)}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>
      <div className="rounded-xl bg-emerald-50 p-4 text-xs leading-6 text-emerald-950 dark:bg-emerald-950/30 dark:text-emerald-100">
        <p>{ar ? 'الأسعار ومدة الإعلان المجاني وفترة انتظاره مرتبطة بإعدادات الإدارة، وممكن تتغير في أي وقت.' : 'Prices, free-ad duration and waiting period are controlled by the administrator and may change anytime.'}</p>
        <p>{ar ? 'كل الإعلانات تخضع لمراجعة الإدارة. إشعارات VIP للمشتركين المؤهلين فقط، ومش مضمون وصولها لكل جهاز.' : 'All ads require administrator review. VIP notifications target eligible subscribers; delivery to every device is not guaranteed.'}</p>
      </div>
      <button type="button" onClick={onBack} className="min-h-11 w-full rounded-xl border border-emerald-600 px-3 text-sm font-extrabold text-emerald-800 dark:text-emerald-300">
        {ar ? 'الرجوع لإنشاء الإعلان' : 'Back to ad creation'}
      </button>
    </div>
  </main>;
}
