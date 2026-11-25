import { createHash } from 'node:crypto';
import { PUBLISHED_PLAN_LIMITS_PATH, publishedPlanLimits } from './planLimits.js';
import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminFirestore } from './firebaseAdmin.js';
import { SubscriptionError, getOrCreateSubscription } from './subscriptionService.js';
import { readTrialSettings } from './trialSettings.js';
import { stageFor } from '../src/config/subscriptionPolicy.js';
import { grantFromAccess } from '../src/config/grantPolicy.js';
import { isFinancialQueryText } from '../src/utils/semanticParser.js';

export type AiDailyLimits = {
  basicLocalEntries: number;
  basicLocalInquiries: number;
  proGeminiEntries: number;
  proGeminiInquiries: number;
  proLocalEntries: number;
  proLocalInquiries: number;
  updatedAt: string | null;
  updatedBy: string | null;
};

export const DEFAULT_AI_DAILY_LIMITS: AiDailyLimits = {
  basicLocalEntries: 10,
  basicLocalInquiries: 2,
  proGeminiEntries: 15,
  proGeminiInquiries: 5,
  proLocalEntries: 30,
  proLocalInquiries: 10,
  updatedAt: null,
  updatedBy: null,
};

const SETTINGS_PATH = 'appSettings/aiDailyLimits';
const TIME_ZONE = 'Africa/Cairo';

