export const OFFER_CATEGORY_IDS = [
  'banks-finance', 'restaurants-cafes-outings', 'food-beverages', 'fashion',
  'travel-events', 'sports-fitness', 'cars-transport', 'health-beauty',
  'home-shopping', 'education-services', 'technology',
] as const;

export type OfferAdStatus = 'pending' | 'approved' | 'rejected';

export type PublicOfferAd = {
  id: string;
  categorySlug: string;
  title: string;
  description: string;
  merchant: string;
  contact: string;
  startsAt: number;
  endsAt: number;
  media?: { type: 'image' | 'video'; url: string; poster?: string };
};

export type ReviewOfferAd = PublicOfferAd & {
  status: OfferAdStatus;
  submittedAt: number;
  rejectionReason: string;
  payment?: { amountEgp: number; phone: string; receiptUrl?: string };
};

export type MyOfferAd = Pick<ReviewOfferAd, 'id' | 'title' | 'merchant' | 'status' | 'submittedAt' | 'startsAt' | 'endsAt' | 'rejectionReason'> & { deleteAfter: number | null };
