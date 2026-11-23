import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from './firebaseAdmin.js';
import { BASIC_FREE_DAYS, isBasicTrialDuration } from '../src/config/subscriptionPolicy.js';
import { SubscriptionError } from './subscriptionService.js';

export type TrialSettings = { basicDays: number; updatedAt: string | null; updatedBy: string | null };
const SETTINGS_PATH = 'appSettings/subscriptionTrials';
export const DEFAULT_TRIAL_SETTINGS: TrialSettings = { basicDays: BASIC_FREE_DAYS, updatedAt: null, updatedBy: null };

// The already-open #292 client checks this field when validating Basic settings.
export function trialSettingsResponse<T extends { basicDays: number }>(settings: T) {
  return { ...settings, proDays: 1 };
}

export async function readTrialSettings(): Promise<TrialSettings> {
  const doc = await getAdminFirestore().doc(SETTINGS_PATH).get();
  if (!doc.exists) return { ...DEFAULT_TRIAL_SETTINGS };
  const data = doc.data();
  const basicDays = data?.basicDays;
  if (!isBasicTrialDuration(basicDays)) {
    throw new SubscriptionError(503, 'invalid_trial_settings', 'Subscription configuration is invalid.');
  }
  return { basicDays, updatedAt: typeof data?.updatedAt === 'string' ? data.updatedAt : null, updatedBy: typeof data?.updatedBy === 'string' ? data.updatedBy : null };
}
export async function saveTrialSettings(payload: Record<string, unknown>, uid: string): Promise<TrialSettings> {
  const basicDays = payload.basicDays;
  if (!isBasicTrialDuration(basicDays)) {
    throw new SubscriptionError(400, 'invalid_trial_duration', 'Basic trial duration must be a whole number from 1 to 365.');
  }
  const db = getAdminFirestore();
  const timestamp = new Date().toISOString();
  const next: TrialSettings = { basicDays, updatedAt: timestamp, updatedBy: uid };
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
  previous: { basicDays: number };
  next: { basicDays: number };
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
    const beforeBasic = before?.basicDays;
    const afterBasic = after?.basicDays;
    if (!isBasicTrialDuration(beforeBasic) || !isBasicTrialDuration(afterBasic) || beforeBasic === afterBasic) continue;
    const time = typeof data.timestamp?.toDate === 'function' ? data.timestamp.toDate() : null;
    const timestamp = time && Number.isFinite(time.getTime()) ? time.toISOString()
      : typeof after?.updatedAt === 'string' && Number.isFinite(Date.parse(after.updatedAt)) ? after.updatedAt : null;
    if (!timestamp) continue;
    changes.push({
      id: doc.id,
      timestamp,
      previous: { basicDays: beforeBasic },
      next: { basicDays: afterBasic },
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
