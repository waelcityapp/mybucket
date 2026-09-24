import type { User } from 'firebase/auth';
import { doc, getDocFromServer, runTransaction } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { UserSubscription } from '../types/subscription';

export type SubscriptionAction = 'subscription.get' | 'subscription.applyAffiliate';

const DAY_MS = 86_400_000;
const LOCAL_CODE_PREFIX = 'mybucket_prototype_affiliate_';
// Temporary Google prototype codes. This is display-only until server redemption is enabled.
const PROTOTYPE_CODES = new Set([
  'WAEL2026', 'VIP2025', 'VIP35', 'MARKET50',
  'OCTOBER2025', 'SAVE35', 'MYBUCKET35',
]);

type LegacySubscription = Record<string, unknown>;

function validDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

function normalizeSubscription(raw: LegacySubscription): UserSubscription | null {
  // An older Google login flow accidentally saved { success, updatedSubscription, message }.
  const nested = raw.updatedSubscription;
  const source = nested && typeof nested === 'object' && !Array.isArray(nested)
    ? nested as LegacySubscription
    : raw;
  if (!validDate(source.trialStartedAt)) return null;

  const start = Date.parse(source.trialStartedAt);
  const expiry = validDate(source.trialExpiresAt) ? source.trialExpiresAt : null;
  if (!expiry) return null;
  const code = typeof source.affiliateCode === 'string' && source.affiliateCode.trim()
    ? source.affiliateCode.trim().toUpperCase()
    : null;
  const totalDays = typeof source.totalTrialDays === 'number' && Number.isFinite(source.totalTrialDays)
    ? source.totalTrialDays
    : Math.max(10, Math.round((Date.parse(expiry) - start) / DAY_MS));
  const isPaid = source.isPaid === true;
  const paidExpiresAt = validDate(source.paidExpiresAt) ? source.paidExpiresAt : null;
  const effectiveExpiry = isPaid && paidExpiresAt ? paidExpiresAt : expiry;

  return {
    status: Date.parse(effectiveExpiry) <= Date.now() ? 'expired' : isPaid ? 'paid' : 'trial',
    trialStartedAt: source.trialStartedAt,
    trialExpiresAt: expiry,
    totalTrialDays: totalDays,
    affiliateCode: code,
    affiliateAppliedAt: validDate(source.affiliateAppliedAt) ? source.affiliateAppliedAt : null,
    hasAppliedAffiliateCode: Boolean(code),
    isPaid,
    paidExpiresAt,
    monthlyPriceEgp: typeof source.monthlyPriceEgp === 'number'
      ? source.monthlyPriceEgp
      : typeof source.discountPricePerMonth === 'number' ? source.discountPricePerMonth : code ? 120 : 180,
    dailyAiEntryLimit: typeof source.dailyAiEntryLimit === 'number' ? source.dailyAiEntryLimit : 15,
    dailyAiInquiryLimit: typeof source.dailyAiInquiryLimit === 'number' ? source.dailyAiInquiryLimit : 5,
    maxHistoricalQueryDays: typeof source.maxHistoricalQueryDays === 'number' ? source.maxHistoricalQueryDays : 35,
    createdAt: validDate(source.createdAt) ? source.createdAt : source.trialStartedAt,
    updatedAt: validDate(source.updatedAt) ? source.updatedAt : source.trialStartedAt,
    recordSource: 'billing',
  };
}

function fromGoogleRegistration(user: User): UserSubscription {
  const start = user.metadata.creationTime;
  if (!validDate(start)) throw new Error('تعذر تحديد تاريخ إنشاء حساب Google.');
  const trialStartedAt = new Date(start).toISOString();
  return { ...normalizeSubscription({
    trialStartedAt,
    trialExpiresAt: new Date(Date.parse(trialStartedAt) + 10 * DAY_MS).toISOString(),
    totalTrialDays: 10,
    isPaid: false,
  })!, recordSource: 'account' };
}

function localCodeKey(uid: string): string {
  return `${LOCAL_CODE_PREFIX}${uid}`;
}

function withCode(subscription: UserSubscription, code: string, temporaryLocalOnly: boolean): UserSubscription {
  if (subscription.hasAppliedAffiliateCode || subscription.isPaid) return subscription;
  const trialExpiresAt = new Date(Date.parse(subscription.trialStartedAt) + 35 * DAY_MS).toISOString();
  return {
    ...subscription,
    status: Date.parse(trialExpiresAt) <= Date.now() ? 'expired' : 'trial',
    trialExpiresAt,
    totalTrialDays: 35,
    affiliateCode: code,
    hasAppliedAffiliateCode: true,
    monthlyPriceEgp: 120,
    temporaryLocalOnly,
  };
}

async function persistPrototypeCode(uid: string, code: string): Promise<void> {
  const profileRef = doc(db, 'users', uid);
  await runTransaction(db, async (transaction) => {
    const profile = await transaction.get(profileRef);
    if (profile.data()?.prototypeAffiliateCode) {
      throw new Error('تم تسجيل كود مسوّق مسبقًا لهذا الحساب.');
    }
    transaction.set(profileRef, {
      prototypeAffiliateCode: code,
      prototypeAffiliateAppliedAt: new Date().toISOString(),
    }, { merge: true });
  });
}

async function readSubscription(user: User): Promise<UserSubscription> {
  const snapshot = await getDocFromServer(doc(db, 'users', user.uid, 'billing', 'subscription'));
  let subscription: UserSubscription;
  if (snapshot.exists()) {
    const existing = normalizeSubscription(snapshot.data());
    if (!existing) throw new Error('سجل الاشتراك المحفوظ لا يحتوي على تاريخ صالح لحساب الأيام.');
    subscription = existing;
  } else {
    // The account creation time is stable across browsers; never start a new trial on refresh.
    subscription = fromGoogleRegistration(user);
  }

  if (subscription.hasAppliedAffiliateCode || subscription.isPaid) return subscription;
  const profile = await getDocFromServer(doc(db, 'users', user.uid));
  const savedCode = profile.data()?.prototypeAffiliateCode;
  if (typeof savedCode === 'string' && PROTOTYPE_CODES.has(savedCode)) {
    localStorage.removeItem(localCodeKey(user.uid));
    return withCode(subscription, savedCode, false);
  }

  const localCode = localStorage.getItem(localCodeKey(user.uid));
  if (localCode && PROTOTYPE_CODES.has(localCode)) {
    try {
      await persistPrototypeCode(user.uid, localCode);
      localStorage.removeItem(localCodeKey(user.uid));
      return withCode(subscription, localCode, false);
    } catch {
      return withCode(subscription, localCode, true);
    }
  }
  return subscription;
}

export async function requestSubscription(
  action: SubscriptionAction,
  payload: Record<string, unknown> = {},
  firebaseUser?: User
): Promise<UserSubscription> {
  const user = firebaseUser || auth.currentUser;
  if (!user) throw new Error('سجّل الدخول بحساب Google أولاً.');

  const current = await readSubscription(user);
  if (action === 'subscription.get') return current;

  const code = typeof payload.code === 'string' ? payload.code.trim().toUpperCase() : '';
  if (!PROTOTYPE_CODES.has(code)) throw new Error('كود المسوّق غير صحيح أو غير مفعل حالياً.');
  if (current.hasAppliedAffiliateCode) throw new Error('تم تفعيل كود مسوّق مسبقًا لهذا الحساب.');
  try {
    await persistPrototypeCode(user.uid, code);
  } catch {
    throw new Error('تعذر حفظ كود المسوّق في Firebase. لم يتم تفعيله؛ حاول مرة أخرى.');
  }
  return withCode(current, code, false);
}
