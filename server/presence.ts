import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from './firebaseAdmin.js';

// Heartbeats are sent once per minute while the app is visible. Allow a
// missed heartbeat before treating a closed or disconnected app as offline.
export const PRESENCE_WINDOW_MS = 2 * 60 * 1000 + 30 * 1000;

export function isRecentlyPresent(lastSeenMs: number | null, nowMs: number): boolean {
  return lastSeenMs !== null && lastSeenMs <= nowMs && nowMs - lastSeenMs <= PRESENCE_WINDOW_MS;
}

export async function recordPresence(uid: string): Promise<void> {
  await getAdminFirestore().doc('users/' + uid + '/telemetry/presence').set({
    lastSeenAt: FieldValue.serverTimestamp(),
  }, { merge: true });
}
