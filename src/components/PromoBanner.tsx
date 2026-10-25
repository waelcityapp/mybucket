import React from 'react';
import { ExternalLink, Tag, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { PromoBannerData } from '../types/deals';
import { Language } from '../types';

interface PromoBannerProps {
  banner: PromoBannerData;
  lang: Language;
  onOpenDeals: () => void;
}

export const PromoBanner: React.FC<PromoBannerProps> = ({
  banner,
  lang,
  onOpenDeals,
}) => {
  if (!banner.isActive) return null;

  const title = lang === 'ar' ? banner.titleAr : banner.titleEn;
  const subtitle = lang === 'ar' ? banner.subtitleAr : banner.subtitleEn;
  const badge = lang === 'ar' ? banner.badgeAr : banner.badgeEn;
  const ctaText = lang === 'ar' ? banner.ctaTextAr : banner.ctaTextEn;

  return (
    <div className="w-full mt-4 mb-2">
      {/* 1. Quick Deals & Perks Shortcut Button */}
      <button
        id="open-exclusive-deals-bar"
        onClick={onOpenDeals}
        className="w-full mb-2.5 p-3 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-white shadow-sm hover:shadow-md transition-all flex items-center justify-between group cursor-pointer border border-amber-400/40"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
            <Sparkles className="w-4 h-4 text-white animate-pulse" />
          </div>
          <div className="text-start">
            <div className="text-xs font-black  flex items-center gap-1.5">
              <span>{lang === 'ar' ? 'عروض وخصومات مستخدمي My Bucket' : 'My Bucket Exclusive Deals'}</span>
              <span className="bg-white/25 text-[10px] font-black px-1.5 py-0.2 rounded-full">
                {lang === 'ar' ? 'خصومات تصل 40%' : 'Up to 40% Off'}
              </span>
            </div>
            <p className="text-[11px] text-amber-100 font-medium">
              {lang === 'ar' ? 'اضغط هنا للاستفادة بكوبونات حصرية لشركائنا' : 'Click to discover exclusive partner discount codes'}
            </p>
          </div>
        </div>
        <div className="w-7 h-7 rounded-xl bg-white/20 flex items-center justify-center group-hover:bg-white/30 transition-colors shrink-0">
          {lang === 'ar' ? (
            <ChevronLeft className="w-4 h-4 text-white" />
          ) : (
            <ChevronRight className="w-4 h-4 text-white" />
          )}
        </div>
      </button>

      {/* 2. Primary Advertiser Sponsored Banner */}
      <div 
        id="sponsored-advertiser-banner"
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border border-slate-700/60 p-3.5 sm:p-4 text-white shadow-sm"
      >
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 text-amber-400">
              <Tag className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {badge && (
                  <span className="text-[9px] font-black  uppercase bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded-md">
                    {badge}
                  </span>
                )}
                <h4 className="text-xs sm:text-sm font-black text-slate-100 truncate">
                  {title}
                </h4>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5 line-clamp-1">
                {subtitle}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <a
              id="sponsored-advertiser-link"
              href={banner.targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto text-center flex items-center justify-center gap-1.5 text-xs font-bold text-slate-900 bg-amber-400 hover:bg-amber-300 px-3.5 py-1.5 rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <span>{ctaText}</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};
