import type { User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import type { UserSubscription } from '../types/subscription';
import { getTrialDurations, addDays, stageFor } from '../config/subscriptionPolicy';

export type SubscriptionAction = 'subscription.get' | 'subscription.applyAffiliate';

type LegacySubscription = Record<string, unknown>;

function dateString(value: unknown): string | null {
  if (typeof value === 'string' && Number.isFinite(Date.parse(value))) return value;
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (value && typeof value === 'object' && 'seconds' in value) {
    const seconds = (value as { seconds: unknown }).seconds;
    if (typeof seconds === 'number' && Number.isFinite(seconds)) {
      const date = new Date(seconds * 1000);
      if (Number.isFinite(date.getTime())) return date.toISOString();
    }
  }
  return null;
}

function validDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function normalizeSubscription(raw: LegacySubscription): UserSubscription | null {
  // An older Google login flow accidentally saved { success, updatedSubscription, message }.
  const nested = raw.updatedSubscription;
  const source = nested && typeof nested === 'object' && !Array.isArray(nested)
    ? { ...raw, ...nested as LegacySubscription }
    : raw;
  const trialStartedAt = dateString(source.trialStartedAt);
  if (!trialStartedAt) return null;

  const totalDays = getTrialDurations().basicDays;
  const expiry = addDays(trialStartedAt, totalDays);
  const code = raw.hasAppliedAffiliateCode === true && typeof raw.affiliateCode === 'string' && raw.affiliateCode.trim()
    ? raw.affiliateCode.trim().toUpperCase()
    : null;
  const isPaid = source.isPaid === true;
  const paidExpiresAt = dateString(source.paidExpiresAt);
  const paidPlan = source.paidPlan === 'basic' ? 'basic' : 'pro';
  const phase = stageFor({ trialStartedAt, isPaid, paidPlan, paidExpiresAt });

  return {
    status: (phase === 'paid' || phase === 'paid-basic') ? 'paid' : phase === 'expired' ? 'expired' : 'trial',
    trialStartedAt,
    trialExpiresAt: expiry,
    totalTrialDays: totalDays,
    affiliateCode: code,
    affiliateAppliedAt: validDate(source.affiliateAppliedAt) ? source.affiliateAppliedAt : null,
    hasAppliedAffiliateCode: Boolean(code),
    isPaid,
    paidExpiresAt,
    paidPlan,
    monthlyPriceEgp: typeof source.monthlyPriceEgp === 'number'
      ? source.monthlyPriceEgp
      : typeof source.discountPricePerMonth === 'number' ? source.discountPricePerMonth : code ? 120 : 180,
    dailyAiEntryLimit: typeof source.dailyAiEntryLimit === 'number' ? source.dailyAiEntryLimit : 15,
    dailyAiInquiryLimit: typeof source.dailyAiInquiryLimit === 'number' ? source.dailyAiInquiryLimit : 5,
    maxHistoricalQueryDays: typeof source.maxHistoricalQueryDays === 'number' ? source.maxHistoricalQueryDays : 35,
    createdAt: dateString(source.createdAt) || trialStartedAt,
    updatedAt: dateString(source.updatedAt) || trialStartedAt,
    recordSource: 'billing',
    trialDatesStored: true,
  };
}

function fromGoogleRegistration(user: User): UserSubscription {
  const start = user.metadata.creationTime;
  if (!validDate(start)) throw new Error('تعذر تحديد تاريخ إنشاء حساب Google.');
  const trialStartedAt = new Date(start).toISOString();
  return { ...normalizeSubscription({
    trialStartedAt,
    trialExpiresAt: addDays(trialStartedAt, getTrialDurations().basicDays),
    totalTrialDays: getTrialDurations().basicDays,
    isPaid: false,
  })!, recordSource: 'account', trialDatesStored: false };
}

export function resolveSubscriptionRecords(user: User, billing: LegacySubscription | null): UserSubscription {
  const subscription = billing ? normalizeSubscription(billing) : fromGoogleRegistration(user);
  if (!subscription) throw new Error('سجل الاشتراك المحفوظ لا يحتوي على تاريخ صالح لحساب الأيام.');
  return subscription;
}

export async function requestSubscription(
  action: SubscriptionAction,
  payload: Record<string, unknown> = {},
  firebaseUser?: User
): Promise<UserSubscription> {
  const user = firebaseUser || auth.currentUser;
  if (!user) throw new Error('authentication_required');
  const response = await fetch('/api/gateway', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await user.getIdToken() },
    body: JSON.stringify({ action, payload }),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error || 'subscription_request_failed');
  return result.data.subscription;
}
