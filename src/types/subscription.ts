export type SubscriptionStatus = 'trial' | 'paid' | 'expired';

export interface UserSubscription {
  status: SubscriptionStatus;
  trialStartedAt: string;
  trialExpiresAt: string;
  totalTrialDays: number;
  affiliateCode: string | null;
  affiliateAppliedAt: string | null;
  hasAppliedAffiliateCode: boolean;
  isPaid: boolean;
  paidExpiresAt: string | null;
  monthlyPriceEgp: number | null;
  dailyAiEntryLimit: number;
  dailyAiInquiryLimit: number;
  maxHistoricalQueryDays: number;
  createdAt: string;
  updatedAt: string;
}

export interface AffiliateCodeRecord {
  code: string;
  active: boolean;
  totalTrialDays: number;
  monthlyPriceEgp: number | null;
  maxRedemptions: number | null;
  redemptionCount: number;
  validFrom: string | null;
  validUntil: string | null;
}
