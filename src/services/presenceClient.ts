import { getDatabase, goOffline, goOnline, onDisconnect, onValue, push, ref, remove, serverTimestamp, set, update, type Database } from 'firebase/database';
import { auth } from '../lib/firebase';
import { classifyPresenceDevice } from '../utils/presenceDevices';

const DATABASE_URL = 'https://mybucket-8b6f0-default-rtdb.europe-west1.firebasedatabase.app';
let active: { db: Database; uid: string; key: string; device: string } | null = null;

// Try to end the current session while its authentication is still valid.
// Sign-out remains possible if the network is unavailable.
export async function closePresenceBeforeSignOut(): Promise<void> {
  const session = active;
  if (!session) return;
  active = null;
  try {
    await Promise.race([
      update(ref(session.db, `presence/${session.uid}`), {
        [`sessions/${session.key}`]: null,
        'lastSeen/at': serverTimestamp(),
        'lastSeen/device': session.device,
      }),
      new Promise<void>(resolve => window.setTimeout(resolve, 1500)),
    ]);
  } catch (error) { console.warn('Presence sign-out update failed:', error); }
  goOffline(session.db);
}

// Each visible tab has its own session. Firebase removes it on disconnection.
export function startPresence(uid: string): () => void {
  const db = getDatabase(auth.app, DATABASE_URL);
  const connectionRef = ref(db, '.info/connected');
  const device = classifyPresenceDevice(navigator.userAgent);
  let disposed = false;
  let generation = 0;
  const unsubscribe = onValue(connectionRef, async snapshot => {
    const currentGeneration = ++generation;
    if (!snapshot.val()) { active = null; return; }
    if (disposed || document.visibilityState !== 'visible') return;
    const sessionRef = push(ref(db, `presence/${uid}/sessions`));
    if (!sessionRef.key) return;
    try {
      // Register the disconnect action before declaring the session online.
      await onDisconnect(sessionRef).remove();
      await onDisconnect(ref(db, `presence/${uid}/lastSeen`)).set({ at: serverTimestamp(), device });
      if (disposed || currentGeneration !== generation || document.visibilityState !== 'visible') return;
      await set(sessionRef, { device, since: serverTimestamp() });
      if (!disposed && currentGeneration === generation && document.visibilityState === 'visible') active = { db, uid, key: sessionRef.key, device };
      else await remove(sessionRef);
    } catch (error) {
      console.warn('Presence connection failed:', error);
    }
  });
  const visibility = () => {
    if (document.visibilityState === 'visible') goOnline(db);
    else { generation++; goOffline(db); }
  };
  document.addEventListener('visibilitychange', visibility);
  if (document.visibilityState === 'visible') goOnline(db); else goOffline(db);
  return () => { disposed = true; generation++; active = null; document.removeEventListener('visibilitychange', visibility); unsubscribe(); goOffline(db); };
}
