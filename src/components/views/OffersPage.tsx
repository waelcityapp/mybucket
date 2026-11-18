import React, { useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Search, Plus, Landmark, UtensilsCrossed, ShoppingBasket,
  Shirt, Plane, Dumbbell, Car, HeartPulse, House, GraduationCap,
  Gift, Smartphone, Store, Play, type LucideIcon
} from 'lucide-react';
import { Language } from '../../types';
import { DEMO_ADS } from '../../data/demoAds';

interface OffersPageProps {
  lang: Language;
  onBack: () => void;
  categorySlug?: string | null;
  onOpenCategory: (slug: string) => void;
  onAddAd: () => void;
}

interface OfferCategory {
  slug: string;
  ar: string;
  en: string;
  Icon: LucideIcon;
}

const CATEGORIES: OfferCategory[] = [
  { slug: 'banks-finance', ar: 'البنوك والمؤسسات المالية', en: 'Banks & Financial Services', Icon: Landmark },
  { slug: 'restaurants-cafes-outings', ar: 'المطاعم والكافيهات والخروجات', en: 'Restaurants, Cafes & Outings', Icon: UtensilsCrossed },
  { slug: 'food-beverages', ar: 'الأطعمة والمشروبات', en: 'Food & Beverages', Icon: ShoppingBasket },
  { slug: 'fashion', ar: 'الملابس والأحذية والإكسسوارات', en: 'Fashion & Accessories', Icon: Shirt },
  { slug: 'travel-events', ar: 'الرحلات والفعاليات', en: 'Travel & Events', Icon: Plane },
  { slug: 'sports-fitness', ar: 'الجيم والرياضة', en: 'Sports & Fitness', Icon: Dumbbell },
  { slug: 'cars-transport', ar: 'السيارات والمواصلات', en: 'Cars & Transport', Icon: Car },
  { slug: 'health-beauty', ar: 'الصحة والجمال', en: 'Health & Beauty', Icon: HeartPulse },
  { slug: 'home-shopping', ar: 'المنزل والتسوق', en: 'Home & Shopping', Icon: House },
  { slug: 'education-services', ar: 'التعليم والخدمات', en: 'Education & Services', Icon: GraduationCap },
  { slug: 'technology', ar: 'الإلكترونيات والتكنولوجيا', en: 'Electronics & Technology', Icon: Smartphone },
];


