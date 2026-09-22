import type { Request } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminFirestore } from './firebaseAdmin';
import type { AffiliateCodeRecord, UserSubscription } from '../src/types/subscription';

const BASE_TRIAL_DAYS = 10;
const DEFAULT_CODE_TRIAL_DAYS = 35;
const DEFAULT_MONTHLY_PRICE_EGP = 180;
const DAY_MS = 24 * 60 * 60 * 1000;
const CODE_PATTERN = /^[A-Z0-9_-]{3,32}$/;

export class SubscriptionError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string
  ) {
    super(message);
  }
}

export async function verifyAuthenticatedUser(req: Request): Promise<{ uid: string; email: string | null }> {
  const authorization = req.header('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    throw new SubscriptionError(401, 'authentication_required', 'A Firebase ID token is required.');
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(match[1], true);
    return { uid: decoded.uid, email: decoded.email || null };
  } catch {
    throw new SubscriptionError(401, 'invalid_authentication', 'The Firebase ID token is invalid or expired.');
  }
}

function isoAfterDays(startIso: string, days: number): string {
  return new Date(new Date(startIso).getTime() + days * DAY_MS).toISOString();
}

function createBaseSubscription(nowIso: string): UserSubscription {
  return {
    status: 'trial',
    trialStartedAt: nowIso,
    trialExpiresAt: isoAfterDays(nowIso, BASE_TRIAL_DAYS),
    totalTrialDays: BASE_TRIAL_DAYS,
    affiliateCode: null,
    affiliateAppliedAt: null,
    hasAppliedAffiliateCode: false,
    isPaid: false,
    paidExpiresAt: null,
    monthlyPriceEgp: DEFAULT_MONTHLY_PRICE_EGP,
    dailyAiEntryLimit: 15,
    dailyAiInquiryLimit: 5,
    maxHistoricalQueryDays: 35,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

function withComputedStatus(subscription: UserSubscription): UserSubscription {
  if (subscription.isPaid) {
    return { ...subscription, status: 'paid' };
  }
  const expired = new Date(subscription.trialExpiresAt).getTime() <= Date.now();
  return { ...subscription, status: expired ? 'expired' : 'trial' };
}

export async function getOrCreateSubscription(uid: string): Promise<UserSubscription> {
  const db = getAdminFirestore();
  const subscriptionRef = db.doc(`users/${uid}/billing/subscription`);

  const subscription = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(subscriptionRef);
    if (snapshot.exists) {
      return snapshot.data() as UserSubscription;
    }

    const created = createBaseSubscription(new Date().toISOString());
    transaction.create(subscriptionRef, created);
    return created;
  });

  return withComputedStatus(subscription);
}

function validateAffiliateCodeRecord(data: AffiliateCodeRecord | undefined, normalizedCode: string) {
  if (!data || data.active !== true) {
    throw new SubscriptionError(404, 'affiliate_code_invalid', 'The marketer code is invalid or inactive.');
  }

  const now = Date.now();
  if (data.validFrom && new Date(data.validFrom).getTime() > now) {
    throw new SubscriptionError(409, 'affiliate_code_not_started', 'The marketer code is not active yet.');
  }
  if (data.validUntil && new Date(data.validUntil).getTime() < now) {
    throw new SubscriptionError(409, 'affiliate_code_expired', 'The marketer code has expired.');
  }
  if (data.maxRedemptions !== null && data.redemptionCount >= data.maxRedemptions) {
    throw new SubscriptionError(409, 'affiliate_code_limit_reached', 'The marketer code reached its redemption limit.');
  }

  const totalTrialDays = Number(data.totalTrialDays || DEFAULT_CODE_TRIAL_DAYS);
  if (!Number.isInteger(totalTrialDays) || totalTrialDays < BASE_TRIAL_DAYS || totalTrialDays > 365) {
    throw new SubscriptionError(500, 'affiliate_code_configuration_invalid', `Invalid configuration for ${normalizedCode}.`);
  }

  return totalTrialDays;
}

export async function applyAffiliateCode(uid: string, rawCode: unknown): Promise<UserSubscription> {
  const normalizedCode = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
  if (!CODE_PATTERN.test(normalizedCode)) {
    throw new SubscriptionError(400, 'affiliate_code_invalid_format', 'Enter a valid marketer code.');
  }

  const db = getAdminFirestore();
  const subscriptionRef = db.doc(`users/${uid}/billing/subscription`);
  const codeRef = db.doc(`affiliateCodes/${normalizedCode}`);
  const redemptionRef = codeRef.collection('redemptions').doc(uid);

  const updated = await db.runTransaction(async (transaction) => {
    const [subscriptionSnapshot, codeSnapshot, redemptionSnapshot] = await Promise.all([
      transaction.get(subscriptionRef),
      transaction.get(codeRef),
      transaction.get(redemptionRef),
    ]);

    const current = subscriptionSnapshot.exists
      ? (subscriptionSnapshot.data() as UserSubscription)
      : createBaseSubscription(new Date().toISOString());

    if (current.hasAppliedAffiliateCode || redemptionSnapshot.exists) {
      throw new SubscriptionError(409, 'affiliate_code_already_applied', 'A marketer code was already applied to this account.');
    }

    const codeData = codeSnapshot.exists
      ? ({ code: normalizedCode, ...codeSnapshot.data() } as AffiliateCodeRecord)
      : undefined;
    const totalTrialDays = validateAffiliateCodeRecord(codeData, normalizedCode);
    const nowIso = new Date().toISOString();
    const next: UserSubscription = {
      ...current,
      status: current.isPaid ? 'paid' : 'trial',
      totalTrialDays,
      trialExpiresAt: isoAfterDays(current.trialStartedAt, totalTrialDays),
      affiliateCode: normalizedCode,
      affiliateAppliedAt: nowIso,
      hasAppliedAffiliateCode: true,
      monthlyPriceEgp: codeData?.monthlyPriceEgp ?? current.monthlyPriceEgp,
      updatedAt: nowIso,
    };

    if (subscriptionSnapshot.exists) {
      transaction.set(subscriptionRef, next, { merge: true });
    } else {
      transaction.create(subscriptionRef, next);
    }
    transaction.create(redemptionRef, {
      userId: uid,
      code: normalizedCode,
      redeemedAt: nowIso,
    });
    transaction.update(codeRef, {
      redemptionCount: FieldValue.increment(1),
      lastRedeemedAt: nowIso,
    });

    return next;
  });

  return withComputedStatus(updated);
}
