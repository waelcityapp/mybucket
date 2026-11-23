import { createHash, randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { FieldPath } from 'firebase-admin/firestore';
import { getMessaging, type Message } from 'firebase-admin/messaging';
import { getAdminApp, getAdminFirestore } from './firebaseAdmin.js';
import type { VipPushCampaign } from '../src/data/offerAds.js';
import { SubscriptionError } from './subscriptionService.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const secretPattern = /^[a-f0-9]{64}$/;
const invalidTokenCodes = new Set(['messaging/registration-token-not-registered', 'messaging/invalid-registration-token']);
const day = 86_400_000;
const registrations = 'vipPushDevices';
const outbox = 'vipPushOutbox';
const leaseDuration = 5 * 60_000;
export const vipPushActions = new Set(['vipPush.config', 'vipPush.status', 'vipPush.subscribe', 'vipPush.unsubscribe']);

export function vipPushKey() {
  const key = process.env.VIP_PUSH_VAPID_PUBLIC_KEY?.trim();
  return key && /^[\w-]{87}$/.test(key) && Buffer.from(key, 'base64url')[0] === 4 ? key : null;
}

export function isVipPushOrigin(origin: unknown, host: unknown) {
  if (typeof origin !== 'string' || typeof host !== 'string') return false;
  return origin === `https://${host}` || (/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host) && origin === `http://${host}`);
}

const fail = (status: number, code: string): never => {
  throw new SubscriptionError(status, code, 'VIP notification request failed.');
};

export async function vipPushAction(
  action: string, payload: Record<string, unknown>, ip: string,
  db: FirebaseFirestore.Firestore | undefined = undefined,
  validateToken = async (token: string) => {
    await getMessaging(getAdminApp()).send({ token, data: { type: 'vip-validation' } }, true);
  },
) {
  const vapidKey = vipPushKey();
  if (action === 'vipPush.config') return { vapidKey };
  db ??= getAdminFirestore();
  const { id, secret } = payload;
  if (typeof secret !== 'string' || !secretPattern.test(secret)) return fail(400, 'invalid_device_key');
  const key = hash(secret);
  if (action === 'vipPush.status' || action === 'vipPush.unsubscribe') {
    if (typeof id !== 'string' || !secretPattern.test(id)) return fail(400, 'invalid_device_key');
    const ref = db.collection(registrations).doc(id);
    if (action === 'vipPush.status') return { active: (await ref.get()).get('key') === key };
    await db.runTransaction(async tx => {
      if ((await tx.get(ref)).get('key') === key) tx.delete(ref);
    });
    return { active: false };
  }

  if (action !== 'vipPush.subscribe' || !vapidKey) return fail(503, 'vip_push_unavailable');
  if (!isIP(ip)) return fail(503, 'vip_push_network_unavailable');
  const { token, lang } = payload;
  if (typeof token !== 'string' || !/^[A-Za-z0-9_:-]{50,350}$/.test(token) || (lang !== 'ar' && lang !== 'en')) {
    return fail(400, 'invalid_push_token');
  }

  const deviceId = hash(token);
  const ref = db.collection(registrations).doc(deviceId);
  const current = await ref.get();
  if (current.exists && current.get('key') !== key) return fail(409, 'push_device_already_registered');
  if (current.get('key') === key) {
    if (current.get('lang') !== lang) {
      await db.runTransaction(async tx => {
        if ((await tx.get(ref)).get('key') === key) tx.update(ref, { lang });
      });
    }
    return { id: deviceId, active: true };
  }

  // Apply limits before accepting a registration or calling FCM to check it.
  await db.runTransaction(async tx => {
    const limits = [db.collection('vipPushRate').doc(hash(ip)), db.collection('vipPushRate').doc('global')];
    const snapshots = await tx.getAll(...limits);
    const today = Math.floor(Date.now() / day);
    const counts = snapshots.map(snapshot => snapshot.get('day') === today ? (snapshot.get('count') ?? 0) : 0);
    if (counts[0] >= 10 || counts[1] >= 1500) return fail(429, 'vip_push_rate_limit');
    limits.forEach((limit, i) => tx.set(limit, { day: today, count: counts[i] + 1 }));
  });
  try {
    await validateToken(token);
  } catch (error) {
    const code = (error as { code?: string })?.code;
    return fail(invalidTokenCodes.has(code ?? '') ? 400 : 503, invalidTokenCodes.has(code ?? '') ? 'invalid_push_token' : 'vip_push_unavailable');
  }
  await db.runTransaction(async tx => {
    const existing = await tx.get(ref);
    if (existing.exists && existing.get('key') !== key) return fail(409, 'push_device_already_registered');
    if (!existing.exists) tx.create(ref, { key, token, lang, createdAt: Date.now() });
  });
  return { id: deviceId, active: true };
}

export async function readVipPushCampaigns(db: FirebaseFirestore.Firestore, ids: string[]) {
  const campaigns = new Map<string, VipPushCampaign>();
  for (let offset = 0; offset < ids.length; offset += 100) {
    const refs = ids.slice(offset, offset + 100).map(id => db.collection(outbox).doc(id));
    const docs = await db.getAll(...refs);
    const now = Date.now();
    for (const doc of docs) {
      const job = doc.data();
      if (!job) continue;
      const failedCount = job.failedCount ?? 0;
      let status: VipPushCampaign['status'] = 'queued';
      if (job.completedAt) status = failedCount ? 'completed_with_failures' : 'completed';
      else if (job.stoppedAt || job.endsAt <= now) status = 'stopped';
      else if (job.leaseUntil > now) status = 'sending';
      else if (job.startedAt || job.publishedAt + leaseDuration <= now) status = 'stopped';
      campaigns.set(doc.id, { status, scannedCount: job.scannedCount ?? 0, failedCount });
    }
  }
  return campaigns;
}

