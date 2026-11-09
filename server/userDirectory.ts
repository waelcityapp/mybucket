import type { UserRecord } from 'firebase-admin/auth';
import { getAdminAuth, getAdminFirestore } from './firebaseAdmin.js';
import { SubscriptionError } from './subscriptionService.js';

// A private server-maintained index; Firebase Authentication remains authoritative.
export function directoryFields(user: Pick<UserRecord, 'uid' | 'displayName' | 'email' | 'disabled' | 'metadata'>) {
  const name = user.displayName || '';
  const email = user.email || '';
  return { uid: user.uid, name, email, nameSearch: name.toLocaleLowerCase('ar'), emailSearch: email.toLowerCase(), disabled: user.disabled, createdAt: user.metadata.creationTime || null };
}

export async function syncDirectoryUser(uid: string) {
  const user = await getAdminAuth().getUser(uid);
  const ref = getAdminFirestore().collection('adminUserDirectory').doc(uid);
  const fields = directoryFields(user);
  const existing = await ref.get();
  const data = existing.data();
  if (!existing.exists || Object.entries(fields).some(([key, value]) => data?.[key] !== value)) {
    await ref.set(fields, { merge: true });
  }
}

// One bounded page per request. The caller repeats with nextPageToken until null.
export async function backfillUserDirectory(actor: { email: string | null }, token: unknown, deps?: { auth: ReturnType<typeof getAdminAuth>, db: ReturnType<typeof getAdminFirestore> }) {
  if (actor.email?.trim().toLowerCase() !== 'waelvts@gmail.com') throw new SubscriptionError(403, 'admin_only', 'Only the app owner can maintain the directory.');
  if (token !== undefined && (typeof token !== 'string' || token.length > 4096)) throw new SubscriptionError(400, 'invalid_page_token', 'Invalid page token.');
  const { auth, db } = deps || { auth: getAdminAuth(), db: getAdminFirestore() };
  const page = await auth.listUsers(100, token as string | undefined);
  const refs = page.users.map(user => db.collection('adminUserDirectory').doc(user.uid));
  const existing = refs.length ? await db.getAll(...refs) : [];
  const batch = db.batch();
  let updated = 0;
  page.users.forEach((user, index) => {
    const fields = directoryFields(user);
    const data = existing[index].data();
    if (!existing[index].exists || Object.entries(fields).some(([key, value]) => data?.[key] !== value)) {
      batch.set(refs[index], fields, { merge: true });
      updated++;
    }
  });
  if (updated) await batch.commit();
  const verifiedSnapshots = refs.length ? await db.getAll(...refs) : [];
  const verified = page.users.reduce((count, user, index) => {
    const data = verifiedSnapshots[index].data();
    return count + Number(verifiedSnapshots[index].exists && Object.entries(directoryFields(user)).every(([key, value]) => data?.[key] === value));
  }, 0);
  return { examined: page.users.length, updated, verified, nextPageToken: page.pageToken || null };
}

export async function countUserDirectory(actor: { email: string | null }) {
  if (actor.email?.trim().toLowerCase() !== 'waelvts@gmail.com') throw new SubscriptionError(403, 'admin_only', 'Only the app owner can inspect the directory.');
  const snapshot = await getAdminFirestore().collection('adminUserDirectory').count().get();
  return { count: snapshot.data().count };
}
