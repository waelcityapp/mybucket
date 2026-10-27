import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { requestSubscription, resolveSubscriptionRecords } from './subscriptionClient';
import type { UserSubscription as StoredSubscription } from '../types/subscription';
import type { UserSubscription } from '../types/prototypeSubscription';

function toPrototype(sub: StoredSubscription): UserSubscription {
  return {
    tier: sub.status === 'paid' ? 'pro' : sub.status,
    trialDatesStored: sub.trialDatesStored === true,
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

export interface SubscriptionReadIssue {
  source: 'billing' | 'profile' | 'dates' | 'auth';
  code: string;
  messageAr: string;
  messageEn: string;
  fields?: string[];
  readErrors?: string[];
}

// Consume delivered records without making the independent billing read depend on profile access.
export function subscribeUserSubscription(
  uid: string,
  onUpdate: (sub: UserSubscription) => void,
  onError: (issue: SubscriptionReadIssue) => void
) {
  let active = true;
  let billing: Record<string, unknown> | null | undefined;
  let profile: Record<string, unknown> | null | undefined;
  let delivered = false;
  const readErrors = new Map<SubscriptionReadIssue['source'], string>();

  const hasSelfContainedBilling = () => {
    const user = auth.currentUser;
    if (!user || user.uid !== uid || !billing) return false;
    try {
      const subscription = resolveSubscriptionRecords(user, billing, null);
      return subscription.hasAppliedAffiliateCode || subscription.isPaid;
    } catch {
      return false;
    }
  };

  const report = (source: SubscriptionReadIssue['source'], error: unknown, overrideCode?: string) => {
    if (!active || (source === 'profile' && hasSelfContainedBilling())) return;
    const code = overrideCode || (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code : 'subscription-read-failed');
    const denied = code === 'permission-denied';
    const timeout = code === 'subscription-read-timeout';
    const labelAr = source === 'profile' ? 'كود المسوق المحفوظ في الحساب' : 'سجل الاشتراك';
    const labelEn = source === 'profile' ? 'the saved marketer code' : 'the subscription record';
    console.warn(`Subscription ${source} read failed (${code}):`, error);
    readErrors.set(source, `${source}: ${code}`);
    onError({
      readErrors: [...readErrors.values()],
      source,
      code,
      messageAr: source === 'dates'
        ? 'سجل الاشتراك موجود، لكن تاريخ البداية أو الانتهاء غير صالح.'
        : source === 'auth'
        ? 'تغيّر الحساب أثناء قراءة الاشتراك. أعد تسجيل الدخول.'
        : denied
        ? `صلاحيات Firebase تمنع قراءة ${labelAr}.`
        : timeout
        ? `لم تصل قراءة مؤكدة من Firebase لـ${labelAr}.`
        : `تعذرت قراءة ${labelAr}.`,
      messageEn: source === 'dates'
        ? 'The subscription record exists, but its start or expiry date is invalid.'
        : source === 'auth'
        ? 'The signed-in account changed. Sign in again.'
        : denied
        ? `Firebase permissions prevent reading ${labelEn}.`
        : timeout
        ? `Firebase has not confirmed ${labelEn}.`
        : `Could not read ${labelEn}.`,
      ...(source === 'dates' && billing ? { fields: Object.keys(billing).sort() } : {}),
    });
  };

  const timeout = setTimeout(() => {
    if (active && !delivered) {
      report(billing === undefined ? 'billing' : 'profile', new Error('No confirmed snapshot within 12 seconds.'), 'subscription-read-timeout');
    }
  }, 12000);

  const refresh = () => {
    if (!active || billing === undefined) return;
    const user = auth.currentUser;
    if (!user || user.uid !== uid) {
      report('auth', new Error('The signed-in account changed.'), 'auth-account-changed');
      return;
    }
    try {
      const sub = resolveSubscriptionRecords(user, billing, profile || null);
      // A recorded code or paid status is complete in billing; profile is only needed for a prototype code.
      if (profile === undefined && !hasSelfContainedBilling()) return;
      clearTimeout(timeout);
      delivered = true;
      readErrors.clear();
      onUpdate(toPrototype(sub));
    } catch (error) {
      clearTimeout(timeout);
      report('dates', error, 'invalid-subscription-dates');
    }
  };

  const unsubscribeProfile = onSnapshot(doc(db, 'users', uid), { includeMetadataChanges: true }, (snapshot) => {
    const fromCache = snapshot.metadata.fromCache;
    if (fromCache) return;
    profile = snapshot.exists() ? snapshot.data() : null;
    refresh();
  }, error => {
    clearTimeout(timeout);
    report('profile', error);
  });
  const unsubscribeBilling = onSnapshot(doc(db, 'users', uid, 'billing', 'subscription'), { includeMetadataChanges: true }, (snapshot) => {
    const fromCache = snapshot.metadata.fromCache;
    if (fromCache) return;
    billing = snapshot.exists() ? snapshot.data() : null;
    refresh();
  }, error => {
    clearTimeout(timeout);
    report('billing', error);
  });
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
