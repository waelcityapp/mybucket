import { DEFAULT_PLAN_LIMITS } from '../src/config/planLimits.js';
import { grantFromAccess } from '../src/config/grantPolicy.js';
import { stageFor } from '../src/config/subscriptionPolicy.js';
import { getAdminFirestore } from './firebaseAdmin.js';
import { PUBLISHED_PLAN_LIMITS_PATH, publishedPlanLimits } from './planLimits.js';
import { getOrCreateSubscription, SubscriptionError } from './subscriptionService.js';
import { readTrialSettings } from './trialSettings.js';

export async function reserveReportExport(uid: string, format: unknown) {
  if (format !== 'csv' && format !== 'pdf') {
    throw new SubscriptionError(400, 'invalid_report_format', 'Invalid report format.');
  }
  const db = getAdminFirestore();
  const user = db.collection('users').doc(uid);
  const trialSettings = await readTrialSettings();
  await getOrCreateSubscription(uid, trialSettings, true);

  return db.runTransaction(async tx => {
    const now = new Date();
    const day = now.toLocaleDateString('sv-SE', { timeZone: 'Africa/Cairo' });
    const usageRef = user.collection('reportUsage').doc(day);
    const [policy, subscription, access, usage] = await Promise.all([
      tx.get(db.doc(PUBLISHED_PLAN_LIMITS_PATH)),
      tx.get(user.collection('billing').doc('subscription')),
      tx.get(user.collection('billing').doc('access')),
      tx.get(usageRef),
    ]);
    if (!subscription.exists || !access.exists) {
      throw new SubscriptionError(503, 'access_record_missing', 'Unable to verify subscription access.');
    }
    const data = subscription.data()!;
    const phase = stageFor({
      trialStartedAt: data.trialStartedAt,
      isPaid: data.isPaid === true,
      paidPlan: data.paidPlan,
      paidExpiresAt: data.paidExpiresAt,
      grant: grantFromAccess(access.data() ?? null),
    }, now.getTime(), trialSettings);
    if (phase !== 'paid' && phase !== 'pro-trial') {
      throw new SubscriptionError(403, 'pro_plan_required', 'Exports require an active Pro plan.');
    }
    const limit = (publishedPlanLimits(policy) ?? DEFAULT_PLAN_LIMITS).proExports;
    const count = usage.get('count') ?? 0;
    if (!Number.isSafeInteger(count) || count < 0) {
      throw new SubscriptionError(503, 'invalid_export_counter', 'Unable to verify export usage.');
    }
    if (count >= limit) throw new SubscriptionError(429, 'report_export_limit', 'Daily export limit reached.');
    tx.set(usageRef, { count: count + 1 });
    return { remaining: limit - count - 1 };
  });
}
