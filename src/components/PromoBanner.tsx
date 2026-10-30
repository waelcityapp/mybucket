import React from 'react';
import { ExternalLink, Tag } from 'lucide-react';
import { PromoBannerData } from '../types/deals';
import { Language } from '../types';

interface PromoBannerProps {
  banner: PromoBannerData;
  lang: Language;
}

export const PromoBanner: React.FC<PromoBannerProps> = ({
  banner,
  lang,
}) => {
  if (!banner.isActive) return null;

  const title = lang === 'ar' ? banner.titleAr : banner.titleEn;
  const subtitle = lang === 'ar' ? banner.subtitleAr : banner.subtitleEn;
  const badge = lang === 'ar' ? banner.badgeAr : banner.badgeEn;
  const ctaText = lang === 'ar' ? banner.ctaTextAr : banner.ctaTextEn;

  return (
    <div className="w-full mt-4 mb-2">
      {/* Primary Advertiser Sponsored Banner */}
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
