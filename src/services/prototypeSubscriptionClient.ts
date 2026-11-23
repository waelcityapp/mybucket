import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { requestSubscription, resolveSubscriptionRecords } from './subscriptionClient';
import type { UserSubscription as StoredSubscription } from '../types/subscription';
import type { UserSubscription } from '../types/prototypeSubscription';
import { stageFor } from '../config/subscriptionPolicy';
import { grantFromAccess } from '../config/grantPolicy';

function toPrototype(sub: StoredSubscription): UserSubscription {
  const phase = stageFor(sub);
  return {
    grant: sub.grant || null,
    tier: (phase === 'basic-free' || phase === 'paid-basic') ? 'basic' : phase === 'pro-trial' ? 'trial' : phase === 'paid' ? 'pro' : 'expired',
    trialDatesStored: sub.trialDatesStored === true,
    affiliateCode: sub.affiliateCode,
    hasAppliedAffiliateCode: sub.hasAppliedAffiliateCode,
    totalTrialDays: sub.totalTrialDays,
    trialStartedAt: sub.trialStartedAt,
    trialExpiresAt: sub.trialExpiresAt,
    isPaid: Boolean(sub.isPaid && sub.paidExpiresAt && Date.parse(sub.paidExpiresAt) > Date.now()),
    paidPlan: sub.paidPlan,
    paidExpiresAt: sub.paidExpiresAt,
    dailyExpenseAiLimit: sub.dailyAiEntryLimit,
    dailyInquiryAiLimit: sub.dailyAiInquiryLimit,
    maxHistoricalQueryDays: sub.maxHistoricalQueryDays,
    discountPricePerMonth: sub.monthlyPriceEgp ?? 180,
  };
}

export interface SubscriptionReadIssue {
  source: 'billing' | 'access' | 'dates' | 'auth';
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
  let access: Record<string, unknown> | null | undefined;
  let delivered = false;
  const readErrors = new Map<SubscriptionReadIssue['source'], string>();

  const report = (source: SubscriptionReadIssue['source'], error: unknown, overrideCode?: string) => {
    if (!active) return;
    const code = overrideCode || (error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
      ? error.code : 'subscription-read-failed');
    const denied = code === 'permission-denied';
    const timeout = code === 'subscription-read-timeout';
    const labelAr = source === 'access' ? 'صلاحية الاستخدام' : 'سجل الاشتراك';
    const labelEn = source === 'access' ? 'the access record' : 'the subscription record';
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
      report(billing === undefined ? 'billing' : 'access', new Error('No confirmed snapshot within 12 seconds.'), 'subscription-read-timeout');
    }
  }, 12000);

  const refresh = () => {
    if (!active || billing === undefined || access === undefined) return;
    const user = auth.currentUser;
    if (!user || user.uid !== uid) {
      report('auth', new Error('The signed-in account changed.'), 'auth-account-changed');
      return;
    }
    try {
      const sub = resolveSubscriptionRecords(user, billing);
      sub.grant = grantFromAccess(access);
      clearTimeout(timeout);
      delivered = true;
      readErrors.clear();
      onUpdate(toPrototype(sub));
    } catch (error) {
      clearTimeout(timeout);
      report('dates', error, 'invalid-subscription-dates');
    }
  };

  const unsubscribeBilling = onSnapshot(doc(db, 'users', uid, 'billing', 'subscription'), { includeMetadataChanges: true }, (snapshot) => {
    const fromCache = snapshot.metadata.fromCache;
    if (fromCache) return;
    billing = snapshot.exists() ? snapshot.data() : null;
    refresh();
  }, error => {
    clearTimeout(timeout);
    report('billing', error);
  });
  const unsubscribeAccess = onSnapshot(doc(db, 'users', uid, 'billing', 'access'), { includeMetadataChanges: true }, (snapshot) => {
    if (snapshot.metadata.fromCache) return;
    access = snapshot.exists() ? snapshot.data() : null;
    refresh();
  }, error => { clearTimeout(timeout); report('access', error); });
  return () => {
    active = false;
    clearTimeout(timeout);
    unsubscribeBilling();
    unsubscribeAccess();
  };
}

export async function redeemMarketerCode(uid: string, code: string) {
  const user = auth.currentUser;
  if (!user || user.uid !== uid) throw new Error('authentication_required');
  await requestSubscription('subscription.applyAffiliate', { code }, user);
}
