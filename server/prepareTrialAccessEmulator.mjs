import { Timestamp } from 'firebase-admin/firestore';

// Emulator-only preparation. This function refuses production targets.
// It is not wired to an endpoint or a production migration command.
export async function prepareTrialAccessEmulator({ db, auth, uid }) {
  const emulator = process.env.FIRESTORE_EMULATOR_HOST || '';
  if (!/^(127\.0\.0\.1|localhost):\d+$/.test(emulator) || db.projectId !== 'demo-mybucket-rules') {
    throw new Error('emulator-only');
  }
  if (typeof uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(uid)) throw new Error('invalid-user');
  const user = await auth.getUser(uid);
  const registration = Date.parse(user?.metadata?.creationTime || '');
  if (!Number.isFinite(registration) || registration > Date.now()) throw new Error('invalid-registration');
  const billing = db.doc(`users/${uid}/billing/subscription`);
  const access = db.doc(`users/${uid}/billing/access`);
  return db.runTransaction(async tx => {
    const [billingSnapshot, accessSnapshot] = await Promise.all([tx.get(billing), tx.get(access)]);
    if (accessSnapshot.exists) return 'already-exists';
    // Any billing record requires individual review, even if it looks unpaid.
    if (billingSnapshot.exists) return 'review-billing';
    tx.create(access, { registeredAt: Timestamp.fromMillis(registration), paidUntil: null, schemaVersion: 1 });
    return 'created';
  });
}
