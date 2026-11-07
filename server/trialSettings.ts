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


export type TrialSettingsChange = {
  id: string;
  timestamp: string;
  previous: { proDays: number; basicDays: number };
  next: { proDays: number; basicDays: number };
};
export async function listTrialSettingsHistory(): Promise<TrialSettingsChange[]> {
  const results = await getAdminFirestore().collection('subscriptionTrialsAudit')
    .orderBy('timestamp', 'desc').limit(50).get();
  const changes: TrialSettingsChange[] = [];
  for (const doc of results.docs) {
    const data = doc.data();
    if (data.archivedAt) continue; // Hidden from UI, retained for audit integrity.
    const before = data.previous;
    const after = data.next;
    const beforePro = before?.proDays;
    const beforeBasic = before?.basicDays;
    const afterPro = after?.proDays;
    const afterBasic = after?.basicDays;
    if (![beforePro, beforeBasic, afterPro, afterBasic].every(v => Number.isInteger(v) && v >= 1 && v <= 365)) continue;
    const time = typeof data.timestamp?.toDate === 'function' ? data.timestamp.toDate() : null;
    const timestamp = time && Number.isFinite(time.getTime()) ? time.toISOString()
      : typeof after?.updatedAt === 'string' && Number.isFinite(Date.parse(after.updatedAt)) ? after.updatedAt : null;
    if (!timestamp) continue;
    changes.push({
      id: doc.id,
      timestamp,
      previous: { proDays: beforePro, basicDays: beforeBasic },
      next: { proDays: afterPro, basicDays: afterBasic },
    });
  }
  return changes;
}

/** Hide one historical log entry from the admin UI; retain evidence in Firestore. */
export async function archiveTrialSettingsHistoryEntry(rawId: unknown, adminUid: string): Promise<{ archived: true }> {
  if (typeof rawId !== 'string' || !/^[A-Za-z0-9_-]{10,128}$/.test(rawId)) {
    throw new SubscriptionError(400, 'invalid_history_id', 'Invalid change history ID.');
  }
  const ref = getAdminFirestore().collection('subscriptionTrialsAudit').doc(rawId);
  await getAdminFirestore().runTransaction(async tx => {
    const snapshot = await tx.get(ref);
    if (!snapshot.exists) throw new SubscriptionError(404, 'history_entry_not_found', 'History entry not found.');
    if (snapshot.get('archivedAt')) return;
    tx.update(ref, { archivedAt: FieldValue.serverTimestamp(), archivedBy: adminUid });
  });
  return { archived: true };
}
