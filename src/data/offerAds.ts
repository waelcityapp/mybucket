import type { AdContactDetails } from '../utils/adContent';
import type { LegacyAdTransfer } from '../utils/adCheckout';

export const OFFER_CATEGORY_LABELS = [
  { id: 'banks-finance', ar: 'البنوك والمؤسسات المالية', en: 'Banks & Financial Services' },
  { id: 'restaurants-cafes-outings', ar: 'المطاعم والكافيهات والخروجات', en: 'Restaurants, Cafes & Outings' },
  { id: 'food-beverages', ar: 'الأطعمة والمشروبات', en: 'Food & Beverages' },
  { id: 'fashion', ar: 'الملابس والأحذية والإكسسوارات', en: 'Fashion & Accessories' },
  { id: 'travel-events', ar: 'الرحلات والفعاليات', en: 'Travel & Events' },
  { id: 'sports-fitness', ar: 'الجيم والرياضة', en: 'Sports & Fitness' },
  { id: 'cars-transport', ar: 'السيارات والمواصلات', en: 'Cars & Transport' },
  { id: 'health-beauty', ar: 'الصحة والجمال', en: 'Health & Beauty' },
  { id: 'home-shopping', ar: 'المنزل والتسوق', en: 'Home & Shopping' },
  { id: 'education-services', ar: 'التعليم والخدمات', en: 'Education & Services' },
  { id: 'technology', ar: 'الإلكترونيات والتكنولوجيا', en: 'Electronics & Technology' },
] as const;

export const OFFER_CATEGORY_IDS = OFFER_CATEGORY_LABELS.map(category => category.id);

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
  vipDurationDays?: number;
  startsAt: number;
  endsAt: number;
  media?: { type: 'image' | 'video'; url: string; poster?: string };
};

export type VipPushCampaign = {
  status: 'queued' | 'sending' | 'completed' | 'completed_with_failures' | 'stopped';
  scannedCount: number;
  failedCount: number;
};

export type ReviewOfferAd = PublicOfferAd & {
  status: OfferAdStatus | 'deleting';
  submittedAt: number;
  rejectionReason: string;
  requiresVideoCorrection?: boolean;
  vipPushCampaign?: VipPushCampaign;
  formerVipSchedule?: { startsAt: number; endsAt: number };
  legacyTransfer?: LegacyAdTransfer;
  confirmedTransfer?: Omit<LegacyAdTransfer, 'transferredAt'> & { transferredAt?: number };
  payment?: { amountEgp: number; dailyPriceEgp?: number; phone: string; receiptUrl?: string };
};

export const OFFER_EDIT_REQUEST_LIMIT = 2;

export type OfferAdEditReview = {
  original: PublicOfferAd;
  proposed: PublicOfferAd;
  requestId: string;
  submittedAt: number;
};

export type MyOfferAd = Pick<ReviewOfferAd, 'id' | 'title' | 'merchant' | 'tier' | 'status' | 'submittedAt' | 'startsAt' | 'endsAt' | 'rejectionReason' | 'requiresVideoCorrection'> & { deleteAfter: number | null; thumbnailUrl?: string; editRequestsUsed?: number;
  editRequestStatus?: 'pending' | 'approved' | 'rejected';
  editRejectionReason?: string };

export type OfferCategorySettings = { id: string; ar: string; en: string; archived?: boolean };

export function rankOfferCategories(categories: readonly OfferCategorySettings[], ads: readonly PublicOfferAd[], lang: 'ar' | 'en') {
  const activity = new Map<string, { count: number; latest: number }>();
  for (const ad of ads) {
    const previous = activity.get(ad.categorySlug);
    activity.set(ad.categorySlug, { count: (previous?.count ?? 0) + 1, latest: Math.max(previous?.latest ?? 0, ad.startsAt) });
  }
  const empty = { count: 0, latest: 0 };
  const alphabet = new Intl.Collator(lang);
  return categories.filter(category => !category.archived || activity.has(category.id)).map(category =>
    ({ ...category, ...(activity.get(category.id) ?? empty) }))
    .sort((a, b) => b.count - a.count || b.latest - a.latest || alphabet.compare(a[lang], b[lang]) || a.id.localeCompare(b.id));
}
