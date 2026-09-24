import type { User } from 'firebase/auth';
import { auth } from '../lib/firebase';
import type { UserSubscription } from '../types/subscription';

export type SubscriptionAction = 'subscription.get' | 'subscription.applyAffiliate';

export async function requestSubscription(
  action: SubscriptionAction,
  payload: Record<string, unknown> = {},
  firebaseUser?: User
): Promise<UserSubscription> {
  const user = firebaseUser || auth.currentUser;
  if (!user) {
    throw new Error('سجّل الدخول بحساب Google أولاً.');
  }

  const idToken = await user.getIdToken();
  const response = await fetch('/api/gateway', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ action, payload }),
  });

  let result: any;
  try {
    result = await response.json();
  } catch {
    throw new Error('تعذر الاتصال بخدمة الاشتراك. حاول مرة أخرى.');
  }

  if (!response.ok || result?.ok !== true) {
    throw new Error(
      typeof result?.message === 'string'
        ? result.message
        : 'تعذر تحميل حالة الاشتراك. حاول مرة أخرى.'
    );
  }

  const subscription = result?.data?.subscription;
  if (
    !subscription ||
    typeof subscription.trialExpiresAt !== 'string' ||
    typeof subscription.totalTrialDays !== 'number'
  ) {
    throw new Error('استجابة الاشتراك غير مكتملة. حاول مرة أخرى.');
  }

  return subscription as UserSubscription;
}
