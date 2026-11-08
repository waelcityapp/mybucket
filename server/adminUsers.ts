import { FieldValue } from 'firebase-admin/firestore';
import { getAdminApp, getAdminAuth, getAdminFirestore } from './firebaseAdmin.js';
import { getDatabaseWithUrl } from 'firebase-admin/database';
import { SubscriptionError } from './subscriptionService.js';
import { stageFor, type TrialDurations } from '../src/config/subscriptionPolicy.js';
import { readTrialSettings } from './trialSettings.js';

const OWNER_EMAIL = 'waelvts@gmail.com';
const MAX_USERS_TO_COUNT = 5000;
const MAX_USER_ROWS = 200;

type AdminActor = { uid: string; email: string | null };
type SubscriptionInfo = {
  isPaid?: boolean;
  status?: string;
  trialStartedAt?: string;
  trialExpiresAt?: string;
  paidExpiresAt?: string | null;
  planId?: string;
  planName?: string;
  plan?: string;
  totalTrialDays?: number;
};
function mustBeOwner(actor: AdminActor) {
  if (actor.email?.trim().toLowerCase() !== OWNER_EMAIL) {
    throw new SubscriptionError(403, 'admin_only', 'Only the approved app owner can manage users.');
  }
}
function subscriptionLabel(record: SubscriptionInfo | undefined, durations: TrialDurations, registrationDate: string | null) {
  if (!record && !registrationDate) return { tier: 'unknown', plan: 'Registration date unavailable' };
  const phase = stageFor({ trialStartedAt: record?.trialStartedAt || registrationDate || '', isPaid: record?.isPaid === true, paidExpiresAt: record?.paidExpiresAt }, Date.now(), durations);
  if (phase === 'paid') return { tier: 'paid', plan: record?.planName || record?.planId || record?.plan || 'Pro' };
  if (phase === 'pro-trial') return { tier: 'trial', plan: 'Pro trial (first ' + durations.proDays + ' days)' };
  if (phase === 'basic-free') return { tier: 'trial', plan: 'Basic introductory (until day ' + durations.basicDays + ')' };
  return { tier: 'free', plan: 'Introductory period ended' };
}

/** Auth is the source of truth for registered accounts and disabled status.
 *  Limit is explicit, not silently presented as an exhaustive result.
 */
export async function listAppUsers(actor: AdminActor) {
  mustBeOwner(actor);
  const auth = getAdminAuth();
  const db = getAdminFirestore();
  const durations = await readTrialSettings();
  const users: Array<{
    uid: string;
    name: string;
    email: string;
    createdAt: string | null;
    lastSignInAt: string | null;
    disabled: boolean;
  }> = [];
  let cursor: string | undefined;
  let hasMore = false;
  do {
    const chunk = await auth.listUsers(1000, cursor);
    for (const record of chunk.users) {
      users.push({
        uid: record.uid,
        name: record.displayName || '',
        email: record.email || '',
        createdAt: record.metadata.creationTime || null,
        lastSignInAt: record.metadata.lastSignInTime || null,
        disabled: record.disabled,
      });
    }
    cursor = chunk.pageToken;
    hasMore = Boolean(cursor);
  } while (cursor && users.length < MAX_USERS_TO_COUNT);

  users.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  const visible = users.slice(0, MAX_USER_ROWS);
  const rows = [];
  const realtime = getDatabaseWithUrl('https://mybucket-8b6f0-default-rtdb.europe-west1.firebasedatabase.app', getAdminApp());
  for (let i = 0; i < visible.length; i += 40) {
    const batch = visible.slice(i, i + 40);
    const [subscriptions, installations, presence, realtimePresence] = await Promise.all([
      db.getAll(...batch.map(u => db.doc('users/' + u.uid + '/billing/subscription'))),
      db.getAll(...batch.map(u => db.doc('users/' + u.uid + '/telemetry/pwaInstall'))),
      db.getAll(...batch.map(u => db.doc('users/' + u.uid + '/telemetry/presence'))),
      Promise.all(batch.map(async u => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          return await Promise.race([
            realtime.ref('presence/' + u.uid).get(),
            new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 3000); }),
          ]);
        } catch (error) { console.warn('[admin-users] Presence unavailable:', error); return null; }
        finally { if (timer) clearTimeout(timer); }
      })),
    ]);
    for (let j = 0; j < batch.length; j++) {
      const sub = subscriptions[j].exists ? subscriptions[j].data() as SubscriptionInfo : undefined;
      const lastSeenDate = presence[j].data()?.lastSeenAt?.toDate?.();
      const lastSeenMs = lastSeenDate instanceof Date && Number.isFinite(lastSeenDate.getTime()) ? lastSeenDate.getTime() : null;
      const presenceAvailable = realtimePresence[j] !== null;
      const live = realtimePresence[j]?.val() || {};
      const sessions = Object.values(live.sessions || {}) as Array<{ device?: string; since?: number }>;
      const devices = Array.from(new Set(sessions.map(s => ['mobile', 'computer', 'unknown'].includes(s.device || '') ? s.device : 'unknown')));
      const recentConnection = sessions.reduce((latest, session) => Math.max(latest, typeof session.since === 'number' ? session.since : 0), 0);
      const recentTime = typeof live.lastSeen?.at === 'number' ? live.lastSeen.at : 0;
      const currentLastSeen = Math.max(recentConnection, recentTime);
      rows.push({
        ...batch[j],
        ...subscriptionLabel(sub, durations, batch[j].createdAt),
        installed: installations[j].exists,
        lastSeenAt: sessions.length ? new Date().toISOString() : currentLastSeen ? new Date(currentLastSeen).toISOString() : lastSeenMs === null ? null : new Date(lastSeenMs).toISOString(),
        lastSeenDevice: recentConnection >= recentTime && recentConnection ? sessions.find(s => s.since === recentConnection)?.device || 'unknown' : live.lastSeen?.device || 'unknown',
        online: presenceAvailable ? !batch[j].disabled && sessions.length > 0 : null,
        onlineDevices: devices,
      });
    }
  }
  const metrics = await db.doc('systemStats/pwaInstall').get();
  const installationsCount = Number(metrics.data()?.count || 0);
  return {
    registeredCount: users.length,
    registeredCountComplete: !hasMore,
    installsWithSignedInAccounts: Math.max(0, installationsCount),
    installsTrackingFrom: '2026-11-06',
    displayedCount: rows.length,
    users: rows,
    note: 'Install count covers unique authenticated accounts with a recorded appinstalled event or standalone launch, starting with this release. It excludes guest installs, older installs without a later standalone launch, and multiple devices per account.',
  };
}

