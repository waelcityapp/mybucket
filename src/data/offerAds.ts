import type { AdContactDetails } from '../utils/adContent';
import type { LegacyAdTransfer } from '../utils/adCheckout';

export const OFFER_CATEGORY_IDS = [
  'banks-finance', 'restaurants-cafes-outings', 'food-beverages', 'fashion',
  'travel-events', 'sports-fitness', 'cars-transport', 'health-beauty',
  'home-shopping', 'education-services', 'technology',
] as const;

export type OfferTier = 'free' | 'featured' | 'vip';

export const DEFAULT_FREE_OFFER_POLICY = { freeDurationDays: 7, freeIntervalDays: 14 };

export type FreeOfferPolicy = typeof DEFAULT_FREE_OFFER_POLICY;
export type FreeOfferEligibility =
  | ({ status: 'available' | 'pending' | 'active' } & FreeOfferPolicy)
  | ({ status: 'interval'; availableAt: number } & FreeOfferPolicy);

export function supportsOfferFavorites(tier?: OfferTier) {
  return tier === 'featured' || tier === 'vip';
}

export type OfferAdStatus = 'pending' | 'approved' | 'rejected';

export type OfferEngagement = { likeCount: number; favoriteCount: number };
export type OfferReaction = 'liked' | 'saved';
export type OfferReactionState = { liked: boolean; saved: boolean };

export type PublicOfferAd = AdContactDetails & {
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
  requiresVideoCorrection?: boolean;
  legacyTransfer?: LegacyAdTransfer;
  confirmedTransfer?: Omit<LegacyAdTransfer, 'transferredAt'> & { transferredAt?: number };
  payment?: { amountEgp: number; dailyPriceEgp?: number; phone: string; receiptUrl?: string };
};

export type MyOfferAd = Pick<ReviewOfferAd, 'id' | 'title' | 'merchant' | 'tier' | 'status' | 'submittedAt' | 'startsAt' | 'endsAt' | 'rejectionReason' | 'requiresVideoCorrection'> & { deleteAfter: number | null; thumbnailUrl?: string };
