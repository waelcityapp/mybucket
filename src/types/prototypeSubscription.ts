import type { FreeGrant } from '../config/grantPolicy';
export type SubscriptionTier = 'trial' | 'basic' | 'pro' | 'expired';

export interface UserSubscription {
  grant?: FreeGrant | null;
  tier: SubscriptionTier;
  trialDatesStored?: boolean;
  affiliateCode?: string | null;
  hasAppliedAffiliateCode: boolean;
  totalTrialDays: number;
  trialStartedAt: string; // ISO string date
  trialExpiresAt: string; // ISO string date
  isPaid: boolean;
  paidPlan?: 'basic' | 'pro';
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