export function queueVipPush(
  tx: FirebaseFirestore.Transaction, db: FirebaseFirestore.Firestore, id: string,
  startsAt: number, endsAt: number,
) {
  if (!vipPushKey()) return;
  tx.create(db.collection(outbox).doc(id), { publishedAt: startsAt, endsAt, cursor: '', scannedCount: 0, failedCount: 0 });
}

function pushMessage(token: string, lang: string, id: string, title: string, expiresAt: number): Message {
  const seconds = Math.max(0, Math.min(600, Math.floor((expiresAt - Date.now()) / 1000)));
  return {
    token, data: { type: 'vip-ad', id, title, lang, expiresAt: String(expiresAt) },
    webpush: { headers: { TTL: String(seconds) } },
  };
}

/** Deliver one campaign from the existing approval response's background task. */
export async function deliverVipPush(
  db = getAdminFirestore(),
  send = (messages: Message[]) => getMessaging(getAdminApp()).sendEach(messages),
  id?: string,
) {
  if (!id || !vipPushKey()) return;
  const ref = db.collection(outbox).doc(id);
  const lease = randomUUID();
  const claim = await db.runTransaction(async tx => {
    const current = (await tx.get(ref)).data();
    const now = Date.now();
    if (!current || current.completedAt || current.stoppedAt || current.publishedAt > now ||
        current.endsAt <= now || current.leaseUntil > now) return null;
    tx.update(ref, { lease, leaseUntil: now + leaseDuration, startedAt: current.startedAt ?? now });
    return current;
  });
  if (!claim) return;

  let cursor: string = claim.cursor;
  let failedCount: number = claim.failedCount ?? 0;
  let scannedCount: number = claim.scannedCount ?? 0;
  let complete = false;
  try {
    while (true) {
      const ad = (await db.collection('offerAds').doc(id).get()).data();
      const now = Date.now();
      if (!ad || ad.status !== 'approved' || ad.payment?.tier !== 'vip' ||
          ad.startsAt > now || ad.endsAt <= now || typeof ad.title !== 'string') {
        break;
      }
      const query = db.collection(registrations).orderBy(FieldPath.documentId());
      const batch = await (cursor ? query.startAfter(cursor) : query).limit(100).get();
      let remaining = batch.docs.map(device => device.id);
      const invalidDevices: string[] = [];
      // Retry failed devices from this batch only, while respecting current opt-outs.
      for (let attempt = 0; attempt < 3 && remaining.length; attempt++) {
        if (Date.now() >= ad.endsAt) break;
        if (attempt) await new Promise(resolve => setTimeout(resolve, attempt * 500));
        const targets = await db.getAll(...remaining.map(device => db.collection(registrations).doc(device)));
        try {
          remaining = await deliverBatch(targets, ad, id, send, invalidDevices);
        } catch {
          // Keep the batch eligible if the provider failed before returning per-device results.
        }
      }
      if (Date.now() >= ad.endsAt) break;
      const failedDeviceIds = [...invalidDevices, ...remaining];
      failedCount += failedDeviceIds.length;
      scannedCount += batch.size;
      cursor = batch.docs.at(-1)?.id ?? cursor;
      const lastBatch = batch.size < 100;
      await db.runTransaction(async tx => {
        if ((await tx.get(ref)).get('lease') !== lease) throw new Error('vip_delivery_lease_lost');
        if (failedDeviceIds.length) {
          tx.set(ref.collection('failures').doc(cursor), { deviceIds: failedDeviceIds });
        }
        tx.update(ref, { cursor, scannedCount, failedCount, ...(lastBatch
          ? { completedAt: Date.now(), lease: '', leaseUntil: 0 }
          : { leaseUntil: Date.now() + leaseDuration }) });
      });
      complete = lastBatch;
      if (complete) break;
    }
  } finally {
    if (!complete) {
      await db.runTransaction(async tx => {
        if ((await tx.get(ref)).get('lease') !== lease) return;
        tx.update(ref, { lease: '', leaseUntil: 0, stoppedAt: Date.now() });
      });
    }
  }
}

async function deliverBatch(
  targets: FirebaseFirestore.DocumentSnapshot[], ad: FirebaseFirestore.DocumentData, id: string,
  send: (messages: Message[]) => ReturnType<ReturnType<typeof getMessaging>['sendEach']>,
  invalidDevices: string[],
) {
  const devices = targets.filter(device => device.exists && device.get('createdAt') <= ad.startsAt);
  if (!devices.length) return [];
  const response = await send(devices.map(device => pushMessage(device.get('token'), device.get('lang'), id, ad.title, ad.endsAt)));
  const retryIds: string[] = [];
  for (const [index, device] of devices.entries()) {
    const result = response.responses[index];
    if (result?.success) continue;
    if (invalidTokenCodes.has(result?.error?.code ?? '')) {
      invalidDevices.push(device.id);
      await device.ref.delete({ lastUpdateTime: device.updateTime }).catch(() => {});
    } else {
      retryIds.push(device.id);
    }
  }
  return retryIds;
}
