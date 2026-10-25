import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { requestSubscription, resolveSubscriptionRecords } from './subscriptionClient';
import type { UserSubscription as StoredSubscription } from '../types/subscription';
import type { UserSubscription } from '../types/prototypeSubscription';

function toPrototype(sub: StoredSubscription): UserSubscription {
  return {
    tier: sub.status === 'paid' ? 'pro' : sub.status,
    affiliateCode: sub.affiliateCode,
    hasAppliedAffiliateCode: sub.hasAppliedAffiliateCode,
    totalTrialDays: sub.totalTrialDays,
    trialStartedAt: sub.trialStartedAt,
    trialExpiresAt: sub.trialExpiresAt,
    isPaid: sub.isPaid,
    paidExpiresAt: sub.paidExpiresAt,
    dailyExpenseAiLimit: sub.dailyAiEntryLimit,
    dailyInquiryAiLimit: sub.dailyAiInquiryLimit,
    maxHistoricalQueryDays: sub.maxHistoricalQueryDays,
    discountPricePerMonth: sub.monthlyPriceEgp ?? 180,
  };
}

// Keep the original UI while preserving the existing records, dates and Firebase rules.
export function subscribeUserSubscription(
  uid: string,
  onUpdate: (sub: UserSubscription) => void,
  onError: (message: string) => void
) {
  let active = true;
  let billing: Record<string, unknown> | null | undefined;
  let profile: Record<string, unknown> | null | undefined;
  const timeout = setTimeout(() => {
    if (active && (billing === undefined || profile === undefined)) {
      onError('تعذر قراءة حالة الاشتراك. اضغط لإعادة المحاولة.');
    }
  }, 12000);
  const fail = (error: unknown) => {
    if (!active) return;
    clearTimeout(timeout);
    console.warn('Subscription could not be loaded:', error);
    onError('تعذر قراءة حالة الاشتراك. اضغط لإعادة المحاولة.');
  };
  const refresh = () => {
    if (!active || billing === undefined || profile === undefined) return;
    try {
      const user = auth.currentUser;
      if (!user || user.uid !== uid) throw new Error('The signed-in account changed.');
      const sub = resolveSubscriptionRecords(user, billing, profile);
      clearTimeout(timeout);
      onUpdate(toPrototype(sub));
    } catch (error) {
      fail(error);
    }
  };
  const unsubscribeProfile = onSnapshot(doc(db, 'users', uid), { includeMetadataChanges: true }, (snapshot) => {
    const fromCache = snapshot.metadata.fromCache;
    if (!snapshot.exists() && fromCache) return;
    profile = snapshot.exists() ? snapshot.data() : null;
    refresh();
  }, fail);
  const unsubscribeBilling = onSnapshot(doc(db, 'users', uid, 'billing', 'subscription'), { includeMetadataChanges: true }, (snapshot) => {
    const fromCache = snapshot.metadata.fromCache;
    if (!snapshot.exists() && fromCache) return;
    billing = snapshot.exists() ? snapshot.data() : null;
    refresh();
  }, fail);
  return () => {
    active = false;
    clearTimeout(timeout);
    unsubscribeProfile();
    unsubscribeBilling();
  };
}

export async function saveUserSubscriptionToFirestore(uid: string, proposed: Partial<UserSubscription>) {
  const user = auth.currentUser;
  if (!user || user.uid !== uid) throw new Error('Sign in to update your subscription.');
  const existing = await requestSubscription('subscription.get', {}, user);
  if (proposed.affiliateCode && proposed.affiliateCode !== existing.affiliateCode) {
    return toPrototype(await requestSubscription('subscription.applyAffiliate', { code: proposed.affiliateCode }, user));
  }
  if (existing.affiliateCode && !proposed.affiliateCode) {
    throw new Error('لا يمكن إزالة كود مسجل من سجل الحساب.');
  }
  return toPrototype(existing);
}
