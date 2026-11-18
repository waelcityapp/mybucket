import type { Language } from '../types';
import { AdVideoPlayer } from './AdVideoPlayer';

type Props = {
  lang: Language;
  title: string;
  description: string;
  merchant: string;
  contact?: string;
  mediaUrl?: string | null;
  poster?: string;
  mediaType?: 'image' | 'video';
  videoQuotaId?: string;
};

/** One creative presentation for advertiser, reviewer and future public displays. */
export function AdCreativeCard({ lang, title, description, merchant, contact, mediaUrl, poster, mediaType, videoQuotaId }: Props) {
  const ar = lang === 'ar';
  return <article dir={ar ? 'rtl' : 'ltr'} className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
    {mediaUrl && (mediaType === 'video'
      ? <AdVideoPlayer src={mediaUrl} poster={poster} adId={videoQuotaId} lang={lang} label={ar ? 'فيديو الإعلان' : 'Advertisement video'} className="w-full max-h-56 object-contain bg-slate-50" />
      : <img src={mediaUrl} alt={ar ? 'صورة الإعلان' : 'Advertisement image'} className="w-full max-h-56 object-contain bg-slate-50" />)}
    <div className="p-4 space-y-3">
      <p className="break-words text-sm font-semibold text-slate-700">{ar ? 'المعلن:' : 'Advertiser:'} {merchant}</p>
      <h3 className="text-lg font-extrabold break-words">{title}</h3>
      <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{description}</p>
      {contact && <p className="text-xs text-slate-600 break-all">{ar ? 'وسيلة التواصل:' : 'Contact:'} {contact}</p>}
    </div>
  </article>;
}
