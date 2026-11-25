import { VipPushSettings } from '../VipPushSettings';
import { OfferContactActions } from '../OfferContactActions';
import { followInternalLink } from '../../utils/navigationHistory';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Search, Plus, Landmark, UtensilsCrossed, ShoppingBasket,
  Shirt, Plane, Dumbbell, Car, HeartPulse, House, GraduationCap,
  Gift, Smartphone, Store, Play, Eye, type LucideIcon
} from 'lucide-react';
import { Language } from '../../types';
import { rankOfferCategories, supportsOfferFavorites, type OfferEngagement, type OfferReaction, type OfferReactionState, type PublicOfferAd } from '../../data/offerAds';
import { useOfferCategories } from '../../services/offerCategoriesClient';
import { offerAdsRequest } from '../../services/offerAdsClient';
import { DEMO_ADS } from '../../data/demoAds';
import { offerShareExcerpt } from '../../utils/offerShare';
import { OfferCardActions } from '../OfferCardActions';

interface OffersPageProps {
  lang: Language;
  showViewCounts: boolean;
  authChecking: boolean;
  favoritesPage?: boolean;
  viewerId?: string;
  onSignIn: () => Promise<{ uid: string }>;
  onBack: () => void;
  categorySlug?: string | null;
  onNavigate: (path: string) => void;
}

const categoryIcons: Record<string, LucideIcon> = {
  'banks-finance': Landmark,
  'restaurants-cafes-outings': UtensilsCrossed,
  'food-beverages': ShoppingBasket,
  fashion: Shirt,
  'travel-events': Plane,
  'sports-fitness': Dumbbell,
  'cars-transport': Car,
  'health-beauty': HeartPulse,
  'home-shopping': House,
  'education-services': GraduationCap,
  technology: Smartphone,
};

type OfferCard = PublicOfferAd & { viewCount?: number };
const viewedAdIds = new Set<string>();
let memorySessionId: string | undefined;

function viewSessionId() {
  try {
    const key = 'mybucket:offer-view-session';
    const existing = sessionStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(key, id);
    return id;
  } catch {
    return memorySessionId ??= crypto.randomUUID();
  }
}

