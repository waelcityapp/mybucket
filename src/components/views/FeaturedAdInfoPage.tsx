import { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import type { OfferTier } from '../../data/offerAds';
import type { Language } from '../../types';
import { paidAdDailyPrice } from '../../utils/adCheckout';

export function AdTierInfoDialog({ lang, tier, freeDays, onClose }: {
  lang: Language;
  tier: OfferTier;
  freeDays: number;
  onClose: () => void;
}) {
  const ar = lang === 'ar';
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (element && !element.open) element.showModal();
  }, []);
  const title = tier === 'vip' ? 'VIP' : tier === 'free' ? (ar ? 'مجاني' : 'Free') : (ar ? 'مميز' : 'Featured');
  const placement = tier === 'vip'
    ? (ar ? 'يظهر في واجهة «وفّر مع My Bucket» وفي مقدمة إعلانات قسمه.' : 'Appears on the offers landing page and leads its category.')
    : tier === 'featured'
      ? (ar ? 'يظهر داخل قسمه قبل الإعلانات المجانية.' : 'Appears in its category before free ads.')
      : (ar ? 'يظهر داخل قسمه بعد إعلانات VIP والمميزة.' : 'Appears in its category after VIP and Featured ads.');
  const number = new Intl.NumberFormat(ar ? 'ar-EG' : 'en-GB');
  return <dialog ref={dialog} onClose={onClose} aria-labelledby="ad-tier-info-title" dir={ar ? 'rtl' : 'ltr'}
    className="m-auto max-h-[85vh] w-[calc(100%-2rem)] max-w-md overflow-y-auto rounded-2xl border border-emerald-200 bg-white p-5 text-slate-900 shadow-xl backdrop:bg-black/50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
    <header className="flex items-start justify-between gap-3">
      <div>
        <h2 id="ad-tier-info-title" className="text-lg font-extrabold">{ar ? 'المميزات والأسعار' : 'Benefits and pricing'}</h2>
        <p className="mt-1 text-sm font-bold text-emerald-800 dark:text-emerald-300">{title}</p>
      </div>
      <button type="button" autoFocus onClick={() => dialog.current?.close()} aria-label={ar ? 'إغلاق' : 'Close'}
        className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-100 dark:bg-slate-800">
        <X className="size-5" aria-hidden="true" />
      </button>
    </header>
    <ul className="my-4 list-disc space-y-2 ps-5 text-sm leading-relaxed">
      <li>{placement}</li>
      <li>{ar ? 'صفحة تفاصيل خاصة بالإعلان ورقم اتصال قابل للضغط لو أضفته.' : 'A dedicated ad page with click-to-call if you add a phone number.'}</li>
      <li>{ar ? 'النشر بعد موافقة الإدارة.' : 'Published after admin approval.'}</li>
    </ul>
    <div className="space-y-1 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100">
      {tier === 'free' ? <>
        <p className="font-extrabold">{ar ? 'مجانًا' : 'Free of charge'}</p>
        <p>{ar ? `إعلان واحد كل ${number.format(freeDays)} يوم من آخر موافقة.` : `One ad every ${freeDays} days from your last approval.`}</p>
      </> : <>
        <p className="font-extrabold">{ar ? `${number.format(paidAdDailyPrice(tier))} جنيه لكل يوم` : `EGP ${paidAdDailyPrice(tier)} per day`}</p>
        <p>{ar ? 'السعر تجريبي. الدفع بإنستا باي وإرفاق الإيصال للمراجعة.' : 'Trial rate. Pay through InstaPay and attach the receipt for review.'}</p>
      </>}
    </div>
  </dialog>;
}
