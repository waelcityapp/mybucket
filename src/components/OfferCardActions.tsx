import { Bookmark, Heart, Share2 } from 'lucide-react';
import { useState } from 'react';

export function readOfferPreference(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function saveOfferPreference(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    // The controls remain usable in memory when browser storage is unavailable.
  }
}

export function OfferCardActions({ id, title, isAr, saved, onToggleSaved }: {
  id: string;
  title: string;
  isAr: boolean;
  saved: boolean;
  onToggleSaved: () => void;
}) {
  const likeKey = `offer-like:${id}`;
  const [liked, setLiked] = useState(() => readOfferPreference(likeKey) === '1');
  const [shareMessage, setShareMessage] = useState('');
  const buttonClass = 'inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-600 dark:hover:bg-slate-800';

  async function share() {
    const url = new URL(`/offers/ad/${encodeURIComponent(id)}`, window.location.origin).href;
    setShareMessage('');
    try {
      if (navigator.share) {
        await navigator.share({ title, url });
        return;
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShareMessage(isAr ? 'اتنسخ رابط الإعلان' : 'Ad link copied');
    } catch {
      setShareMessage(url);
    }
  }

  return (
    <div className="flex flex-wrap gap-x-1 border-t border-slate-100 pt-1 text-slate-700 dark:border-slate-800 dark:text-slate-200">
      <button type="button" className={buttonClass} aria-pressed={liked} onClick={() => {
        saveOfferPreference(likeKey, liked ? '0' : '1');
        setLiked(!liked);
      }}>
        <Heart aria-hidden="true" className={`size-4 ${liked ? 'fill-current text-rose-600 dark:text-rose-400' : ''}`} />
        {isAr ? 'إعجاب' : 'Like'}
      </button>
      <button type="button" className={buttonClass} aria-pressed={saved} onClick={onToggleSaved}>
        <Bookmark aria-hidden="true" className={`size-4 ${saved ? 'fill-current text-emerald-700 dark:text-emerald-400' : ''}`} />
        {isAr ? 'المفضلة' : 'Favorite'}
      </button>
      <button type="button" className={buttonClass} onClick={() => void share()}>
        <Share2 aria-hidden="true" className="size-4" />
        {isAr ? 'مشاركة' : 'Share'}
      </button>
      {shareMessage && <p role="status" className="w-full select-text break-all px-2 pb-2 text-xs">{shareMessage}</p>}
    </div>
  );
}
