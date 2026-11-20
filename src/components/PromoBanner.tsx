import { ArrowUpRight } from 'lucide-react';
import type { PromoBannerData } from '../types/deals';
import type { Language } from '../types';

interface PromoBannerProps {
  banner: PromoBannerData;
  lang: Language;
}

export function PromoBanner({ banner, lang }: PromoBannerProps) {
  if (!banner.isActive) return null;

  const ar = lang === 'ar';
  const title = ar ? banner.titleAr : banner.titleEn;
  const subtitle = ar ? banner.subtitleAr : banner.subtitleEn;
  const badge = ar ? banner.badgeAr : banner.badgeEn;

  return (
    <div id="sponsored-advertiser-banner" className="my-4">
      <a
        id="sponsored-advertiser-link"
        href={banner.targetUrl}
        className="group grid min-h-32 grid-cols-[1fr_28%] overflow-hidden rounded-2xl border border-fuchsia-300/20 bg-gradient-to-br from-[#311034] to-[#180c27] text-white shadow-sm transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-fuchsia-600 sm:grid-cols-[1fr_34%]"
      >
        <div className="min-w-0 space-y-2 p-3.5 sm:p-5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h2 className="text-lg font-black tracking-wide sm:text-xl"><bdi>{title}</bdi></h2>
            {badge && <span className="rounded-full border border-white/20 px-2 py-0.5 text-[10px] font-bold text-fuchsia-100">{badge}</span>}
          </div>
          <p className="text-xs leading-relaxed text-fuchsia-100 sm:text-sm">{subtitle}</p>
          <span className="inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-amber-200 px-3 text-xs font-extrabold text-[#301332] transition-colors group-hover:bg-amber-100">
            {ar ? banner.ctaTextAr : banner.ctaTextEn}
            <ArrowUpRight className="size-4 shrink-0" aria-hidden="true" />
          </span>
        </div>
        {banner.imageUrl && (
          <div className="relative min-w-0 overflow-hidden bg-[#46183f]">
            <img src={banner.imageUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover transition-transform group-hover:scale-105 motion-reduce:transition-none" />
          </div>
        )}
      </a>
    </div>
  );
}
