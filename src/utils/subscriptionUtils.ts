import { UserSubscription, UserDailyUsage, AffiliateCodeInfo } from '../types/prototypeSubscription';
import { getCurrentLocalDate } from './dateTime';

export const VALID_AFFILIATE_CODES: Record<string, AffiliateCodeInfo> = {
  WAEL2026: {
    code: 'WAEL2026',
    name: 'كود الشريك الذهبي - وائل',
    bonusDays: 25, // 10 base + 25 = 35 days
    discountMonthlyRate: 120, // 4 EGP / day
    regularMonthlyRate: 180, // 6 EGP / day
  },
  VIP2025: {
    code: 'VIP2025',
    name: 'كود شركاء النجاح VIP',
    bonusDays: 25,
    discountMonthlyRate: 120,
    regularMonthlyRate: 180,
  },
  VIP35: {
    code: 'VIP35',
    name: 'كود شركاء النجاح VIP 35',
    bonusDays: 25,
    discountMonthlyRate: 120,
    regularMonthlyRate: 180,
  },
  MARKET50: {
    code: 'MARKET50',
    name: 'كود التسويق الحصري',
    bonusDays: 25,
    discountMonthlyRate: 120,
    regularMonthlyRate: 180,
  },
  OCTOBER2025: {
    code: 'OCTOBER2025',
    name: 'كود مجتمع أكتوبر',
    bonusDays: 25,
    discountMonthlyRate: 120,
    regularMonthlyRate: 180,
  },
  SAVE35: {
    code: 'SAVE35',
    name: 'كود التوفير 35',
    bonusDays: 25,
    discountMonthlyRate: 120,
    regularMonthlyRate: 180,
  },
  MYBUCKET35: {
    code: 'MYBUCKET35',
    name: 'كود مجتمع My Bucket الحصري',
    bonusDays: 25,
    discountMonthlyRate: 120,
    regularMonthlyRate: 180,
  },
};

export const ALLOWED_EMAIL_DOMAINS = [
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'live.com',
  'protonmail.com',
  'proton.me',
];

export function isAllowedEmailDomain(email: string): boolean {
  if (!email || !email.includes('@')) return false;
  const domain = email.trim().toLowerCase().split('@')[1];
  if (!domain) return false;
  return ALLOWED_EMAIL_DOMAINS.includes(domain);
}

