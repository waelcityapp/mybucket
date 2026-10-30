import React, { useMemo, useState } from 'react';
import {
  ArrowLeft, ArrowRight, Search, Landmark, UtensilsCrossed, ShoppingBasket,
  Shirt, Plane, Dumbbell, Car, HeartPulse, House, GraduationCap,
  Gift, Smartphone, BadgePercent, type LucideIcon
} from 'lucide-react';
import { Language } from '../../types';

interface OffersPageProps {
  lang: Language;
  onBack: () => void;
  categorySlug?: string | null;
  onOpenCategory: (slug: string) => void;
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

// Public category directory only. Counts MUST be derived from actual published,
// active, non-expired merchant offers once the real offers data source exists.
// Do not use INITIAL_PERK_DEALS: its coupons are demonstration-only.
const PUBLISHED_OFFERS: ReadonlyArray<{ id: string; categorySlug: string; titleAr: string; titleEn: string }> = [];

export const OffersPage: React.FC<OffersPageProps> = ({ lang, onBack, categorySlug, onOpenCategory }) => {
  const isAr = lang === 'ar';
  const BackIcon = isAr ? ArrowRight : ArrowLeft;
  const ForwardIcon = isAr ? ArrowLeft : ArrowRight;
  const [search, setSearch] = useState('');
  const category = CATEGORIES.find(item => item.slug === categorySlug);
  const list = useMemo(() => CATEGORIES.filter(item =>
    `${item.ar} ${item.en}`.toLowerCase().includes(search.trim().toLowerCase())
  ), [search]);

  const categoryCount = (slug: string) => PUBLISHED_OFFERS.filter(offer => offer.categorySlug === slug).length;
  const title = category ? (isAr ? category.ar : category.en) : (isAr ? 'العروض والخصومات' : 'Offers & Discounts');

  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center gap-3">
          <button type="button" onClick={onBack} aria-label={isAr ? 'رجوع' : 'Back'}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700 shrink-0">
            <BackIcon className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-extrabold leading-snug">{title}</h1>
            <p className="text-xs text-slate-500">My Bucket</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
            <BadgePercent className="w-5 h-5" />
          </div>
        </div>
      </header>

      <main className="max-w-xl mx-auto px-4 py-6 pb-16">
        {categorySlug ? (
          <section className="space-y-4">
            {category ? (
              <>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-700">{isAr ? 'عروض القسم' : 'Category offers'}</p>
                  <span className="rounded-full bg-amber-50 border border-amber-100 text-amber-800 text-xs font-bold px-3 py-1.5">
                    {isAr ? `${categoryCount(category.slug)} إعلان` : `${categoryCount(category.slug)} offers`}
                  </span>
                </div>
                <div className="bg-white border border-slate-200 rounded-2xl p-9 text-center">
                  <Gift className="w-10 h-10 text-slate-300 mx-auto mb-3" />
                  <h2 className="text-base font-bold">{isAr ? 'لا توجد عروض منشورة في هذا القسم حاليًا' : 'No published offers in this category yet'}</h2>
                  <p className="text-sm text-slate-500 mt-2">{isAr ? 'عند إضافة عروض حقيقية، هتظهر هنا.' : 'Published offers will appear here once available.'}</p>
                </div>
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
            <div className="space-y-2">
              <h2 className="text-xl font-black">{isAr ? 'اكتشف العروض والخصومات' : 'Discover offers & discounts'}</h2>
              <p className="text-sm text-slate-500">{isAr ? 'اختار المجال اللي يهمك أو ابحث عن قسم' : 'Choose a category or search categories'}</p>
            </div>
            <label className="relative block">
              <Search className="absolute start-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder={isAr ? 'ابحث في أقسام العروض...' : 'Search offer categories...'}
                aria-label={isAr ? 'بحث عن قسم عروض' : 'Search offer categories'}
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
                      className="bg-white border border-slate-200 rounded-2xl px-4 py-4 min-h-[100px] flex items-center gap-3 hover:border-amber-300 hover:shadow-sm focus-visible:outline-2 focus-visible:outline-amber-500 transition-all"
                    >
                      <div className="w-11 h-11 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-extrabold leading-snug">{isAr ? item.ar : item.en}</h4>
                        <p className="text-xs text-slate-500 mt-1">{isAr ? `عدد الإعلانات: ${categoryCount(item.slug)}` : `Offers: ${categoryCount(item.slug)}`}</p>
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
