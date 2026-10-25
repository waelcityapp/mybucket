import React, { useState } from 'react';
import { 
  X, 
  ExternalLink, 
  Copy, 
  Check, 
  Tag, 
  Sparkles, 
  ShoppingBag, 
  Coffee, 
  Car, 
  Percent, 
  Utensils, 
  Store,
  ArrowRight,
  ArrowLeft
} from 'lucide-react';
import { PerkDealItem } from '../types/deals';
import { Language } from '../types';

interface DealsModalProps {
  isOpen: boolean;
  onClose: () => void;
  deals: PerkDealItem[];
  lang: Language;
}

export const DealsModal: React.FC<DealsModalProps> = ({
  isOpen,
  onClose,
  deals,
  lang,
}) => {
  const [copiedCodeId, setCopiedCodeId] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  if (!isOpen) return null;

  const handleCopyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCodeId(id);
    setTimeout(() => {
      setCopiedCodeId(null);
    }, 2500);
  };

  const getDealIcon = (iconName: string) => {
    switch (iconName) {
      case 'ShoppingBag':
        return <ShoppingBag className="w-5 h-5 text-white" />;
      case 'Coffee':
        return <Coffee className="w-5 h-5 text-white" />;
      case 'Car':
        return <Car className="w-5 h-5 text-white" />;
      case 'Utensils':
        return <Utensils className="w-5 h-5 text-white" />;
      case 'Percent':
      default:
        return <Percent className="w-5 h-5 text-white" />;
    }
  };

  const categories = Array.from(
    new Set(deals.map((d) => (lang === 'ar' ? d.categoryAr : d.categoryEn)))
  );

  const filteredDeals = selectedCategory === 'all'
    ? deals
    : deals.filter((d) => (lang === 'ar' ? d.categoryAr : d.categoryEn) === selectedCategory);

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-200">
      <div 
        id="deals-modal-container"
        className="bg-white w-full max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-100"
      >
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur-xs flex items-center justify-center shadow-inner">
              <Sparkles className="w-5 h-5 text-amber-100" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black ">
                {lang === 'ar' ? 'عروض وخصومات My Bucket' : 'My Bucket Exclusive Deals'}
              </h2>
              <p className="text-xs text-amber-100 font-medium">
                {lang === 'ar' ? 'وفر فلوسك مع كوبونات وخصومات حصرية لشركائنا' : 'Save money with partner exclusive promo perks'}
              </p>
            </div>
          </div>
          <button
            id="close-deals-modal-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer"
            title={lang === 'ar' ? 'إغلاق' : 'Close'}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Categories Bar */}
        <div className="px-4 py-2.5 bg-slate-50 border-b border-slate-200/60 flex items-center gap-2 overflow-x-auto no-scrollbar">
          <button
            id="filter-deals-all"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors shrink-0 cursor-pointer ${
              selectedCategory === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            {lang === 'ar' ? 'جميع العروض' : 'All Deals'}
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors shrink-0 cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Deals List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-[#F8FAFC]">
          {filteredDeals.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">
              {lang === 'ar' ? 'لا توجد عروض في هذا التصنيف حالياً' : 'No deals in this category right now'}
            </div>
          ) : (
            filteredDeals.map((deal) => {
              const isCopied = copiedCodeId === deal.id;
              return (
                <div
                  key={deal.id}
                  id={`deal-card-${deal.id}`}
                  className="bg-white rounded-2xl p-4 border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow relative overflow-hidden"
                >
                  {deal.featured && (
                    <div className="absolute top-0 end-0 bg-gradient-to-l from-amber-500 to-orange-500 text-white text-[10px] font-black px-2.5 py-0.5 rounded-es-xl shadow-xs">
                      {lang === 'ar' ? 'مميز 🔥' : 'Featured 🔥'}
                    </div>
                  )}

                  <div className="flex items-start gap-3.5">
                    <div className={`w-12 h-12 rounded-2xl ${deal.logoBgColor} flex items-center justify-center shrink-0 shadow-sm`}>
                      {getDealIcon(deal.iconName)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200/60">
                          {lang === 'ar' ? deal.categoryAr : deal.categoryEn}
                        </span>
                      </div>
                      <h3 className="text-sm font-black text-slate-900 mt-1 truncate">
                        {lang === 'ar' ? deal.partnerNameAr : deal.partnerNameEn}
                      </h3>
                      <div className="text-xs font-black text-emerald-600 mt-0.5">
                        {lang === 'ar' ? deal.discountTextAr : deal.discountTextEn}
                      </div>
                      <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                        {lang === 'ar' ? deal.descriptionAr : deal.descriptionEn}
                      </p>
                    </div>
                  </div>

                  {/* Actions (Promo Code + Direct Link) */}
                  <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                    {deal.promoCode ? (
                      <button
                        id={`copy-code-btn-${deal.id}`}
                        onClick={() => handleCopyCode(deal.id, deal.promoCode!)}
                        className={`flex items-center gap-1.5 text-xs font-black px-3 py-1.5 rounded-xl border transition-all cursor-pointer ${
                          isCopied
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                            : 'bg-slate-50 hover:bg-slate-100 border-dashed border-slate-300 text-slate-700'
                        }`}
                        title={lang === 'ar' ? 'اضغط لنسخ الكود' : 'Click to copy code'}
                      >
                        {isCopied ? (
                          <>
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{lang === 'ar' ? 'تم النسخ!' : 'Copied!'}</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3.5 h-3.5 text-slate-400" />
                            <span className=" font-mono">{deal.promoCode}</span>
                          </>
                        )}
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-400 font-semibold">
                        {lang === 'ar' ? 'خصم تلقائي بالرابط' : 'Auto applied discount'}
                      </span>
                    )}

                    <a
                      id={`open-deal-link-${deal.id}`}
                      href={deal.targetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 px-3.5 py-1.5 rounded-xl shadow-xs transition-colors cursor-pointer"
                    >
                      <span>{lang === 'ar' ? 'استفد بالعرض' : 'Claim Deal'}</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="p-3 bg-white border-t border-slate-100 text-center text-[11px] text-slate-400 font-medium">
          {lang === 'ar' 
            ? 'تُحدث هذه العروض باستمرار بالشراكة مع نخبة المتاجر والعلامات التجارية'
            : 'Exclusive offers updated regularly in partnership with leading brands'}
        </div>
      </div>
    </div>
  );
};