// Calculate remaining trial days safely
export function calculateRemainingTrialDays(subscription: UserSubscription): number {
  if (subscription.isPaid) return 999;
  const now = new Date().getTime();
  const expiresAt = new Date(subscription.trialExpiresAt).getTime();
  const diffMs = expiresAt - now;
  if (diffMs <= 0) return 0;
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

// Create default trial subscription (10 days without affiliate code, 35 days with valid code)
export function createInitialSubscription(appliedCode?: string | null): UserSubscription {
  const codeNormalized = (appliedCode || '').trim().toUpperCase();
  const isCodeValid = Boolean(VALID_AFFILIATE_CODES[codeNormalized]);
  const totalDays = isCodeValid ? 35 : 10;
  
  const now = new Date();
  const expires = new Date(now.getTime() + totalDays * 24 * 60 * 60 * 1000);

  return {
    tier: 'trial',
    affiliateCode: isCodeValid ? codeNormalized : null,
    hasAppliedAffiliateCode: isCodeValid,
    totalTrialDays: totalDays,
    trialStartedAt: now.toISOString(),
    trialExpiresAt: expires.toISOString(),
    isPaid: false,
    paidExpiresAt: null,
    dailyExpenseAiLimit: 15,
    dailyInquiryAiLimit: 5,
    maxHistoricalQueryDays: 35,
    discountPricePerMonth: isCodeValid ? 120 : 180,
  };
}

// Upgrade existing subscription when entering affiliate code (calculating used days, no retroactive resets)
export function applyAffiliateCodeToExistingSubscription(
  currentSub: UserSubscription,
  inputCode: string
): { success: boolean; updatedSubscription?: UserSubscription; message: string } {
  const codeNormalized = inputCode.trim().toUpperCase();
  if (!VALID_AFFILIATE_CODES[codeNormalized]) {
    return {
      success: false,
      message: 'كود المسوّق غير صحيح أو غير مفعل حالياً.',
    };
  }

  if (currentSub.hasAppliedAffiliateCode) {
    return {
      success: false,
      message: 'تم تفعيل كود مسوّق مسبقاً لهذا الحساب (مسموح بكود واحد فقط).',
    };
  }

  // 1. If user is already a paid customer:
  // Apply discount to NEXT billing cycle without retroactive refund
  if (currentSub.isPaid) {
    const updated: UserSubscription = {
      ...currentSub,
      affiliateCode: codeNormalized,
      hasAppliedAffiliateCode: true,
      discountPricePerMonth: 120, // Next renewal at 120 EGP
    };
    return {
      success: true,
      updatedSubscription: updated,
      message: 'تم ربط كود المسوّق بنجاح! سيتم تطبيق خصم الاشتراك (120 ج بدل 180 ج) على التجديد القادم.',
    };
  }

  // 2. If user is in Trial:
  // Deduct already used trial days from the 35 total days
  const startDate = new Date(currentSub.trialStartedAt);
  const now = new Date();
  const usedDays = Math.max(0, Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)));
  
  // Total allowed with code is 35 days from initial creation
  const totalDays = 35;
  const newExpiresAt = new Date(startDate.getTime() + totalDays * 24 * 60 * 60 * 1000);

  const updated: UserSubscription = {
    ...currentSub,
    affiliateCode: codeNormalized,
    hasAppliedAffiliateCode: true,
    totalTrialDays: totalDays,
    trialExpiresAt: newExpiresAt.toISOString(),
    discountPricePerMonth: 120,
  };

  const remainingDays = Math.max(0, totalDays - usedDays);

  return {
    success: true,
    updatedSubscription: updated,
    message: `تم تفعيل الكود بنجاح! تم تمديد فترة التجربة إلى 35 يومًا من تاريخ تسجيلك (متبقي لك ${remainingDays} يومًا) + خصم التجديد القادم.`,
  };
}

// Remove / Reset affiliate code from subscription
export function removeAffiliateCodeFromSubscription(
  currentSub: UserSubscription
): UserSubscription {
  const startDate = new Date(currentSub.trialStartedAt);
  const totalDays = 10;
  const newExpiresAt = new Date(startDate.getTime() + totalDays * 24 * 60 * 60 * 1000);

  return {
    ...currentSub,
    affiliateCode: null,
    hasAppliedAffiliateCode: false,
    totalTrialDays: totalDays,
    trialExpiresAt: newExpiresAt.toISOString(),
    discountPricePerMonth: 180,
  };
}

// Check Daily Quotas
export function getDailyUsageKey(userId: string): string {
  const today = getCurrentLocalDate();
  return `mybucket_usage_${userId}_${today}`;
}

export function getTodayUsage(userId: string): UserDailyUsage {
  const today = getCurrentLocalDate();
  const key = getDailyUsageKey(userId);
  const stored = localStorage.getItem(key);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      // fallback
    }
  }
  return { date: today, expenseAiCount: 0, inquiryAiCount: 0 };
}

export function incrementExpenseAiUsage(userId: string): UserDailyUsage {
  const usage = getTodayUsage(userId);
  usage.expenseAiCount += 1;
  localStorage.setItem(getDailyUsageKey(userId), JSON.stringify(usage));
  return usage;
}

export function incrementInquiryAiUsage(userId: string): UserDailyUsage {
  const usage = getTodayUsage(userId);
  usage.inquiryAiCount += 1;
  localStorage.setItem(getDailyUsageKey(userId), JSON.stringify(usage));
  return usage;
}
