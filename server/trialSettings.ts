import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from './firebaseAdmin.js';
import { SubscriptionError } from './subscriptionService.js';

export type TrialSettings = { proDays: number; basicDays: number; updatedAt: string | null; updatedBy: string | null };
const SETTINGS_PATH = 'appSettings/subscriptionTrials';
export const DEFAULT_TRIAL_SETTINGS: TrialSettings = { proDays: 15, basicDays: 75, updatedAt: null, updatedBy: null };

export async function readTrialSettings(): Promise<TrialSettings> {
  const doc = await getAdminFirestore().doc(SETTINGS_PATH).get();
  if (!doc.exists) return { ...DEFAULT_TRIAL_SETTINGS };
  const data = doc.data();
  const proDays = data?.proDays;
  const basicDays = data?.basicDays;
  if (!Number.isInteger(proDays) || !Number.isInteger(basicDays) || proDays < 1 || basicDays < proDays || basicDays > 365) {
    throw new SubscriptionError(503, 'invalid_trial_settings', 'Subscription configuration is invalid.');
  }
  return { proDays, basicDays, updatedAt: typeof data?.updatedAt === 'string' ? data.updatedAt : null, updatedBy: typeof data?.updatedBy === 'string' ? data.updatedBy : null };
}
export async function saveTrialSettings(payload: Record<string, unknown>, uid: string): Promise<TrialSettings> {
  const proDays = payload.proDays;
  const basicDays = payload.basicDays;
  if (!Number.isInteger(proDays) || !Number.isInteger(basicDays) ||
      (proDays as number) < 1 || (proDays as number) > 365 ||
      (basicDays as number) < (proDays as number) || (basicDays as number) > 365) {
    throw new SubscriptionError(400, 'invalid_trial_duration', 'Pro days must be 1–365 and Basic must be between Pro days and 365.');
  }
  const db = getAdminFirestore();
  const timestamp = new Date().toISOString();
  const next: TrialSettings = { proDays: proDays as number, basicDays: basicDays as number, updatedAt: timestamp, updatedBy: uid };
  await db.runTransaction(async tx => {
    const ref = db.doc(SETTINGS_PATH);
    const previous = await tx.get(ref);
    const audit = db.collection('subscriptionTrialsAudit').doc();
    tx.set(ref, { ...next, updatedAtServer: FieldValue.serverTimestamp() }, { merge: true });
    tx.create(audit, { previous: previous.exists ? previous.data() : DEFAULT_TRIAL_SETTINGS, next, adminUid: uid, timestamp: FieldValue.serverTimestamp() });
  });
  return next;
}
