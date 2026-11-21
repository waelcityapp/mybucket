export const OFFER_CATEGORY_IDS = [
  'banks-finance', 'restaurants-cafes-outings', 'food-beverages', 'fashion',
  'travel-events', 'sports-fitness', 'cars-transport', 'health-beauty',
  'home-shopping', 'education-services', 'technology',
] as const;

export type OfferTier = 'free' | 'featured' | 'vip';

export type OfferAdStatus = 'pending' | 'approved' | 'rejected';

export type OfferEngagement = { likeCount: number; favoriteCount: number };
export type OfferReaction = 'liked' | 'saved';
export type OfferReactionState = { liked: boolean; saved: boolean };

export type PublicOfferAd = {
  engagement?: OfferEngagement;
  id: string;
  categorySlug: string;
  tier?: OfferTier;
  title: string;
  description: string;
  merchant: string;
  contact: string;
  startsAt: number;
  endsAt: number;
  media?: { type: 'image' | 'video'; url: string; poster?: string };
};

export type ReviewOfferAd = PublicOfferAd & {
  status: OfferAdStatus | 'deleting';
  submittedAt: number;
  rejectionReason: string;
  payment?: { amountEgp: number; phone: string; receiptUrl?: string };
};

export type MyOfferAd = Pick<ReviewOfferAd, 'id' | 'title' | 'merchant' | 'tier' | 'status' | 'submittedAt' | 'startsAt' | 'endsAt' | 'rejectionReason'> & { deleteAfter: number | null };