export async function changeAppUserAccess(actor: AdminActor, payload: Record<string, unknown>) {
  mustBeOwner(actor);
  const uid = payload.uid;
  const disabled = payload.disabled;
  if (typeof uid !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(uid) || typeof disabled !== 'boolean') {
    throw new SubscriptionError(400, 'invalid_user_access_request', 'Choose a valid user and action.');
  }
  if (uid === actor.uid) {
    throw new SubscriptionError(403, 'cannot_disable_self', 'You cannot disable your own administrator account.');
  }
  const auth = getAdminAuth();
  const target = await auth.getUser(uid);
  if (target.email?.trim().toLowerCase() === OWNER_EMAIL) {
    throw new SubscriptionError(403, 'cannot_disable_admin', 'The administrator account cannot be disabled.');
  }

  if (target.disabled !== disabled) await auth.updateUser(uid, { disabled });
  if (disabled) await auth.revokeRefreshTokens(uid);

  const db = getAdminFirestore();
  const timestamp = new Date().toISOString();
  let profileSynced = true;
  try {
    await db.doc('users/' + uid).set({
      accessDisabled: disabled,
      accessUpdatedAt: timestamp,
    }, { merge: true });
  } catch (error) {
    profileSynced = false;
    console.error('[admin-users] Could not sync suspension flag to profile', error);
  }

  try {
    await db.collection('adminAudit').add({
      actorUid: actor.uid, subjectUid: uid, operation: disabled ? 'disableUser' : 'enableUser',
      at: FieldValue.serverTimestamp(), profileSynced,
    });
  } catch (error) {
    console.error('[admin-users] Audit write failed', error);
  }
  return { uid, disabled, profileSynced };
}

/** Explicitly delete only the Firebase Authentication identity.
 *  Financial Firestore data is deliberately retained to prevent irreversible loss.
 */
export async function deleteAppUserIdentity(actor: AdminActor, payload: Record<string, unknown>) {
  mustBeOwner(actor);
  const uid = payload.uid;
  const confirmation = payload.confirmEmail;
  if (typeof uid !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(uid)
      || typeof confirmation !== 'string' || !confirmation.trim()) {
    throw new SubscriptionError(400, 'invalid_delete_request', 'Enter the exact email to confirm identity deletion.');
  }
  if (uid === actor.uid) throw new SubscriptionError(403, 'cannot_delete_self', 'Administrator identity cannot be deleted.');
  const auth = getAdminAuth();
  const user = await auth.getUser(uid);
  const email = user.email?.trim().toLowerCase();
  if (!email || email === OWNER_EMAIL) throw new SubscriptionError(403, 'cannot_delete_admin', 'Administrator or email-less identities cannot be deleted.');
  if (confirmation.trim().toLowerCase() !== email) {
    throw new SubscriptionError(400, 'delete_email_mismatch', 'The entered email does not match the user.');
  }
  if (!user.disabled) {
    throw new SubscriptionError(409, 'disable_first', 'Disable the account before deleting its login identity.');
  }
  const db = getAdminFirestore();
  // Fail safely before deleting if audit persistence is unavailable.
  await db.collection('adminAudit').add({
    actorUid: actor.uid,
    subjectUid: uid,
    operation: 'deleteAuthIdentityRequested',
    subjectEmail: email,
    at: FieldValue.serverTimestamp(),
    firestoreDataPreserved: true,
  });
  await auth.deleteUser(uid);
  await db.collection('adminAudit').add({
    actorUid: actor.uid,
    subjectUid: uid,
    operation: 'deleteAuthIdentityCompleted',
    at: FieldValue.serverTimestamp(),
    firestoreDataPreserved: true,
  }).catch(error => console.error('[admin-users] Post-delete audit write failed', error));
  return { uid, deletedAuthenticationOnly: true, financialDataPreserved: true };
}

/** Never count page views as installs. Only the appinstalled browser event or
 *  a launch in standalone display mode is recorded, once per signed-in account.
 */
export async function recordSignedInInstallation(uid: string, payload: Record<string, unknown>) {
  const source = payload.source;
  if (source !== 'standalone' && source !== 'appinstalled') {
    throw new SubscriptionError(400, 'invalid_install_event', 'An install event source is required.');
  }
  const db = getAdminFirestore();
  const installedRef = db.doc('users/' + uid + '/telemetry/pwaInstall');
  const counterRef = db.doc('systemStats/pwaInstall');
  await db.runTransaction(async tx => {
    const [existing, count] = await Promise.all([tx.get(installedRef), tx.get(counterRef)]);
    if (existing.exists) return;
    tx.create(installedRef, {
      source, firstSeenAt: FieldValue.serverTimestamp(),
      note: 'One registered user using the installed PWA',
    });
    tx.set(counterRef, {
      count: Math.max(0, Number(count.data()?.count || 0)) + 1,
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
  });
  return { acknowledged: true };
}
