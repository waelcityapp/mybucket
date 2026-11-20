import { Heart, Share2, ThumbsUp } from 'lucide-react';
import { useState } from 'react';
import type { OfferEngagement, OfferReaction, OfferReactionState } from '../data/offerAds';

export function OfferCardActions({ id, title, isAr, state, engagement, onReact }: {
  id: string;
  title: string;
  isAr: boolean;
  state?: OfferReactionState;
  engagement?: OfferEngagement;
  onReact: (reaction: OfferReaction) => Promise<void>;
}) {
  const [pending, setPending] = useState(false);
  const [reactionError, setReactionError] = useState(false);
  async function react(reaction: OfferReaction) {
    setPending(true);
    setReactionError(false);
    try {
      await onReact(reaction);
    } catch {
      setReactionError(true);
    } finally {
      setPending(false);
    }
  }
  const number = (count: number | undefined) => count?.toLocaleString(isAr ? 'ar-EG' : 'en') ?? '—';
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
      <button type="button" className={buttonClass} disabled={pending} aria-pressed={state?.liked ?? false} onClick={() => void react('liked')}>
        <ThumbsUp aria-hidden="true" className={`size-4 ${state?.liked ? 'fill-current text-emerald-700 dark:text-emerald-400' : ''}`} />
        {isAr ? 'إعجاب' : 'Like'} <span>{number(engagement?.likeCount)}</span>
      </button>
      <button type="button" className={buttonClass} disabled={pending} aria-pressed={state?.saved ?? false} onClick={() => void react('saved')}>
        <Heart aria-hidden="true" className={`size-4 ${state?.saved ? 'fill-current text-rose-600 dark:text-rose-400' : ''}`} />
        {isAr ? 'المفضلة' : 'Favorite'} <span>{number(engagement?.favoriteCount)}</span>
      </button>
      <button type="button" className={buttonClass} onClick={() => void share()}>
        <Share2 aria-hidden="true" className="size-4" />
        {isAr ? 'مشاركة' : 'Share'}
      </button>
      {reactionError && <p role="alert" className="w-full px-2 pb-2 text-xs">{isAr ? 'تعذّر حفظ التفاعل. حاول تاني.' : 'Could not save the reaction. Try again.'}</p>}
      {shareMessage && <p role="status" className="w-full select-text break-all px-2 pb-2 text-xs">{shareMessage}</p>}
    </div>
  );
}