export const OffersPage: React.FC<OffersPageProps> = ({ lang, onBack, categorySlug, onNavigate, showViewCounts, authChecking, viewerId, onSignIn, favoritesPage = false }) => {
  const isAr = lang === 'ar';
  const BackIcon = isAr ? ArrowRight : ArrowLeft;
  const ForwardIcon = isAr ? ArrowLeft : ArrowRight;
  const { categories, categoryError, reloadCategories } = useOfferCategories();
  const [search, setSearch] = useState('');
  const [published, setPublished] = useState<OfferCard[] | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const [loadError, setLoadError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [viewsUnavailable, setViewsUnavailable] = useState(false);
  const [confirmedViews, setConfirmedViews] = useState<Record<string, number>>({});
  const [favoritesFilter, setFavoritesOnly] = useState(false);
  const favoritesOnly = favoritesPage || favoritesFilter;
  const [reactionsError, setReactionsError] = useState(false);
  type Reactions = Record<string, OfferReactionState>;
  const [accountReactions, setAccountReactions] = useState<Record<string, Reactions>>({});
  const reactions = viewerId ? accountReactions[viewerId] : undefined;
  const reactionRevision = useRef(0);
  const [demoEngagement, setDemoEngagement] = useState<Record<string, OfferEngagement>>({});
  useEffect(() => {
    if (!viewerId) return;
    let active = true;
    setReactionsError(false);
    const revision = reactionRevision.current;
    offerAdsRequest<Reactions>('ads.reactions', {}, true).then(result => {
      if (active && revision === reactionRevision.current) {
        setAccountReactions(current => ({ ...current, [viewerId]: result }));
      }
    }).catch(() => { if (active) setReactionsError(true); });
    return () => { active = false; };
  }, [viewerId, attempt]);
  useEffect(() => {
    let active = true;
    setLoadError(false);
    setViewsUnavailable(false);
    const request = showViewCounts
      ? offerAdsRequest<OfferCard[]>('admin.ads.listWithViews', {}, true).catch(() => {
          if (active) setViewsUnavailable(true);
          return offerAdsRequest<OfferCard[]>('ads.list');
        })
      : offerAdsRequest<OfferCard[]>('ads.list');
    request.then(ads => { if (active) setPublished(ads); })
      .catch(() => { if (active) setLoadError(true); });
    return () => { active = false; };
  }, [attempt, showViewCounts]);
  useEffect(() => {
    if (!published) return;
    let timer: number | undefined;
    const expireAds = () => {
      window.clearTimeout(timer);
      const now = Date.now();
      let next = Infinity;
      for (const ad of published) {
        if (ad.endsAt <= now) continue;
        next = Math.min(next, ad.endsAt);
      }
      if (published.some(ad => ad.endsAt <= now)) {
        setPublished(current => current?.filter(ad => ad.endsAt > now) ?? null);
      }
      if (next < Infinity) timer = window.setTimeout(expireAds, Math.min(next - now, 2_147_483_647));
    };
    expireAds();
    document.addEventListener('visibilitychange', expireAds);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', expireAds);
    };
  }, [published]);
  const category = categories?.find(item => item.id === categorySlug);
  const list = useMemo(() => rankOfferCategories(categories ?? [], published ?? [], lang).filter(item =>
    `${item.ar} ${item.en}`.toLowerCase().includes(search.trim().toLowerCase())
  ), [categories, published, lang, search]);

  const allDemoAds = DEMO_ADS.map(ad => {
    const [title, description, merchant] = isAr ? ad.ar : ad.en;
    const media = 'video' in ad ? { type: 'video' as const, poster: `/demo-ads/${ad.poster}`, url: `/demo-ads/${ad.video}` }
      : 'image' in ad ? { type: 'image' as const, url: `/demo-ads/${ad.image}` } : undefined;
    return { id: ad.id, categorySlug: ad.categorySlug, title, description, merchant, media };
  });
  const vipAds = published?.filter(ad => ad.tier === 'vip') ?? [];
  const categoriesOnly = new URLSearchParams(window.location.search).get('view') === 'categories';
  const showVip = !categorySlug && !categoriesOnly && vipAds.length > 0;
  const rotation = vipAds.length ? Math.floor(Date.now() / 60000) % vipAds.length : 0;
  const rank = { vip: 0, featured: 1, free: 2 };
  const realAds = published?.filter(ad => ad.categorySlug === categorySlug)
    .sort((a, b) => rank[a.tier ?? 'free'] - rank[b.tier ?? 'free']) ?? [];
  const demoAds = category?.archived ? [] : allDemoAds.filter(ad => ad.categorySlug === categorySlug);
  const visibleAds = favoritesOnly
    ? (published ?? []).filter(ad => supportsOfferFavorites(ad.tier) && reactions?.[ad.id]?.saved === true)
    : showVip ? [...vipAds.slice(rotation), ...vipAds.slice(0, rotation)]
    : realAds.length ? realAds : demoAds;
  const showingDemos = !favoritesOnly && !showVip && realAds.length === 0;
  const hasDemoCards = visibleAds.some(ad => DEMO_ADS.some(demo => demo.id === ad.id));
  useEffect(() => {
    if (!hasDemoCards) return;
    let active = true;
    const revision = reactionRevision.current;
    const action = showViewCounts ? 'admin.ads.demoEngagement' : 'ads.demoEngagement';
    offerAdsRequest<Record<string, OfferEngagement & { viewCount?: number }>>(action, {}, showViewCounts).then(result => {
      if (active && showViewCounts) {
        setConfirmedViews(current => {
          const next = { ...current };
          for (const [id, stats] of Object.entries(result)) {
            if (stats.viewCount !== undefined) next[id] = Math.max(current[id] ?? 0, stats.viewCount);
          }
          return next;
        });
      }
      if (active) {
        setDemoEngagement(current => revision === reactionRevision.current ? result : { ...result, ...current });
      }
    }).catch(() => {});
    return () => { active = false; };
  }, [hasDemoCards, attempt, showViewCounts]);

  async function reactToAd(id: string, demo: boolean, reaction: OfferReaction) {
    const uid = viewerId ?? (await onSignIn()).uid;
    const known = accountReactions[uid] ?? await offerAdsRequest<Reactions>('ads.reactions', {}, true);
    const result = await offerAdsRequest<{ state: OfferReactionState; engagement: OfferEngagement }>(
      'ads.react', { id, reaction, active: !known[id]?.[reaction] }, true
    );
    reactionRevision.current += 1;
    setAccountReactions(current => ({ ...current, [uid]: { ...known, ...current[uid], [id]: result.state } }));
    if (demo) setDemoEngagement(current => ({ ...current, [id]: result.engagement }));
    else setPublished(ads => ads?.map(ad => ad.id === id ? { ...ad, engagement: result.engagement } : ad) ?? null);
  }
  const [vipLimit, setVipLimit] = useState(9);
  useEffect(() => {
    const grid = gridRef.current;
    if (authChecking || !grid || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (entry.intersectionRatio < 0.5 || document.visibilityState !== 'visible') continue;
        const card = entry.target as HTMLElement;
        const id = card.dataset.offerId;
        if (!id) continue;
        observer.unobserve(entry.target);
        if (viewedAdIds.has(id)) continue;
        viewedAdIds.add(id);
        const action = showViewCounts ? 'admin.ads.view' : 'ads.view';
        const payload = { id, sessionId: viewSessionId() };
        const record = () => offerAdsRequest<number | null>(action, payload, showViewCounts);
        void record().catch(record).then(total => {
          if (typeof total === 'number') {
            setConfirmedViews(current => ({ ...current, [id]: Math.max(current[id] ?? 0, total) }));
          }
        }).catch(() => viewedAdIds.delete(id));
      }
    }, { threshold: 0.5 });
    const observeCards = () => {
      observer.disconnect();
      if (document.visibilityState === 'visible') {
        grid.querySelectorAll('[data-offer-id]').forEach(card => observer.observe(card));
      }
    };
    observeCards();
    document.addEventListener('visibilitychange', observeCards);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', observeCards);
    };
  }, [published, categorySlug, showVip, vipLimit, rotation, showViewCounts, authChecking, favoritesOnly, reactions]);

  const title = favoritesPage ? (isAr ? 'إعلاناتي المفضلة' : 'Favorite ads') : category ? (isAr ? category.ar : category.en) : (isAr ? 'وفّر مع My Bucket' : 'Save with My Bucket');

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-[#F8FAFC] text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="bg-white border-b border-slate-200 dark:bg-slate-900 dark:border-slate-800">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center gap-3">
          <button type="button" onClick={onBack} aria-label={isAr ? 'رجوع' : 'Back'}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 shrink-0">
            <BackIcon className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-extrabold leading-snug">{title}</h1>
            <p className="text-xs text-slate-500">My Bucket</p>
          </div>
          {!categorySlug && !favoritesPage && (
            <button type="button" onClick={() => onNavigate('/offers/new')}
              aria-label={isAr ? 'إضافة إعلان جديد' : 'Add new advertisement'}
              title={isAr ? 'إضافة إعلان جديد' : 'Add new advertisement'}
              className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-2xl bg-emerald-600 text-white shadow-md hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 flex items-center justify-center transition-colors">
              <Plus className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={3} />
            </button>
          )}
        </div>
      </header>

      <main className={`mx-auto px-4 py-6 pb-16 ${categorySlug || showVip ? "max-w-7xl" : "max-w-xl"}`}>
        {!categorySlug && !favoritesPage && <VipPushSettings lang={lang} />}
        {categoryError && <p role="alert" className="mb-4 text-sm text-red-700 dark:text-red-300">
          {isAr ? 'تعذّر تحميل أقسام العروض.' : 'Could not load offer categories.'}{' '}
          <button type="button" className="font-bold underline" onClick={reloadCategories}>{isAr ? 'حاول تاني' : 'Retry'}</button>
        </p>}
        {!categories && !categoryError && <p role="status" className="mb-4 text-sm">{isAr ? 'جاري تحميل الأقسام…' : 'Loading categories…'}</p>}
        {loadError ? <p role="alert" className="mb-4 text-sm text-red-700">
          {isAr ? 'تعذّر تحميل العروض المنشورة.' : 'Could not load published ads.'}{' '}
          <button type="button" className="font-bold underline" onClick={() => setAttempt(value => value + 1)}>{isAr ? 'حاول تاني' : 'Retry'}</button>
        </p> : published === null && <p role="status" className="mb-4 text-sm text-slate-600">{isAr ? 'جاري تحميل العروض المنشورة...' : 'Loading published ads…'}</p>}
        {!favoritesPage && <button type="button" aria-pressed={favoritesOnly} onClick={() => {
          if (favoritesOnly || viewerId) setFavoritesOnly(value => !value);
          else void onSignIn().then(() => setFavoritesOnly(true)).catch(() => {});
        }}
          className="mb-4 min-h-11 rounded-xl border border-emerald-200 px-4 text-sm font-bold text-emerald-800 dark:text-emerald-300">
          {favoritesOnly ? (isAr ? 'رجوع للإعلانات' : 'Back to offers') : (isAr ? 'إعلاناتي المفضلة' : 'Favorite ads')}
        </button>}
        {favoritesOnly && (reactionsError ? <p role="alert" className="mb-4 text-sm text-red-700 dark:text-red-300">
          {isAr ? 'تعذّر تحميل المفضلة.' : 'Could not load favorites.'}{' '}
          <button type="button" className="font-bold underline" onClick={() => setAttempt(value => value + 1)}>{isAr ? 'حاول تاني' : 'Retry'}</button>
        </p> : !reactions && <p role="status" className="mb-4 text-sm text-slate-600 dark:text-slate-300">
          {isAr ? 'جاري تحميل المفضلة…' : 'Loading favorites…'}
        </p>)}
        {showViewCounts && viewsUnavailable && <p role="status" className="mb-4 text-sm text-amber-800 dark:text-amber-300">
          {isAr ? 'تعذّر تحميل عدادات المشاهدات.' : 'Could not load view counts.'}{' '}
          <button type="button" className="font-bold underline" onClick={() => setAttempt(value => value + 1)}>{isAr ? 'حاول تاني' : 'Retry'}</button>
        </p>}
        {categorySlug || showVip || favoritesOnly ? (
          <section className="space-y-4">
            {!categories && categorySlug && !showVip && !favoritesOnly ? null : category || showVip || favoritesOnly ? (
              <>
                {showVip && !favoritesOnly && <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="text-lg font-extrabold">{isAr ? 'عروض VIP' : 'VIP offers'}</h2>
                  <a href="/offers?view=categories" onClick={event => followInternalLink(event, onNavigate)}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white">
                    <Search className="size-4" aria-hidden="true" />{isAr ? 'تصفّح الأقسام' : 'Browse categories'}
                  </a>
                </div>}
                {visibleAds.length > 0 ? (
                  <div className="space-y-4">
                    {showingDemos && <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm font-semibold text-amber-900">{isAr ? 'الإعلانات دي أمثلة تجريبية، والعروض وأسماء المعلنين غير حقيقية.' : 'These are demonstration ads with fictional offers and advertisers.'}</p>}
                    <div ref={gridRef} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {(showVip && !favoritesOnly ? visibleAds.slice(0, vipLimit) : visibleAds).map(ad => {
                        const tier = 'tier' in ad ? ad.tier : undefined;
                        const demo = DEMO_ADS.some(example => example.id === ad.id);
                        const badge = demo ? (isAr ? 'إعلان تجريبي' : 'Demo ad')
                          : tier === 'vip' ? 'VIP' : tier === 'featured' ? (isAr ? 'مميز' : 'Featured') : null;
                        const { title: adTitle, description, merchant, media } = ad;
                        const cardCategory = showVip ? categories?.find(item => item.id === ad.categorySlug) : undefined;
                        const listedViews = 'viewCount' in ad && typeof ad.viewCount === 'number' ? ad.viewCount : undefined;
                        const confirmed = confirmedViews[ad.id];
                        const viewCount = confirmed === undefined ? listedViews : Math.max(listedViews ?? 0, confirmed);
                        const hasVideo = media?.type === 'video';
                        return (
                          <article key={ad.id} data-offer-id={ad.id} className="relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            {media?.type === 'image' && <img src={media.url} alt="" loading="lazy" className="aspect-video w-full bg-slate-100 object-cover dark:bg-slate-800" />}
                            {hasVideo && <a href={`/offers/ad/${ad.id}`} onClick={event => followInternalLink(event, onNavigate)}
                              aria-label={`${isAr ? 'شوف الفيديو' : 'View video'} · ${adTitle}`}
                              className="relative block aspect-video bg-emerald-950 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white">
                              {media?.poster && <img src={media.poster} alt="" loading="lazy" className="h-full w-full object-cover" />}
                              <span className="absolute inset-0 grid place-items-center" aria-hidden="true">
                                <span className="grid size-12 place-items-center rounded-full bg-black/70 text-white">
                                  <Play className="size-5 fill-current" />
                                </span>
                              </span>
                            </a>}
                            {badge && <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${tier === 'vip' ? 'bg-amber-100 text-amber-900' : 'bg-emerald-50 text-emerald-900'} ${media ? 'absolute start-3 top-3' : 'ms-3 mt-3'}`}>
                              {badge}
                            </span>}
                            <div className="flex flex-1 flex-col gap-2 p-3.5">
                              {cardCategory && <a href={`/offers/category/${cardCategory.id}`} onClick={event => followInternalLink(event, onNavigate)}
                                className="w-fit max-w-full break-words rounded text-xs font-bold text-emerald-800 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:text-emerald-300">
                                {isAr ? cardCategory.ar : cardCategory.en}
                              </a>}
                              <p className="flex min-w-0 items-center gap-1.5 text-sm font-semibold">
                                <Store className="size-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" /><span className="min-w-0 break-words">{merchant}</span>
                              </p>
                              <h2 className="break-words text-lg font-extrabold leading-snug">{adTitle}</h2>
                              <p className="line-clamp-2 break-words text-sm text-slate-600 dark:text-slate-300">{offerShareExcerpt(description)}</p>
                              <div className="mt-auto flex flex-wrap items-center justify-end gap-2 pt-1">
                                {showViewCounts && typeof viewCount === 'number' && (
                                  <span className="me-auto inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                                    <Eye className="size-4" aria-hidden="true" />
                                    {isAr ? 'المشاهدات' : 'Views'} {viewCount.toLocaleString(isAr ? 'ar-EG' : 'en')}
                                  </span>
                                )}
                                <a href={`/offers/ad/${ad.id}`} onClick={event => followInternalLink(event, onNavigate)} aria-label={`${isAr ? 'مزيد من التفاصيل' : 'More details'} · ${adTitle}`}
                                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-50 px-3 text-sm font-bold text-emerald-900 hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:bg-emerald-950 dark:text-emerald-200 dark:hover:bg-emerald-900">
                                  {isAr ? 'مزيد من التفاصيل' : 'More details'} <ForwardIcon className="size-4" aria-hidden="true" />
                                </a>
                              </div>
                              {(tier === 'featured' || tier === 'vip') && <OfferContactActions details={ad as PublicOfferAd} lang={lang} />}
                              <OfferCardActions id={ad.id} isAr={isAr} canSave={!demo && supportsOfferFavorites('tier' in ad ? ad.tier : undefined)} state={reactions?.[ad.id]}
                                engagement={demo ? demoEngagement[ad.id] : 'engagement' in ad ? ad.engagement : undefined}
                                onReact={reaction => reactToAd(ad.id, demo, reaction)} />
                            </div>
                          </article>
                        );
                      })}
                    </div>
                    {showVip && !favoritesOnly && vipLimit < visibleAds.length && <button type="button" onClick={() => setVipLimit(value => value + 9)}
                      className="min-h-11 rounded-xl border border-emerald-200 px-4 text-sm font-bold text-emerald-800 dark:text-emerald-300">
                      {isAr ? 'عرض المزيد' : 'Show more'}
                    </button>}
                  </div>
                ) : published !== null && (!favoritesOnly || (reactions && !loadError && !reactionsError)) && <div className="bg-white border border-slate-200 rounded-2xl p-9 text-center dark:bg-slate-900 dark:border-slate-800">
                  <Gift className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <h2 className="text-base font-bold">{favoritesOnly ? (isAr ? 'لسه مفيش إعلانات في المفضلة' : 'No favorite ads yet') : (isAr ? 'لا توجد عروض منشورة في هذا القسم حاليًا' : 'No published offers in this category yet')}</h2>
                  {!favoritesOnly && <p className="text-sm text-slate-500 mt-2">{isAr ? 'عند إضافة عروض حقيقية، هتظهر هنا.' : 'Published offers will appear here once available.'}</p>}
                </div>}
              </>
            ) : (
              <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center">
                <p className="font-bold">{isAr ? 'القسم غير موجود' : 'Category not found'}</p>
                <button onClick={onBack} className="mt-4 text-emerald-700 text-sm font-bold">{isAr ? 'رجوع للأقسام' : 'Back to categories'}</button>
              </div>
            )}
          </section>
        ) : (
          <section className="space-y-5">
            <label className="relative block">
              <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder={isAr ? 'ابحث عن قسم...' : 'Search categories…'}
                aria-label={isAr ? 'البحث عن قسم' : 'Search categories'}
                className="w-full h-12 rounded-2xl bg-white border border-slate-200 ps-11 pe-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-extrabold">{isAr ? 'الأقسام الرئيسية' : 'Main categories'}</h3>
              {categories && <span className="text-xs text-slate-500">{list.length} {isAr ? 'قسم' : 'categories'}</span>}
            </div>
            {!categories ? null : list.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
                {search.trim() ? (isAr ? 'مفيش أقسام مطابقة للبحث' : 'No categories match your search') : (isAr ? 'مفيش أقسام متاحة حاليًا' : 'No categories are currently available')}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {list.map(item => {
                  const Icon = categoryIcons[item.id] ?? Store;
                  return (
                    <a
                      key={item.id}
                      href={`/offers/category/${item.id}`}
                      onClick={event => followInternalLink(event, onNavigate)}
                      className="bg-white border border-slate-200 rounded-2xl px-4 py-4 min-h-[100px] flex items-center gap-3 hover:border-emerald-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-emerald-500 transition-all"
                    >
                      <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-extrabold leading-snug">{isAr ? item.ar : item.en}</h4>
                        {published && <p className="text-xs text-slate-500 mt-1">{isAr ? `عروض منشورة: ${item.count}` : `Published ads: ${item.count}`}</p>}
                      </div>
                      <ForwardIcon className="w-4 h-4 text-slate-400 shrink-0" />
                    </a>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
};
