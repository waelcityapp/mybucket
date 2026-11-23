import type { Request } from 'express';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminFirestore } from './firebaseAdmin.js';
import type { AffiliateCodeRecord, UserSubscription } from '../src/types/subscription';
import { PRO_PRICE_EGP, addDays, stageFor, type TrialDurations } from '../src/config/subscriptionPolicy.js';
import { grantFromAccess } from '../src/config/grantPolicy.js';

const DEFAULT_MONTHLY_PRICE_EGP = PRO_PRICE_EGP;
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

  // A Vercel Function has no Google Cloud Application Default Credentials.
  // Check the server configuration before attempting token verification.
  if (process.env.VERCEL === '1') {
    const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
    if (!projectId || !clientEmail || !privateKey) {
      throw new SubscriptionError(
        503,
        'firebase_admin_not_configured',
        'خدمة الاشتراكات تحتاج ضبط بيانات Firebase Admin على Vercel.'
      );
    }

    const browserProjectId = process.env.VITE_FIREBASE_PROJECT_ID;
    if (browserProjectId && projectId !== browserProjectId) {
      throw new SubscriptionError(
        503,
        'firebase_project_mismatch',
        'إعدادات Firebase على الخادم لا تطابق مشروع تسجيل الدخول.'
      );
    }

    const browserDatabaseId = process.env.VITE_FIREBASE_DATABASE_ID || '(default)';
    const adminDatabaseId = process.env.FIREBASE_ADMIN_DATABASE_ID || '(default)';
    if (browserDatabaseId !== adminDatabaseId) {
      throw new SubscriptionError(
        503,
        'firebase_database_mismatch',
        'إعداد قاعدة بيانات الاشتراكات على الخادم لا يطابق قاعدة بيانات التطبيق.'
      );
    }
  }

  try {
    const decoded = await getAdminAuth().verifyIdToken(match[1], true);
    return { uid: decoded.uid, email: decoded.email_verified === true ? (decoded.email || null) : null };
  } catch {
    throw new SubscriptionError(401, 'invalid_authentication', 'The Firebase ID token is invalid or expired.');
  }
}

function createBaseSubscription(nowIso: string, basicDays: number): UserSubscription {
  return {
    status: 'trial',
    trialStartedAt: nowIso,
    trialExpiresAt: addDays(nowIso, basicDays),
    totalTrialDays: basicDays,
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

function withComputedStatus(subscription: UserSubscription, durations: TrialDurations): UserSubscription {
  const phase = stageFor(subscription, Date.now(), durations);
  return { ...subscription, status: (phase === 'paid' || phase === 'paid-basic') ? 'paid' : phase === 'expired' ? 'expired' : 'trial' };
}

export async function getOrCreateSubscription(uid: string, knownDurations?: TrialDurations, requireAccess = false): Promise<UserSubscription> {
  const { readTrialSettings } = await import('./trialSettings.js');
  const durations = knownDurations || await readTrialSettings();
  const db = getAdminFirestore();
  const subscriptionRef = db.doc(`users/${uid}/billing/subscription`);
  const [snapshot, access] = await Promise.all([subscriptionRef.get(), db.doc(`users/${uid}/billing/access`).get()]);
  if (requireAccess && !access.exists) throw new SubscriptionError(503, 'access_record_missing', 'تعذر التحقق من صلاحية الحساب.');
  const grant = grantFromAccess(access.exists ? access.data() || null : null);
  if (snapshot.exists) {
    const stored = snapshot.data() as UserSubscription;
    return withComputedStatus({
      ...stored,
      grant,
      totalTrialDays: durations.basicDays,
      trialExpiresAt: addDays(stored.trialStartedAt, durations.basicDays),
    }, durations);
  }
  // Never start a fresh trial on a returning account with a missing billing document.
  const authUser = await getAdminAuth().getUser(uid);
  const registered = authUser.metadata.creationTime;
  if (!registered || !Number.isFinite(Date.parse(registered)))
    throw new SubscriptionError(503, 'missing_registration_date', 'Account registration date is unavailable.');
  const created = createBaseSubscription(new Date(registered).toISOString(), durations.basicDays);
  try {
    await subscriptionRef.create(created);
  } catch (error: unknown) {
    if (!(error && typeof error === 'object' && 'code' in error &&
      (error.code === 6 || error.code === 'already-exists'))) throw error;
  }
  const latest = await subscriptionRef.get();
  const stored = latest.exists ? latest.data() as UserSubscription : created;
  return withComputedStatus({
    ...stored,
    grant,
    totalTrialDays: durations.basicDays,
    trialExpiresAt: addDays(stored.trialStartedAt, durations.basicDays),
  }, durations);
}

function validateAffiliateCodeRecord(data: AffiliateCodeRecord | undefined) {
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

}

export async function applyAffiliateCode(
  uid: string,
  rawCode: unknown,
  getRegistration = async (userId: string) => (await getAdminAuth().getUser(userId)).metadata.creationTime,
): Promise<UserSubscription> {
  const normalizedCode = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
  if (!CODE_PATTERN.test(normalizedCode)) {
    throw new SubscriptionError(400, 'affiliate_code_invalid_format', 'Enter a valid marketer code.');
  }

  const { readTrialSettings } = await import('./trialSettings.js');
  const durations = await readTrialSettings();
  const db = getAdminFirestore();
  const subscriptionRef = db.doc(`users/${uid}/billing/subscription`);
  const codeRef = db.doc(`affiliateCodes/${normalizedCode}`);
  const redemptionRef = codeRef.collection('redemptions').doc(uid);

  const accountCreationTime = await getRegistration(uid);
  if (!Number.isFinite(Date.parse(accountCreationTime))) throw new SubscriptionError(503, 'missing_registration_date', 'Account registration date is unavailable.');
  const access = await db.doc(`users/${uid}/billing/access`).get();
  return db.runTransaction(async (transaction) => {
    const [subscriptionSnapshot, codeSnapshot, redemptionSnapshot] = await Promise.all([
      transaction.get(subscriptionRef),
      transaction.get(codeRef),
      transaction.get(redemptionRef),
    ]);

    const current = subscriptionSnapshot.exists
      ? (subscriptionSnapshot.data() as UserSubscription)
      : createBaseSubscription(new Date(accountCreationTime).toISOString(), durations.basicDays);

    if (current.hasAppliedAffiliateCode || redemptionSnapshot.exists) {
      throw new SubscriptionError(409, 'affiliate_code_already_applied', 'A marketer code was already applied to this account.');
    }

    const codeData = codeSnapshot.exists
      ? ({ code: normalizedCode, ...codeSnapshot.data() } as AffiliateCodeRecord)
      : undefined;
    validateAffiliateCodeRecord(codeData);
    const nowIso = new Date().toISOString();
    const discount = {
      affiliateCode: normalizedCode,
      affiliateAppliedAt: nowIso,
      hasAppliedAffiliateCode: true,
      monthlyPriceEgp: codeData?.monthlyPriceEgp ?? current.monthlyPriceEgp,
      updatedAt: nowIso,
    };
    const next: UserSubscription = { ...current, ...discount };
    const response = withComputedStatus({
      ...next,
      grant: grantFromAccess(access.data() || null),
      totalTrialDays: durations.basicDays,
      trialExpiresAt: addDays(next.trialStartedAt, durations.basicDays),
    }, durations);
    if (subscriptionSnapshot.exists) {
      transaction.update(subscriptionRef, discount);
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

    return response;
  });
}