export const OffersPage: React.FC<OffersPageProps> = ({ lang, onBack, categorySlug, onOpenCategory, onAddAd }) => {
  const isAr = lang === 'ar';
  const BackIcon = isAr ? ArrowRight : ArrowLeft;
  const ForwardIcon = isAr ? ArrowLeft : ArrowRight;
  const [search, setSearch] = useState('');
  const category = CATEGORIES.find(item => item.slug === categorySlug);
  const list = useMemo(() => CATEGORIES.filter(item =>
    `${item.ar} ${item.en}`.toLowerCase().includes(search.trim().toLowerCase())
  ), [search]);

  const categoryCount = (slug: string) => DEMO_ADS.filter(offer => offer.categorySlug === slug).length;
  const title = category ? (isAr ? category.ar : category.en) : (isAr ? 'وفّر مع My Bucket' : 'Save with My Bucket');

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
          {!categorySlug && (
            <button type="button" onClick={onAddAd}
              aria-label={isAr ? 'إضافة إعلان جديد' : 'Add new advertisement'}
              title={isAr ? 'إضافة إعلان جديد' : 'Add new advertisement'}
              className="h-12 w-12 sm:h-14 sm:w-14 shrink-0 rounded-2xl bg-emerald-600 text-white shadow-md hover:bg-emerald-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 flex items-center justify-center transition-colors">
              <Plus className="h-7 w-7 sm:h-8 sm:w-8" strokeWidth={3} />
            </button>
          )}
        </div>
      </header>

      <main className={`mx-auto px-4 py-6 pb-16 ${categorySlug ? "max-w-7xl" : "max-w-xl"}`}>
        {categorySlug ? (
          <section className="space-y-4">
            {category ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{isAr ? 'إعلانات القسم التجريبية' : 'Demo ads in this category'}</p>
                  <span className="rounded-full bg-emerald-50 border border-emerald-100 text-emerald-800 text-xs font-bold px-3 py-1.5">
                    {isAr ? `${categoryCount(category.slug)} إعلان` : `${categoryCount(category.slug)} offers`}
                  </span>
                </div>
                {categoryCount(category.slug) > 0 ? (
                  <div className="space-y-4">
                    <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-sm font-semibold text-amber-900">{isAr ? 'الإعلانات دي أمثلة تجريبية، والعروض وأسماء المعلنين غير حقيقية.' : 'These are demonstration ads; the offers and advertisers are fictional.'}</p>
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {DEMO_ADS.filter(ad => ad.categorySlug === category.slug).map(ad => {
                        const [adTitle, description, merchant] = isAr ? ad.ar : ad.en;
                        const hasVideo = 'video' in ad;
                        return (
                          <article key={ad.id} className="relative flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                            {'image' in ad && <img src={`/demo-ads/${ad.image}`} alt="" loading="lazy" className="aspect-video w-full bg-slate-100 object-cover dark:bg-slate-800" />}
                            {hasVideo && <a href={`/offers/ad/${ad.id}`}
                              aria-label={`${isAr ? 'شوف الفيديو' : 'View video'} · ${adTitle}`}
                              className="relative block aspect-video bg-emerald-950 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-white">
                              <img src={`/demo-ads/${ad.poster}`} alt="" loading="lazy" className="h-full w-full object-cover" />
                              <span className="absolute inset-0 grid place-items-center" aria-hidden="true">
                                <span className="grid size-12 place-items-center rounded-full bg-black/70 text-white">
                                  <Play className="size-5 fill-current" />
                                </span>
                              </span>
                            </a>}
                            <span className={`w-fit rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-900 ${'image' in ad || hasVideo ? 'absolute start-3 top-3' : 'ms-3 mt-3'}`}>
                              {isAr ? 'إعلان تجريبي' : 'Demo ad'}
                            </span>
                            <div className="flex flex-1 flex-col gap-2 p-3.5">
                              <h2 className="break-words text-lg font-extrabold leading-snug">{adTitle}</h2>
                              <p className="line-clamp-2 break-words text-sm text-slate-600 dark:text-slate-300">{description}</p>
                              <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 pt-1">
                                <span className="flex min-w-0 items-center gap-1.5 break-words text-sm font-semibold">
                                  <Store className="size-4 shrink-0 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />{merchant}
                                </span>
                                <a href={`/offers/ad/${ad.id}`} aria-label={`${isAr ? 'شوف العرض' : 'View offer'} · ${adTitle}`}
                                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-50 px-3 text-sm font-bold text-emerald-900 hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:bg-emerald-950 dark:text-emerald-200 dark:hover:bg-emerald-900">
                                  {isAr ? 'شوف العرض' : 'View offer'} <ForwardIcon className="size-4" aria-hidden="true" />
                                </a>
                              </div>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ) : <div className="bg-white border border-slate-200 rounded-2xl p-9 text-center">
                  <Gift className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <h2 className="text-base font-bold">{isAr ? 'لا توجد عروض منشورة في هذا القسم حاليًا' : 'No published offers in this category yet'}</h2>
                  <p className="text-sm text-slate-500 mt-2">{isAr ? 'عند إضافة عروض حقيقية، هتظهر هنا.' : 'Published offers will appear here once available.'}</p>
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
                placeholder={isAr ? 'ابحث عن عرض أو فرصة توفير...' : 'Search offers or savings opportunities...'}
                aria-label={isAr ? 'البحث عن عروض وفرص توفير' : 'Search offers and savings opportunities'}
                className="w-full h-12 rounded-2xl bg-white border border-slate-200 ps-11 pe-4 text-sm outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
              />
            </label>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-sm font-extrabold">{isAr ? 'الأقسام الرئيسية' : 'Main categories'}</h3>
              <span className="text-xs text-slate-500">{list.length} {isAr ? 'قسم' : 'categories'}</span>
            </div>
            {list.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
                {isAr ? 'مفيش أقسام مطابقة للبحث' : 'No categories match your search'}
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {list.map(item => {
                  const Icon = item.Icon;
                  return (
                    <a
                      key={item.slug}
                      href={`/offers/category/${item.slug}`}
                      onClick={event => { if (event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onOpenCategory(item.slug); } }}
                      className="bg-white border border-slate-200 rounded-2xl px-4 py-4 min-h-[100px] flex items-center gap-3 hover:border-emerald-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-emerald-500 transition-all"
                    >
                      <div className="w-11 h-11 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-extrabold leading-snug">{isAr ? item.ar : item.en}</h4>
                        <p className="text-xs text-slate-500 mt-1">{isAr ? `إعلانات تجريبية: ${categoryCount(item.slug)}` : `Demo ads: ${categoryCount(item.slug)}`}</p>
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
