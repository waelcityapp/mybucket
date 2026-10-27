export type SubscriptionTier = 'trial' | 'pro' | 'expired';

export interface UserSubscription {
  tier: SubscriptionTier;
  trialDatesStored?: boolean;
  affiliateCode?: string | null;
  hasAppliedAffiliateCode: boolean;
  totalTrialDays: number; // 10 without code, 35 with code
  trialStartedAt: string; // ISO string date
  trialExpiresAt: string; // ISO string date
  isPaid: boolean;
  paidExpiresAt?: string | null;
  dailyExpenseAiLimit: number; // 15 per day
  dailyInquiryAiLimit: number; // 5 per day
  maxHistoricalQueryDays: number; // 35 days in trial, unlimited (3650) in pro
  discountPricePerMonth?: number; // 120 EGP (4 EGP/day) vs 180 EGP regular
}

export interface UserDailyUsage {
  date: string; // YYYY-MM-DD
  expenseAiCount: number; // Max 15 in trial
  inquiryAiCount: number; // Max 5 in trial
}

export interface AffiliateCodeInfo {
  code: string;
  name: string;
  bonusDays: number; // 25 bonus days (giving 35 total)
  discountMonthlyRate: number; // 120 EGP
  regularMonthlyRate: number; // 180 EGP
}
