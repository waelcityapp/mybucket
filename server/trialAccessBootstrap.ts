import { Timestamp } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminFirestore } from './firebaseAdmin.js';

// Only create a missing trial access record. Existing access or billing is
// never overwritten or interpreted as unpaid without separate review.
export async function ensureTrialAccess(uid: string, deps = { auth: getAdminAuth(), db: getAdminFirestore() }): Promise<'created' | 'existing'> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new Error('invalid-user');
  const accessRef = deps.db.doc(`users/${uid}/billing/access`);
  const validExisting = (data: FirebaseFirestore.DocumentData | undefined) =>
    !!data && data.registeredAt instanceof Timestamp && (data.paidUntil === null || data.paidUntil instanceof Timestamp) && data.schemaVersion === 1;
  const existing = await accessRef.get();
  if (existing.exists) {
    if (!validExisting(existing.data())) throw new Error('existing-access-needs-review');
    return 'existing';
  }
  const user = await deps.auth.getUser(uid);
  const createdAt = Date.parse(user.metadata.creationTime || '');
  if (!Number.isFinite(createdAt) || createdAt > Date.now()) throw new Error('registration-date-unavailable');
  const billingRef = deps.db.doc(`users/${uid}/billing/subscription`);
  return deps.db.runTransaction(async tx => {
    const [access, billing] = await Promise.all([tx.get(accessRef), tx.get(billingRef)]);
    if (access.exists) {
      if (!validExisting(access.data())) throw new Error('existing-access-needs-review');
      return 'existing';
    }
    if (billing.exists) throw new Error('existing-billing-needs-review');
    tx.create(accessRef, { registeredAt: Timestamp.fromMillis(createdAt), paidUntil: null, schemaVersion: 1 });
    return 'created';
  });
}
