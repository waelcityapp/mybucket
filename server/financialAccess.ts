import { Timestamp } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminFirestore } from './firebaseAdmin.js';
import { SubscriptionError } from './subscriptionService.js';

/**
 * Migration/rollout helper; called by the authenticated subscription.trialSettings
 * gateway action on sign-in. Only Firebase Admin can write billing/access.
 * This intentionally does not mutate the legacy billing/subscription record,
 * financial accounts, balances, or transaction history.
 *
 * Do NOT deploy the draft Rules until every required account can be bootstrapped
 * and emulator/integration tests have passed on the exact database ID.
 */
export async function ensureFirestoreAccessRecord(uid: string): Promise<void> {
  const authRecord = await getAdminAuth().getUser(uid);
  const createdAt = authRecord.metadata.creationTime;
  const parsedCreation = Date.parse(createdAt);
  if (!createdAt || !Number.isFinite(parsedCreation) || parsedCreation > Date.now()) {
    throw new SubscriptionError(503, 'unverified_registration', 'Could not verify the account registration timestamp.');
  }

  const db = getAdminFirestore();
  const billingRef = db.doc(`users/${uid}/billing/subscription`);
  const accessRef = db.doc(`users/${uid}/billing/access`);
  const [billing, access] = await Promise.all([billingRef.get(), accessRef.get()]);
  const currentBilling = billing.exists ? billing.data() : null;

  // Payment entitlements must come exclusively from server-owned billing records.
  // Never derive paid status from user profile fields or a browser-provided value.
  let paidUntil: Timestamp | null = null;
  if (currentBilling?.isPaid === true && typeof currentBilling?.paidExpiresAt === 'string') {
    const paidTime = Date.parse(currentBilling.paidExpiresAt);
    if (Number.isFinite(paidTime)) paidUntil = Timestamp.fromMillis(paidTime);
  }

  const registeredAt = Timestamp.fromMillis(parsedCreation);
  const previous = access.exists ? access.data() : null;
  // Avoid redundant Firestore writes on every app focus/sign-in.
  if (previous?.registeredAt?.toMillis?.() === registeredAt.toMillis()
      && (previous?.paidUntil?.toMillis?.() ?? null) === (paidUntil?.toMillis() ?? null)
      && previous?.schemaVersion === 1) return;

  await accessRef.set({
    registeredAt,
    paidUntil,
    schemaVersion: 1,
    syncedAt: Timestamp.now(),
  }, { merge: true });
}
