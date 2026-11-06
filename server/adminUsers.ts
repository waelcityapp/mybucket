import { FieldValue } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminFirestore } from './firebaseAdmin.js';
import { SubscriptionError } from './subscriptionService.js';

const OWNER_EMAIL = 'waelvts@gmail.com';
const MAX_USERS_TO_COUNT = 5000;
const MAX_USER_ROWS = 200;

type AdminActor = { uid: string; email: string | null };
type SubscriptionInfo = {
  isPaid?: boolean;
  status?: string;
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
function subscriptionLabel(record: SubscriptionInfo | undefined) {
  if (!record) return { tier: 'unknown', plan: 'Not recorded' };
  if (record.isPaid === true) {
    return { tier: 'paid', plan: record.planName || record.planId || record.plan || 'Paid — plan not recorded' };
  }
  if (record.trialExpiresAt && new Date(record.trialExpiresAt).getTime() > Date.now()) {
    return { tier: 'trial', plan: 'Pro trial (' + (record.totalTrialDays || 10) + ' days)' };
  }
  return { tier: 'free', plan: 'Free' };
}

/** Auth is the source of truth for registered accounts and disabled status.
 *  Limit is explicit, not silently presented as an exhaustive result.
 */
export async function listAppUsers(actor: AdminActor) {
  mustBeOwner(actor);
  const auth = getAdminAuth();
  const db = getAdminFirestore();
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
  for (let i = 0; i < visible.length; i += 40) {
    const batch = visible.slice(i, i + 40);
    const [subscriptions, installations] = await Promise.all([
      db.getAll(...batch.map(u => db.doc('users/' + u.uid + '/billing/subscription'))),
      db.getAll(...batch.map(u => db.doc('users/' + u.uid + '/telemetry/pwaInstall'))),
    ]);
    for (let j = 0; j < batch.length; j++) {
      const sub = subscriptions[j].exists ? subscriptions[j].data() as SubscriptionInfo : undefined;
      rows.push({
        ...batch[j],
        ...subscriptionLabel(sub),
        installed: installations[j].exists,
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
