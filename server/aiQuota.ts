import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from './firebaseAdmin.js';
import { SubscriptionError, getOrCreateSubscription } from './subscriptionService.js';
import { readTrialSettings } from './trialSettings.js';
import { stageFor } from '../src/config/subscriptionPolicy.js';
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

function cairoDay(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function validateLimits(value: Record<string, unknown>): AiDailyLimits {
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
  return validateLimits({ ...DEFAULT_AI_DAILY_LIMITS, ...snapshot.data() });
}

export async function saveAiDailyLimits(payload: Record<string, unknown>, adminUid: string): Promise<AiDailyLimits> {
  const next = validateLimits({ ...payload, updatedAt: new Date().toISOString(), updatedBy: adminUid });
  await getAdminFirestore().doc(SETTINGS_PATH).set({
    ...next,
    updatedAtServer: FieldValue.serverTimestamp(),
  }, { merge: false });
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
export async function reserveAiQuota(uid: string, rawText: unknown, forceLocal = false): Promise<AiQuotaDecision> {
  if (typeof rawText !== 'string' || !rawText.trim() || rawText.length > 12000) {
    throw new SubscriptionError(400, 'invalid_ai_input', 'Missing or invalid AI input.');
  }

  const subscription = await getOrCreateSubscription(uid);
  const trials = await readTrialSettings();
  const phase = stageFor(subscription, Date.now(), trials);
  if (phase === 'expired') {
    throw new SubscriptionError(403, 'subscription_expired', 'Your free period has ended. Choose a paid plan to continue.');
  }

  const plan: 'basic' | 'pro' = phase === 'basic-free' ? 'basic' : 'pro';
  const operation: 'entry' | 'inquiry' = isFinancialQueryText(rawText) ? 'inquiry' : 'entry';
  const limits = await readAiDailyLimits();
  const day = cairoDay();
  const counterRef = getAdminFirestore().doc(`users/${uid}/aiUsage/daily_${day}`);

  return getAdminFirestore().runTransaction(async tx => {
    const snapshot = await tx.get(counterRef);
    const current = snapshot.exists ? snapshot.data() || {} : {};
    const attempts: Array<{ engine: 'local' | 'gemini'; key: string; limit: number; fallback: boolean }> =
      plan === 'basic'
        ? [{ engine: 'local', key: `basicLocal${operation === 'entry' ? 'Entries' : 'Inquiries'}`, limit: operation === 'entry' ? limits.basicLocalEntries : limits.basicLocalInquiries, fallback: false }]
        : forceLocal
          ? [{ engine: 'local', key: `proLocal${operation === 'entry' ? 'Entries' : 'Inquiries'}`, limit: operation === 'entry' ? limits.proLocalEntries : limits.proLocalInquiries, fallback: true }]
          : [
              { engine: 'gemini', key: `proGemini${operation === 'entry' ? 'Entries' : 'Inquiries'}`, limit: operation === 'entry' ? limits.proGeminiEntries : limits.proGeminiInquiries, fallback: false },
              { engine: 'local', key: `proLocal${operation === 'entry' ? 'Entries' : 'Inquiries'}`, limit: operation === 'entry' ? limits.proLocalEntries : limits.proLocalInquiries, fallback: true },
            ];

    for (const attempt of attempts) {
      const used = Number(current[attempt.key] || 0);
      if (used < attempt.limit) {
        tx.set(counterRef, {
          date: day,
          timeZone: TIME_ZONE,
          [attempt.key]: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        }, { merge: true });
        return {
          plan, engine: attempt.engine, operation, used: used + 1,
          limit: attempt.limit, remaining: Math.max(0, attempt.limit - used - 1),
          day, fallbackFromGemini: attempt.fallback,
        };
      }
    }

    throw new SubscriptionError(429, 'ai_daily_limit_reached',
      plan === 'pro'
        ? 'You have used today’s Gemini and local analyzer allowances. Try again tomorrow.'
        : 'You have used today’s Basic local analyzer allowance. Try again tomorrow.');
  });
}
