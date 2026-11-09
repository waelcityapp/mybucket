import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { getAdminFirestore } from './firebaseAdmin.js';
import { SubscriptionError } from './subscriptionService.js';

type LockDoc = { enabled?: boolean; salt?: string; hash?: string; inactivityMinutes?: number; failures?: number; blockedUntil?: number };
const pinPattern = /^[0-9]{6}$/;
const refFor = (uid: string) => getAdminFirestore().doc(`users/${uid}/private/appLock`);
const digest = (pin: string, salt: string) => scryptSync(pin, salt, 64).toString('hex');
const reject = (code: string, status = 400) => { throw new SubscriptionError(status, code, code); };
function check(doc: LockDoc, pin: unknown) {
  if (!pinPattern.test(String(pin ?? ''))) reject('invalid_pin');
  if ((doc.blockedUntil || 0) > Date.now()) reject('pin_temporarily_blocked', 429);
  if (!doc.salt || !doc.hash) reject('pin_not_set');
  const expected = Buffer.from(doc.hash, 'hex');
  const actual = Buffer.from(digest(String(pin), doc.salt), 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
export async function appLockAction(uid: string, action: string, payload: any) {
  const ref = refFor(uid);
  const snapshot = await ref.get();
  const data = (snapshot.data() || {}) as LockDoc;
  if (action === 'appLock.status') return { enabled: !!data.enabled, inactivityMinutes: [1,2,3].includes(data.inactivityMinutes || 0) ? data.inactivityMinutes : 1 };
  if (action === 'appLock.enable') {
    if (data.enabled) reject('already_enabled');
    if (!pinPattern.test(String(payload.pin ?? ''))) reject('invalid_pin');
    if (![1,2,3].includes(payload.inactivityMinutes)) reject('invalid_timeout');
    const salt = randomBytes(32).toString('hex');
    await ref.set({ enabled: true, salt, hash: digest(payload.pin, salt), inactivityMinutes: payload.inactivityMinutes, failures: 0, blockedUntil: 0 });
    return { enabled: true, inactivityMinutes: payload.inactivityMinutes };
  }
  if (!data.enabled) reject('lock_not_enabled');
  if (!check(data, payload.pin)) {
    const failures = (data.failures || 0) + 1;
    await ref.set({ failures, blockedUntil: failures >= 5 ? Date.now() + 5 * 60_000 : 0, ...(failures >= 5 ? { failures: 0 } : {}) }, { merge: true });
    reject('incorrect_pin', 403);
  }
  await ref.set({ failures: 0, blockedUntil: 0 }, { merge: true });
  if (action === 'appLock.verify') return { verified: true };
  if (action === 'appLock.disable') {
    await ref.set({ enabled: false, salt: null, hash: null, failures: 0, blockedUntil: 0 }, { merge: true });
    return { enabled: false };
  }
  if (action === 'appLock.change') {
    if (!pinPattern.test(String(payload.newPin ?? ''))) reject('invalid_pin');
    const salt = randomBytes(32).toString('hex');
    await ref.set({ salt, hash: digest(payload.newPin, salt) }, { merge: true });
    return { changed: true };
  }
  if (action === 'appLock.timeout') {
    if (![1,2,3].includes(payload.inactivityMinutes)) reject('invalid_timeout');
    await ref.set({ inactivityMinutes: payload.inactivityMinutes }, { merge: true });
    return { inactivityMinutes: payload.inactivityMinutes };
  }
  reject('unknown_action', 404);
}
