import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Store } from 'lucide-react';
import type { Language } from '../../types';
import type { PublicOfferAd } from '../../data/offerAds';
import { offerAdsRequest } from '../../services/offerAdsClient';
import { DEMO_ADS } from '../../data/demoAds';
import { adContactPhone } from '../../utils/adContactPhone';
import { AdVideoPlayer } from '../AdVideoPlayer';

export function OfferDetailPage({ lang, offerId }: { lang: Language; offerId: string }) {
  const ar = lang === 'ar';
  const demo = DEMO_ADS.find(ad => ad.id === offerId);
  const [result, setResult] = useState<{ id: string; offer?: PublicOfferAd | null; expired?: boolean; failed?: boolean }>();
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (demo) return;
    let active = true;
    offerAdsRequest<PublicOfferAd | { expired: true } | null>('ads.detail', { id: offerId })
      .then(offer => { if (active) setResult(offer && 'expired' in offer ? { id: offerId, expired: true } : { id: offerId, offer }); })
      .catch(() => { if (active) setResult({ id: offerId, failed: true }); });
    return () => { active = false; };
  }, [attempt, demo, offerId]);

  const current = result?.id === offerId ? result : undefined;
  const live = current?.offer;
  const [title, description, merchant] = demo ? (ar ? demo.ar : demo.en) : live
    ? [live.title, live.description, live.merchant]
    : [current?.failed ? (ar ? 'تعذّر تحميل العرض' : 'Could not load the offer')
      : current?.expired ? (ar ? 'انتهت مدة العرض' : 'This offer has ended')
      : current ? (ar ? 'العرض غير متاح' : 'Offer unavailable') : (ar ? 'جاري تحميل العرض...' : 'Loading offer…')];
  const contactPhone = live?.contact ? adContactPhone(live.contact) : null;
  const categorySlug = demo?.categorySlug ?? live?.categorySlug;
  const image = demo && 'image' in demo ? `/demo-ads/${demo.image}` : live?.media?.type === 'image' ? live.media.url : undefined;
  const video = demo && 'video' in demo ? { url: `/demo-ads/${demo.video}`, poster: `/demo-ads/${demo.poster}` }
    : live?.media?.type === 'video' ? live.media : undefined;
  const BackIcon = ar ? ArrowRight : ArrowLeft;

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${title} | My Bucket`;
    const descriptionTag = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = descriptionTag?.content;
    if (descriptionTag) descriptionTag.content = description ?? title;
    return () => {
      document.title = previousTitle;
      if (descriptionTag && previousDescription !== undefined) descriptionTag.content = previousDescription;
    };
  }, [title, description]);

  return (
    <main dir={ar ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl">
        <a href={categorySlug ? `/offers/category/${categorySlug}` : '/offers'}
          className="mb-4 inline-flex min-h-11 items-center gap-2 rounded-xl px-3 text-sm font-bold text-emerald-800 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-emerald-200 dark:hover:bg-emerald-950">
          <BackIcon className="size-5" aria-hidden="true" />
          {ar ? 'كل عروض القسم' : 'Back to offers'}
        </a>
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-3 p-4 sm:p-6">
            {demo && <p className="w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-900">{ar ? 'إعلان تجريبي' : 'Demo ad'}</p>}
            {merchant && <p className="flex items-center gap-2 text-sm font-semibold">
              <Store className="size-5 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />{merchant}
            </p>}
            <h1 className="break-words text-2xl font-extrabold sm:text-3xl">{title}</h1>
          </div>
          {image && <img src={image} alt={title}
            className="max-h-[60vh] w-full bg-slate-100 object-contain dark:bg-slate-800" />}
          {video && <div className="px-4 sm:px-6">
            <AdVideoPlayer src={video.url} poster={video.poster} lang={lang} adId={offerId}
              label={title} className="max-h-[60vh] w-full rounded-xl bg-black object-contain" />
          </div>}
          {(demo || live) && <div className="space-y-3 p-4 sm:p-6">
            <p className="whitespace-pre-wrap break-words leading-relaxed">{description}</p>
            {demo && <p className="text-sm text-slate-600 dark:text-slate-300">{ar ? 'ده مثال تجريبي للعرض ومش متاح للشراء.' : 'This is a fictional offer for demonstration.'}</p>}
            {live && <div className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
              <p>{ar ? 'العرض متاح لحد' : 'Available until'} {new Date(live.endsAt).toLocaleString(ar ? 'ar-EG' : 'en-GB', { timeZone: 'Africa/Cairo', timeZoneName: 'short' })}</p>
              {live.contact && <p className="break-words"><strong>{ar ? 'للتواصل' : 'Contact'}</strong>{' '}
                {contactPhone ? <a href={contactPhone} dir="ltr" className="inline-block font-bold text-blue-700 underline underline-offset-2 dark:text-blue-300">{live.contact}</a> : live.contact}</p>}
            </div>}
          </div>}
          {current?.failed && <button type="button" className="m-4 font-bold text-emerald-700 underline dark:text-emerald-300" onClick={() => { setResult(undefined); setAttempt(value => value + 1); }}>{ar ? 'حاول تاني' : 'Retry'}</button>}
        </article>
      </div>
    </main>
  );
}
