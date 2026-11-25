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
 * and dates are deliberately ignored. Pro cloud attempts share one budget,
 * while local counters remain scoped to the plan and operation.
 */
type QuotaDeps = {
  db: ReturnType<typeof getAdminFirestore>;
  getSubscription: typeof getOrCreateSubscription;
  getTrials: typeof readTrialSettings;
  getLimits: typeof readAiDailyLimits;
  now: () => number;
};

function readAnalysisAttempts(data: Record<string, unknown>, key: string): number {
  const used = data[key] ?? 0;
  if (typeof used !== 'number' || !Number.isSafeInteger(used) || used < 0) {
    throw new SubscriptionError(503, 'invalid_quota_counter', 'Unable to verify usage.');
  }
  return used;
}

function readProAiAttempts(data: Record<string, unknown>): number {
  return readAnalysisAttempts(data, 'proGeminiEntries') + readAnalysisAttempts(data, 'proGeminiInquiries');
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
    const used = readAnalysisAttempts(data, key);
    return { used, limit, remaining: Math.max(0, limit - used) };
  };
  const caps = !deps && plan !== 'expired' ? publishedPlanLimits(await db.doc(PUBLISHED_PLAN_LIMITS_PATH).get()) : null;
  const savedEntries = !deps && plan !== 'expired' ? await (async () => {
    const entryCounter = await db.doc(`users/${uid}/entryUsage/${day}`).get();
    const entries = (key: 'basic' | 'pro', limit?: number) => {
      const used = readSavedEntryCount(entryCounter, key);
      return { used, limit: limit ?? null, remaining: limit === undefined ? null : Math.max(0, limit - used) };
    };
    return plan === 'basic'
      ? { basic: entries('basic', caps?.basicEntries) }
      : { pro: entries('pro', caps?.proEntries) };
  })() : null;
  const limit = caps?.proAiAttempts ?? limits.proGeminiEntries + limits.proGeminiInquiries;
  const used = plan === 'pro' ? readProAiAttempts(data) : 0;
  return {
    day, plan,
    ...(savedEntries ? { savedEntries } : {}),
    ...(plan === 'pro' ? { aiAttempts: { used, limit, remaining: Math.max(0, limit - used) } } : {}),
    ...(plan === 'basic' ? { local: { entries: bucket('basicLocalEntries'), inquiries: bucket('basicLocalInquiries') } } : {}),
  };
}
export async function reserveAiQuota(uid: string, rawText: unknown, forceLocal = false, deps?: QuotaDeps): Promise<AiQuotaDecision> {
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
    const cloud = plan === 'pro' && !forceLocal;
    const basicInquiry = plan === 'basic' && operation === 'inquiry';
    const policy = !deps && (cloud || basicInquiry)
      ? publishedPlanLimits(await tx.get(db.doc(PUBLISHED_PLAN_LIMITS_PATH)))
      : null;
    const suffix = operation === 'entry' ? 'Entries' : 'Inquiries';
    const localKey = `${plan}Local${suffix}` as const;
    const counterKey = cloud ? `proGemini${suffix}` : localKey;
    const limit = cloud
      ? policy?.proAiAttempts ?? limits.proGeminiEntries + limits.proGeminiInquiries
      : (basicInquiry ? policy?.basicInquiries : undefined) ?? limits[localKey];
    const inquiryKey = basicInquiry && policy ? 'basicPlanInquiries' : null;
    const used = cloud ? readProAiAttempts(current) : readAnalysisAttempts(current, inquiryKey ?? counterKey);

    if (used < limit) {
      tx.set(counterRef, {
        date: day,
        timeZone: TIME_ZONE,
        [counterKey]: FieldValue.increment(1),
        ...(inquiryKey ? { [inquiryKey]: FieldValue.increment(1) } : {}),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      return {
        plan, engine: cloud ? 'gemini' : 'local', operation, used: used + 1,
        limit, remaining: limit - used - 1, day, fallbackFromGemini: plan === 'pro' && forceLocal,
      };
    }
    if (inquiryKey) throw new SubscriptionError(429, 'plan_inquiry_limit', 'انتهت حصة الاستعلامات اليومية، وتتجدد غدًا.');
    throw new SubscriptionError(429, 'ai_daily_limit_reached',
      forceLocal || plan === 'basic' ? 'انتهى الحد اليومي للمحلل المحلي، ويتجدد غدًا.' : 'انتهى حد الذكاء الاصطناعي اليومي.');
  });
}
