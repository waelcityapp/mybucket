import { UserSubscription, UserDailyUsage } from '../types/prototypeSubscription';
import { getCurrentLocalDate } from './dateTime';

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

function remainingDaysUntil(expiry: string | null | undefined, now: number): number {
  const timestamp = expiry ? Date.parse(expiry) : NaN;
  return Number.isFinite(timestamp) ? Math.max(0, Math.ceil((timestamp - now) / 86400000)) : 0;
}

export function calculateRemainingTrialDays(subscription: UserSubscription, now = Date.now()): number {
  return remainingDaysUntil(subscription.trialExpiresAt, now);
}

export function calculateRemainingPaidDays(subscription: UserSubscription, now = Date.now()): number {
  return subscription.isPaid ? remainingDaysUntil(subscription.paidExpiresAt, now) : 0;
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
