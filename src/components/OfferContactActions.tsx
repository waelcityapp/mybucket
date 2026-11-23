import { MapPin, MessageCircle, Phone } from 'lucide-react';
import type { Language } from '../types';
import { type AdContactDetails, normalizeAdPhone, normalizeGoogleMapsUrl } from '../utils/adContent';

export function OfferContactActions({ details, lang }: { details: AdContactDetails; lang: Language }) {
  const ar = lang === 'ar';
  const call = details.callPhone && normalizeAdPhone(details.callPhone);
  const whatsapp = details.whatsappPhone && normalizeAdPhone(details.whatsappPhone, true);
  const maps = details.mapsUrl && normalizeGoogleMapsUrl(details.mapsUrl);
  if (!call && !whatsapp && !maps) return null;
  const action = 'inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-emerald-200 px-3 text-xs font-bold text-emerald-900 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:border-emerald-800 dark:text-emerald-200 dark:hover:bg-emerald-950';
  return <div className="flex flex-wrap gap-2">
    {call && <a href={`tel:${call}`} className={action}><Phone className="size-4" aria-hidden="true" />{ar ? 'اتصال' : 'Call'}</a>}
    {whatsapp && <a href={`https://wa.me/${whatsapp.slice(1)}`} target="_blank" rel="noopener noreferrer" className={action}>
      <MessageCircle className="size-4" aria-hidden="true" />{ar ? 'واتساب' : 'WhatsApp'}
    </a>}
    {maps && <a href={maps} target="_blank" rel="noopener noreferrer" className={action}>
      <MapPin className="size-4" aria-hidden="true" />{ar ? 'استخدم الخريطة' : 'Open map'}
    </a>}
  </div>;
}
