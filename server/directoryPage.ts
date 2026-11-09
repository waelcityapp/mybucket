import { FieldPath } from 'firebase-admin/firestore';
import { getAdminFirestore } from './firebaseAdmin.js';
import { directoryMatchesSearch, normalizeDirectorySearch } from './directorySearch.js';
import { registrationPeriodStart, type RegistrationPeriod } from './registrationPeriod.js';
import { SubscriptionError } from './subscriptionService.js';

export type DirectoryFilter = { search: string; period: RegistrationPeriod; cursor: string | null };
export function parseDirectoryFilter(payload: Record<string, unknown>): DirectoryFilter {
  const search = typeof payload.search === 'string' ? normalizeDirectorySearch(payload.search).slice(0, 100) : '';
  const period = payload.period === undefined ? 'all' : payload.period;
  if (!['all', 'today', 'week', 'month'].includes(String(period))) throw new SubscriptionError(400, 'invalid_period', 'Invalid period.');
  const cursor = payload.cursor ?? null;
  if (cursor !== null && (typeof cursor !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(cursor))) throw new SubscriptionError(400, 'invalid_cursor', 'Invalid cursor.');
  return { search, period: period as RegistrationPeriod, cursor: cursor as string | null };
}

/** A bounded page of index candidates, never financial data. Call again while cursor is set. */
export async function readDirectoryPage(actor: { email: string | null }, payload: Record<string, unknown>, database?: ReturnType<typeof getAdminFirestore>) {
  if (actor.email?.trim().toLowerCase() !== 'waelvts@gmail.com') throw new SubscriptionError(403, 'admin_only', 'Admin only.');
  const { search, period, cursor } = parseDirectoryFilter(payload);
  const db = database || getAdminFirestore();
  let query: FirebaseFirestore.Query = db.collection('adminUserDirectory');
  const chars = Array.from(search);
  if (chars.length) query = query.where('searchGrams', 'array-contains', chars.slice(0, 3).join(''));
  const since = registrationPeriodStart(period);
  if (since) query = query.where('createdAtSort', '>=', since);
  query = query.orderBy('createdAtSort', 'desc').orderBy(FieldPath.documentId(), 'desc');
  if (cursor) {
    const snapshot = await db.collection('adminUserDirectory').doc(cursor).get();
    if (!snapshot.exists) throw new SubscriptionError(409, 'stale_cursor', 'Refresh the list.');
    query = query.startAfter(snapshot);
  }
  const page = await query.limit(25).get();
  const matches: FirebaseFirestore.QueryDocumentSnapshot[] = [];
  let last: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  for (const doc of page.docs) {
    last = doc;
    const user = doc.data();
    if (directoryMatchesSearch(String(user.name || ''), String(user.email || ''), search)) matches.push(doc);
    if (matches.length === 25) break;
  }
  const processed = last ? page.docs.findIndex(doc => doc.id === last!.id) + 1 : 0;
  const hasMore = processed < page.docs.length || page.docs.length === 25;
  return { users: matches.map(doc => ({ ...doc.data(), uid: doc.id })), nextCursor: hasMore && last ? last.id : null };
}
