import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from './firebaseAdmin.js';
import { SubscriptionError } from './subscriptionService.js';

export type AiUsageKind = 'entry' | 'inquiry';

function cairoDateKey(at = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

/**
 * Server-authoritative daily AI quota for Basic users.
 * The browser's localStorage counter remains a UX hint only.
 * Pro trial and paid users are handled by the gateway and do not call this helper.
 */
export async function reserveDailyAiUsage(
  uid: string,
  kind: AiUsageKind,
  rawLimit: number,
): Promise<{ date: string; kind: AiUsageKind; used: number; limit: number; remaining: number }> {
  const limit = Number.isInteger(rawLimit) && rawLimit >= 0 && rawLimit <= 10000 ? rawLimit : (kind === 'entry' ? 15 : 5);
  const date = cairoDateKey();
  const ref = getAdminFirestore().doc(`users/${uid}/aiUsage/daily_${date}`);
  const field = kind === 'entry' ? 'expenseAiCount' : 'inquiryAiCount';

  return getAdminFirestore().runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const current: Record<string, unknown> | undefined = snapshot.exists ? snapshot.data() : undefined;
    const rawUsed = current?.[field];
    const usedBefore = typeof rawUsed === 'number' && Number.isFinite(rawUsed)
      ? Math.max(0, Math.floor(rawUsed))
      : 0;

    if (usedBefore >= limit) {
      throw new SubscriptionError(
        429,
        'ai_daily_limit_reached',
        kind === 'entry'
          ? 'تم استهلاك الحد اليومي للإدخال الذكي. يمكنك استخدام الإدخال اليدوي.'
          : 'تم استهلاك الحد اليومي للاستفسارات الذكية. حاول غدًا.',
      );
    }

    const used = usedBefore + 1;
    transaction.set(ref, {
      date,
      [field]: used,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    return { date, kind, used, limit, remaining: Math.max(0, limit - used) };
  });
}
