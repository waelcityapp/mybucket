import React from 'react';
import { ArrowLeft, ArrowRight, Gift, Tag } from 'lucide-react';
import { Language } from '../../types';

interface OffersPageProps {
  lang: Language;
  onBack: () => void;
}

// Public landing page: real merchant offers will be connected later.
// Never present the demonstration coupons as genuine partner promotions.
export const OffersPage: React.FC<OffersPageProps> = ({ lang, onBack }) => {
  const isAr = lang === 'ar';
  const BackIcon = isAr ? ArrowRight : ArrowLeft;
  return (
    <div dir={isAr ? 'rtl' : 'ltr'} className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center gap-3">
          <button type="button" onClick={onBack} aria-label={isAr ? 'رجوع' : 'Back'}
            className="w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-700">
            <BackIcon className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-extrabold">{isAr ? 'العروض والخصومات' : 'Offers & Discounts'}</h1>
            <p className="text-xs text-slate-500">My Bucket</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
            <Tag className="w-5 h-5" />
          </div>
        </div>
      </header>
      <main className="max-w-xl mx-auto px-4 py-12">
        <div className="bg-white border border-slate-200 rounded-3xl p-8 sm:p-12 text-center shadow-sm flex flex-col items-center gap-3">
          <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
            <Gift className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-extrabold">{isAr ? 'العروض قريبًا' : 'Offers coming soon'}</h2>
          <p className="text-sm text-slate-500 leading-relaxed max-w-sm">
            {isAr
              ? 'بنجهز لك صفحة العروض والخصومات. هتظهر العروض الحقيقية هنا بمجرد إضافتها.'
              : 'We are preparing offers and discounts. Verified, published offers will appear here when available.'}
          </p>
        </div>
      </main>
    </div>
  );
};
