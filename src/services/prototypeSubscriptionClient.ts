import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { requestSubscription } from './subscriptionClient';
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
export function subscribeUserSubscription(uid: string, onUpdate: (sub: UserSubscription) => void) {
  let active = true;
  const refresh = async () => {
    try {
      const user = auth.currentUser;
      if (!user || user.uid !== uid) return;
      const sub = await requestSubscription('subscription.get', {}, user);
      if (active) onUpdate(toPrototype(sub));
    } catch (error) {
      console.warn('Subscription could not be loaded:', error);
    }
  };
  const unsubscribeProfile = onSnapshot(doc(db, 'users', uid), refresh, refresh);
  const unsubscribeBilling = onSnapshot(doc(db, 'users', uid, 'billing', 'subscription'), refresh, refresh);
  return () => { active = false; unsubscribeProfile(); unsubscribeBilling(); };
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
