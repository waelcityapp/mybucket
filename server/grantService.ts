import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminFirestore } from './firebaseAdmin.js';
import { SubscriptionError } from './subscriptionService.js';
import { customRegistrationRange } from './registrationPeriod.js';

const OWNER = 'waelvts@gmail.com';
type Actor = { uid: string; email: string | null };
type Deps = { auth: ReturnType<typeof getAdminAuth>; db: ReturnType<typeof getAdminFirestore> };
function requireOwner(actor: Actor) {
  if (actor.email?.trim().toLowerCase() !== OWNER) throw new SubscriptionError(403, 'admin_only', 'Only the owner may manage grants.');
}
function uidFrom(input: unknown): string {
  if (typeof input !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(input)) throw new SubscriptionError(400, 'invalid_user', 'Choose a valid user.');
  return input;
}
function boundedText(input: unknown, max: number): string {
  if (input === undefined || input === null) return '';
  if (typeof input !== 'string' || input.trim().length > max) throw new SubscriptionError(400, 'invalid_grant_details', 'Grant details are too long.');
  return input.trim();
}

export async function getFreeGrant(actor: Actor, payload: Record<string, unknown>, deps?: Deps) {
  requireOwner(actor);
  const uid = uidFrom(payload.uid);
  const { auth, db } = deps || { auth: getAdminAuth(), db: getAdminFirestore() };
  const [user, snapshot, access] = await Promise.all([auth.getUser(uid), db.doc(`adminGrants/${uid}`).get(), db.doc(`users/${uid}/billing/access`).get()]);
  const data = snapshot.data();
  const date = (value: unknown) => value instanceof Timestamp ? value.toDate().toISOString() : null;
  return { uid, name: user.displayName || '', email: user.email || '', paidAccessUntil: date(access.data()?.paidUntil), grant: snapshot.exists && data ? {
    plan: data.plan, startsAt: date(data.startsAt), endsAt: date(data.endsAt), endedAt: date(data.endedAt),
    active: data.active === true, reason: data.reason || '', note: data.note || '',
  } : null };
}

/** Transactionally maintain the free grant separately from paid subscription fields. */
export async function setFreeGrant(actor: Actor, payload: Record<string, unknown>, deps?: Deps, clock: () => number = Date.now) {
  requireOwner(actor);
  const uid = uidFrom(payload.uid);
  const plan = payload.plan;
  if (plan !== 'basic' && plan !== 'pro') throw new SubscriptionError(400, 'invalid_grant_plan', 'Choose Basic or Pro.');
  let endMs = NaN;
  try {
    if (typeof payload.endDate === 'string') endMs = Date.parse(customRegistrationRange(payload.endDate, payload.endDate).endExclusive);
    else if (typeof payload.endsAt === 'string') endMs = Date.parse(payload.endsAt);
  } catch { /* validation below returns a safe error */ }
  const nowMs = clock();
  if (!Number.isFinite(endMs) || endMs <= nowMs || endMs > nowMs + 3660 * 86400000) throw new SubscriptionError(400, 'invalid_grant_expiry', 'Choose a future end date within ten years.');
  const reason = boundedText(payload.reason, 160), note = boundedText(payload.note, 500);
  const { auth, db } = deps || { auth: getAdminAuth(), db: getAdminFirestore() };
  await auth.getUser(uid); // Do not grant a nonexistent identity.
  const accessRef = db.doc(`users/${uid}/billing/access`);
  const grantRef = db.doc(`adminGrants/${uid}`);
  const auditRef = db.collection('adminGrantAudit').doc();
  const now = Timestamp.fromMillis(nowMs), end = Timestamp.fromMillis(endMs);
  const startedAt = await db.runTransaction(async tx => {
    const [access, previousGrant] = await Promise.all([tx.get(accessRef), tx.get(grantRef)]);
    const current = access.data();
    if (!access.exists || !(current?.registeredAt instanceof Timestamp) || current.schemaVersion !== 1 || !(current.paidUntil === null || current.paidUntil instanceof Timestamp)) throw new SubscriptionError(409, 'access_record_missing', 'The user access record requires review.');
    const previous = previousGrant.data();
    const isExtension = previousGrant.exists && previous?.active === true && previous.plan === plan && previous.startsAt instanceof Timestamp && previous.endsAt instanceof Timestamp && previous.startsAt.toMillis() <= nowMs && previous.endsAt.toMillis() > nowMs;
    const start = isExtension ? previous!.startsAt as Timestamp : now;
    tx.update(accessRef, { grantPlan: plan, grantStartsAt: start, grantUntil: end });
    tx.set(grantRef, { uid, plan, startsAt: start, endsAt: end, reason, note, active: true, endedAt: FieldValue.delete(), updatedBy: actor.uid, updatedAt: now }, { merge: true });
    tx.create(auditRef, { operation: 'grant.set', uid, plan, startsAt: start, endsAt: end, reason, note, actorUid: actor.uid, at: now });
    return start.toDate().toISOString();
  });
  return { uid, plan, startsAt: startedAt, endsAt: new Date(endMs).toISOString() };
}

export async function endFreeGrant(actor: Actor, payload: Record<string, unknown>, deps?: Deps, clock: () => number = Date.now) {
  requireOwner(actor);
  const uid = uidFrom(payload.uid);
  const { db } = deps || { auth: getAdminAuth(), db: getAdminFirestore() };
  const accessRef = db.doc(`users/${uid}/billing/access`), grantRef = db.doc(`adminGrants/${uid}`), auditRef = db.collection('adminGrantAudit').doc();
  const at = Timestamp.fromMillis(clock());
  await db.runTransaction(async tx => {
    const [access, grant] = await Promise.all([tx.get(accessRef), tx.get(grantRef)]);
    if (!access.exists || !grant.exists || grant.data()?.active !== true) throw new SubscriptionError(409, 'grant_not_found', 'There is no active grant to end.');
    tx.update(accessRef, { grantPlan: FieldValue.delete(), grantStartsAt: FieldValue.delete(), grantUntil: FieldValue.delete() });
    tx.update(grantRef, { active: false, endedAt: at, updatedBy: actor.uid });
    tx.create(auditRef, { operation: 'grant.ended', uid, actorUid: actor.uid, at });
  });
  return { uid, ended: true };
}