export function cairoDay(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function validateAiDailyLimits(value: Record<string, unknown>): AiDailyLimits {
  const keys = [
    'basicLocalEntries', 'basicLocalInquiries', 'proGeminiEntries',
    'proGeminiInquiries', 'proLocalEntries', 'proLocalInquiries',
  ] as const;
  for (const key of keys) {
    if (!Number.isInteger(value[key]) || (value[key] as number) < 0 || (value[key] as number) > 10000) {
      throw new SubscriptionError(400, 'invalid_ai_daily_limits', 'Daily AI limits must be whole numbers from 0 to 10000.');
    }
  }
  return {
    basicLocalEntries: value.basicLocalEntries as number,
    basicLocalInquiries: value.basicLocalInquiries as number,
    proGeminiEntries: value.proGeminiEntries as number,
    proGeminiInquiries: value.proGeminiInquiries as number,
    proLocalEntries: value.proLocalEntries as number,
    proLocalInquiries: value.proLocalInquiries as number,
    updatedAt: typeof value.updatedAt === 'string' ? value.updatedAt : null,
    updatedBy: typeof value.updatedBy === 'string' ? value.updatedBy : null,
  };
}

export async function readAiDailyLimits(): Promise<AiDailyLimits> {
  const snapshot = await getAdminFirestore().doc(SETTINGS_PATH).get();
  if (!snapshot.exists) return { ...DEFAULT_AI_DAILY_LIMITS };
  return validateAiDailyLimits({ ...DEFAULT_AI_DAILY_LIMITS, ...snapshot.data() });
}

export async function saveAiDailyLimits(payload: Record<string, unknown>, adminUid: string): Promise<AiDailyLimits> {
  const next = validateAiDailyLimits({ ...payload, updatedAt: new Date().toISOString(), updatedBy: adminUid });
  await getAdminFirestore().doc(SETTINGS_PATH).set({
    ...next,
    updatedAtServer: FieldValue.serverTimestamp(),
  }, { merge: true });
  return next;
}

export type AiQuotaDecision = {
  plan: 'basic' | 'pro';
  engine: 'local' | 'gemini';
  operation: 'entry' | 'inquiry';
  used: number;
  limit: number;
  remaining: number;
  day: string;
  fallbackFromGemini: boolean;
};

/**
 * Server-authoritative quota reservation. Client-supplied plan, engine, counters,
 * and dates are deliberately ignored. Each plan/engine/operation has its own
 * counter, so switching plans cannot replenish an earlier bucket.
 */
type QuotaDeps = {
  db: ReturnType<typeof getAdminFirestore>;
  getSubscription: typeof getOrCreateSubscription;
  getTrials: typeof readTrialSettings;
  getLimits: typeof readAiDailyLimits;
  now: () => number;
};

export function proGeminiEntryLimit(limits: AiDailyLimits, publishedLimit?: number) {
  return Math.min(limits.proGeminiEntries, publishedLimit ?? limits.proGeminiEntries);
}


export function readSavedEntryCount(snapshot: { get(key: string): unknown }, key: 'basic' | 'proAi' | 'proAdditional' | 'pro'): number {
  if (key === 'pro') {
    const total = readSavedEntryCount(snapshot, 'proAi') + readSavedEntryCount(snapshot, 'proAdditional');
    if (Number.isSafeInteger(total)) return total;
    throw new SubscriptionError(503, 'invalid_entry_counter', 'Unable to verify usage.');
  }
  const used = snapshot.get(key) ?? 0;
  if (typeof used !== 'number' || !Number.isSafeInteger(used) || used < 0) {
    throw new SubscriptionError(503, 'invalid_entry_counter', 'Unable to verify usage.');
  }
  return used;
}

/** Read-only snapshot for the authenticated user's settings screen. */
export async function readOwnAiQuota(uid: string, deps?: { db: ReturnType<typeof getAdminFirestore>; getTrials: typeof readTrialSettings; getLimits: typeof readAiDailyLimits; getRegistration: (uid: string) => Promise<string>; now: () => number }) {
  const db = deps?.db || getAdminFirestore();
  const now = deps?.now() ?? Date.now();
  const day = cairoDay(new Date(now));
  const [trials, limits, access, billing, counter] = await Promise.all([
    (deps?.getTrials || readTrialSettings)(), (deps?.getLimits || readAiDailyLimits)(),
    db.doc(`users/${uid}/billing/access`).get(), db.doc(`users/${uid}/billing/subscription`).get(), db.doc(`users/${uid}/aiUsage/daily_${day}`).get(),
  ]);
  if (!access.exists) throw new SubscriptionError(503, 'access_record_missing', 'Unable to verify account access.');
  const registered = billing.exists ? '' : await (deps?.getRegistration || (async id => (await getAdminAuth().getUser(id)).metadata.creationTime))(uid);
  const sub = billing.exists ? billing.data() || {} : { trialStartedAt: registered, isPaid: false };
  if (typeof sub.trialStartedAt !== 'string' || !Number.isFinite(Date.parse(sub.trialStartedAt))) throw new SubscriptionError(503, 'invalid_subscription_dates', 'Unable to verify the subscription start.');
  const phase = stageFor({ trialStartedAt: sub.trialStartedAt, isPaid: sub.isPaid === true, paidPlan: sub.paidPlan === 'basic' ? 'basic' : 'pro', paidExpiresAt: typeof sub.paidExpiresAt === 'string' ? sub.paidExpiresAt : null, grant: grantFromAccess(access.data() || null) }, now, trials);
  const plan = phase === 'expired' ? 'expired' : phase === 'paid' || phase === 'pro-trial' ? 'pro' : 'basic';
  const data = counter.exists ? counter.data() || {} : {};
  const bucket = (key: keyof AiDailyLimits, limit = limits[key] as number) => {
    const used = data[key] ?? 0;
    if (!Number.isSafeInteger(used) || used < 0) throw new SubscriptionError(503, 'invalid_quota_counter', 'Unable to verify usage.');
    return { used, limit, remaining: Math.max(0, limit - used) };
  };
  const savedEntries = !deps && plan !== 'expired' ? await (async () => {
    const [policy, entryCounter] = await Promise.all([
      db.doc(PUBLISHED_PLAN_LIMITS_PATH).get(),
      db.doc(`users/${uid}/entryUsage/${day}`).get(),
    ]);
    const caps = publishedPlanLimits(policy);
    const entries = (key: 'basic' | 'pro', limit?: number) => {
      const used = readSavedEntryCount(entryCounter, key);
      return { used, limit: limit ?? null, remaining: limit === undefined ? null : Math.max(0, limit - used) };
    };
    return plan === 'basic'
      ? { basic: entries('basic', caps?.basicEntries) }
      : { pro: entries('pro', caps?.proEntries), geminiAttempts: bucket('proGeminiEntries', proGeminiEntryLimit(limits, caps?.proAiEntries)) };
  })() : null;
  return { day, plan, ...(savedEntries ? { savedEntries } : {}), ...(plan === 'basic' ? { local: { entries: bucket('basicLocalEntries'), inquiries: bucket('basicLocalInquiries') } } : plan === 'pro' ? { gemini: { entries: bucket('proGeminiEntries'), inquiries: bucket('proGeminiInquiries') }, local: { entries: bucket('proLocalEntries'), inquiries: bucket('proLocalInquiries') } } : {}) };
}
export async function reserveAiQuota(uid: string, rawText: unknown, forceLocal = false, deps?: QuotaDeps, inquiryRequestId?: unknown): Promise<AiQuotaDecision> {
  if (typeof rawText !== 'string' || !rawText.trim() || rawText.length > 300) {
    throw new SubscriptionError(400, 'invalid_ai_input', 'Missing or invalid AI input.');
  }

  const trials = await (deps?.getTrials || readTrialSettings)();
  const subscription = await (deps?.getSubscription || getOrCreateSubscription)(uid, trials, true);
  const now = deps?.now() ?? Date.now();
  const operation: 'entry' | 'inquiry' = isFinancialQueryText(rawText) ? 'inquiry' : 'entry';
  const limits = await (deps?.getLimits || readAiDailyLimits)();
  const day = cairoDay(new Date(now));
  const db = deps?.db || getAdminFirestore();
  const counterRef = db.doc(`users/${uid}/aiUsage/daily_${day}`);
  const accessRef = db.doc(`users/${uid}/billing/access`);
  const subscriptionRef = db.doc(`users/${uid}/billing/subscription`);

  return db.runTransaction(async tx => {
    const [snapshot, access, billing] = await Promise.all([tx.get(counterRef), tx.get(accessRef), tx.get(subscriptionRef)]);
    if (!access.exists || !billing.exists) throw new SubscriptionError(503, 'access_record_missing', 'تعذر التحقق من صلاحية الحساب.');
    const effective = { ...subscription, ...billing.data(), grant: grantFromAccess(access.data() || null) };
    const phase = stageFor(effective, deps?.now() ?? Date.now(), trials);
    if (phase === 'expired') throw new SubscriptionError(403, 'subscription_expired', 'انتهت صلاحية الاستخدام. بياناتك محفوظة ويمكنك اختيار خطة للمتابعة.');
    const plan: 'basic' | 'pro' = phase === 'paid' || phase === 'pro-trial' ? 'pro' : 'basic';
    if (plan === 'basic' && !forceLocal) throw new SubscriptionError(403, 'pro_plan_required', 'AI is available on Pro; Basic uses the local analyzer.');
    const current = snapshot.exists ? snapshot.data() || {} : {};
    const policy = !deps && (operation === 'inquiry' || (plan === 'pro' && !forceLocal))
      ? publishedPlanLimits(await tx.get(db.doc(PUBLISHED_PLAN_LIMITS_PATH)))
      : null;
    const inquiryCap = operation === 'inquiry' && policy ? (plan === 'basic' ? policy.basicInquiries : policy.proInquiries) : null;
    const inquiryKey = plan === 'basic' ? 'basicPlanInquiries' : 'proPlanInquiries';
    const totalInquiries = current[inquiryKey] ?? 0;
    const requestKey = typeof inquiryRequestId === 'string' && /^[a-f0-9-]{36}$/i.test(inquiryRequestId) ? inquiryRequestId : null;
    const receiptRef = inquiryCap !== null && plan === 'pro' && requestKey
      ? counterRef.collection('inquiries').doc(requestKey)
      : null;
    const receipt = receiptRef ? await tx.get(receiptRef) : null;
    const fingerprint = receiptRef ? createHash('sha256').update(rawText).digest('hex') : null;
    const continuingLocally = forceLocal && receipt?.get('fingerprint') === fingerprint && receipt?.get('awaitsLocal') === true;
    if (inquiryCap !== null && (!Number.isSafeInteger(totalInquiries) || totalInquiries < 0)) {
      throw new SubscriptionError(503, 'invalid_quota_counter', 'Unable to verify usage.');
    }
    if (inquiryCap !== null && totalInquiries >= inquiryCap && !continuingLocally) {
      throw new SubscriptionError(429, 'plan_inquiry_limit', 'انتهت حصة الاستعلامات اليومية، وتتجدد غدًا.');
    }
    const attempts: Array<{ engine: 'local' | 'gemini'; key: string; limit: number; fallback: boolean }> =
      plan === 'basic'
        ? [{ engine: 'local', key: `basicLocal${operation === 'entry' ? 'Entries' : 'Inquiries'}`, limit: operation === 'entry' ? limits.basicLocalEntries : limits.basicLocalInquiries, fallback: false }]
        : forceLocal
          ? [{ engine: 'local', key: `proLocal${operation === 'entry' ? 'Entries' : 'Inquiries'}`, limit: operation === 'entry' ? limits.proLocalEntries : limits.proLocalInquiries, fallback: true }]
          : [
              { engine: 'gemini', key: `proGemini${operation === 'entry' ? 'Entries' : 'Inquiries'}`, limit: operation === 'entry' ? proGeminiEntryLimit(limits, policy?.proAiEntries) : limits.proGeminiInquiries, fallback: false },
            ];

    for (const attempt of attempts) {
      const used = Number(current[attempt.key] || 0);
      const localInquiry = inquiryCap !== null && attempt.engine === 'local';
      const limit = localInquiry ? inquiryCap : attempt.limit;
      const usedForDisplay = localInquiry ? totalInquiries : used;
      if (localInquiry || used < attempt.limit) {
        tx.set(counterRef, {
          date: day,
          timeZone: TIME_ZONE,
          [attempt.key]: FieldValue.increment(1),
          ...(inquiryCap !== null && !continuingLocally ? { [inquiryKey]: FieldValue.increment(1) } : {}),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        if (receiptRef && (!forceLocal || continuingLocally)) {
          tx.set(receiptRef, { fingerprint, awaitsLocal: !forceLocal });
        }
        const nextUsed = usedForDisplay + (localInquiry && continuingLocally ? 0 : 1);
        return {
          plan, engine: attempt.engine, operation, used: nextUsed,
          limit, remaining: Math.max(0, limit - nextUsed),
          day, fallbackFromGemini: attempt.fallback,
        };
      }
    }

    throw new SubscriptionError(429, 'ai_daily_limit_reached',
      forceLocal || plan === 'basic' ? 'انتهى الحد اليومي للمحلل المحلي، ويتجدد غدًا.' : 'انتهى حد الذكاء الاصطناعي اليومي.');
  });
}
