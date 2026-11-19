import { normalizePaymentContactPhone } from '../src/utils/adCheckout.js';
import { createHash } from 'node:crypto';
import { getAdminFirestore } from './firebaseAdmin.js';
import { confirmAdminAdTestUpload, deleteAdminAdTestUpload, signAdminAdTestUpload } from './adminAdTestUpload.js';
import { SubscriptionError } from './subscriptionService.js';
import { OFFER_CATEGORY_IDS, type MyOfferAd, type OfferAdStatus, type PublicOfferAd } from '../src/data/offerAds.js';

const DAY = 86400000;
const MAX_UPLOADS = 3;
const cairoDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' });
const EXPIRED_RETENTION = 10 * DAY;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
type Payload = Record<string, unknown>;
type AdFields = Omit<PublicOfferAd, 'id' | 'media'>;
type StoredMedia = Pick<Awaited<ReturnType<typeof confirmAdminAdTestUpload>>, 'publicId' | 'resourceType' | 'version' | 'format'>;
type StoredAd = AdFields & {
  ownerId: string;
  status: OfferAdStatus | 'draft' | 'cancelled' | 'deleting';
  mediaType: StoredMedia['resourceType'] | null;
  media: StoredMedia | null;
  submittedAt: number;
  reviewedAt?: number;
  uploadDay?: string;
  uploadCleanupAt?: number;
  rejectionReason: string;
};

function fail(code: string, status = 400): never {
  throw new SubscriptionError(status, code, 'Advertisement request failed.');
}

function adId(value: unknown) {
  if (typeof value !== 'string' || !uuid.test(value)) return fail('invalid_ad_id');
  return value;
}

function field(value: unknown, max: number, required = true): string {
  if (typeof value !== 'string') return fail('invalid_ad_details');
  const text = value.trim();
  if (text.length > max || (required && !text)) return fail('invalid_ad_details');
  return text;
}

function expiry(payload: Payload, now: number) {
  const { startsAt, endsAt } = payload;
  if (typeof startsAt !== 'number' || typeof endsAt !== 'number' ||
      !Number.isSafeInteger(startsAt) || !Number.isSafeInteger(endsAt) ||
      startsAt <= 0 || startsAt >= endsAt || endsAt <= now || endsAt > 8.64e15) return fail('invalid_ad_dates');
  return { startsAt, endsAt };
}

function adFields(payload: Payload): AdFields {
  const categorySlug = field(payload.categorySlug, 60);
  if (!OFFER_CATEGORY_IDS.some(category => category === categorySlug)) return fail('invalid_ad_details');
  return {
    categorySlug,
    title: field(payload.title, 120),
    description: field(payload.description, 1000),
    merchant: field(payload.merchant, 100),
    contact: field(payload.contact, 200, false),
    ...expiry(payload, Date.now()),
  };
}

function mediaView(media: StoredMedia): PublicOfferAd['media'] {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !secret) return undefined;
  const signedUrl = (extension: string, transform = '') => {
    const path = `${transform}${media.publicId}.${extension}`;
    const signature = createHash('sha1').update(path + secret).digest('base64url').slice(0, 8);
    return `https://res.cloudinary.com/${cloudName}/${media.resourceType}/authenticated/s--${signature}--/${path}`;
  };
  return {
    type: media.resourceType,
    url: media.resourceType === 'video' ? signedUrl('mp4', 'f_mp4/') : signedUrl(media.format),
    ...(media.resourceType === 'video' && { poster: signedUrl('jpg', 'so_0.5,c_limit,w_640/') }),
  };
}

function offerView(id: string, ad: StoredAd): PublicOfferAd {
  const { title, description, merchant, categorySlug, contact, startsAt, endsAt, media } = ad;
  return { id, title, description, merchant, categorySlug, contact, startsAt, endsAt, media: media ? mediaView(media) : undefined };
}

export function isPublicOffer(ad: Pick<StoredAd, 'status' | 'startsAt' | 'endsAt'>, now: number) {
  return ad.status === 'approved' && ad.startsAt <= now && now < ad.endsAt;
}

export async function readPublicOfferAds(action: string, payload: Payload, db = getAdminFirestore()) {
  const now = Date.now();
  if (action === 'ads.detail') {
    if (typeof payload.id !== 'string' || !uuid.test(payload.id)) return null;
    const doc = await db.collection('offerAds').doc(payload.id).get();
    const ad = doc.data() as StoredAd | undefined;
    if (ad && isPublicOffer(ad, now)) return offerView(doc.id, ad);
    if (ad && (ad.status === 'approved' || ad.status === 'deleting') && ad.endsAt <= now) return { expired: true };
    return null;
  }
  const snapshot = await db.collection('offerAds').where('publishedUntil', '>', now).get();
  return snapshot.docs.flatMap(doc => {
    const ad = doc.data() as StoredAd;
    return isPublicOffer(ad, now) ? [offerView(doc.id, ad)] : [];
  }).sort((a, b) => b.startsAt - a.startsAt);
}

export async function readMyOfferAds(uid: string, db = getAdminFirestore()): Promise<MyOfferAd[]> {
  const now = Date.now();
  const snapshot = await db.collection('offerAds').where('ownerId', '==', uid).get();
  return snapshot.docs.flatMap(doc => {
    const { title, merchant, status, submittedAt, startsAt, endsAt, rejectionReason } = doc.data() as StoredAd;
    if (status !== 'pending' && status !== 'approved' && status !== 'rejected') return [];
    const deleteAfter = status === 'approved' && now >= endsAt ? endsAt + EXPIRED_RETENTION : null;
    if (deleteAfter !== null && now >= deleteAfter) return [];
    return [{ id: doc.id, title, merchant, status, submittedAt, startsAt, endsAt, rejectionReason, deleteAfter }];
  }).sort((a, b) => b.submittedAt - a.submittedAt);
}

const policyRef = (db: ReturnType<typeof getAdminFirestore>) => db.collection('offerAdSettings').doc('policy');

async function freeOfferEligibility(
  db: ReturnType<typeof getAdminFirestore>,
  tx: FirebaseFirestore.Transaction,
  uid: string,
  id: string,
  now: number,
  requireNoPending: boolean,
) {
  const [policy, ledger, existing] = await Promise.all([
    tx.get(policyRef(db)),
    tx.get(db.collection('offerAdApprovalLedger').doc(uid)),
    tx.get(db.collection('offerAds').where('ownerId', '==', uid)),
  ]);
  const days = policy.data()?.freeIntervalDays ?? 7;
  let lastApproval = ledger.data()?.lastApproval ?? 0;
  for (const doc of existing.docs) {
    const ad = doc.data() as StoredAd;
    if (requireNoPending && ad.status === 'pending' && doc.id !== id) return { status: 'pending' } as const;
    if (ad.status === 'approved' || ad.status === 'deleting') lastApproval = Math.max(lastApproval, ad.reviewedAt ?? 0);
  }
  const availableAt = lastApproval + days * DAY;
  if (lastApproval && availableAt > now) return { status: 'interval', availableAt } as const;
  return { status: 'available' } as const;
}

async function assertFreeOfferAvailable(...args: Parameters<typeof freeOfferEligibility>) {
  const eligibility = await freeOfferEligibility(...args);
  if (eligibility.status === 'pending') fail('ad_pending_exists', 409);
  if (eligibility.status === 'interval') fail('ad_free_interval', 429);
}

export async function readOfferForRenewal(uid: string, payload: Payload, db = getAdminFirestore()) {
  const doc = await db.collection('offerAds').doc(adId(payload.id)).get();
  const ad = doc.data() as StoredAd | undefined;
  const now = Date.now();
  if (!ad || ad.ownerId !== uid || ad.status !== 'approved' || ad.endsAt > now || now >= ad.endsAt + EXPIRED_RETENTION) {
    return fail('ad_renewal_unavailable', 404);
  }
  return offerView(doc.id, ad);
}

export async function removeExpiredOffer(uid: string, id: string, db = getAdminFirestore(), destroy = deleteAdminAdTestUpload) {
  const ref = db.collection('offerAds').doc(adId(id));
  const asset = await db.runTransaction(async tx => {
    const ad = (await tx.get(ref)).data() as StoredAd | undefined;
    if (!ad) return null;
    if (ad.ownerId !== uid) return fail('invalid_ad_id', 403);
    if ((ad.status !== 'approved' && ad.status !== 'deleting') || ad.endsAt > Date.now()) return fail('ad_not_expired', 409);
    const ledger = db.collection('offerAdApprovalLedger').doc(uid);
    const current = (await tx.get(ledger)).data()?.lastApproval ?? 0;
    if ((ad.reviewedAt ?? 0) > current) tx.set(ledger, { lastApproval: ad.reviewedAt });
    if (ad.status !== 'deleting') tx.update(ref, { status: 'deleting' });
    return { media: ad.media };
  });
  if (!asset) return { removed: true };
  if (asset.media) {
    await destroy(uid, {
      publicId: asset.media.publicId, resourceType: asset.media.resourceType,
    }, undefined, undefined, 'submissions');
  }
  // Delete the document only after Cloudinary confirms removal. The scheduled job can retry failed removals.
  await ref.delete();
  return { removed: true };
}

const uploadUsage = (db: ReturnType<typeof getAdminFirestore>, day: string) =>
  db.collection('offerAdUploadDays').doc(day).collection('accounts');
const activeUpload = (db: ReturnType<typeof getAdminFirestore>, uid: string) =>
  db.collection('offerAdActiveUploads').doc(uid);

async function purgeAbandonedUpload(doc: FirebaseFirestore.QueryDocumentSnapshot, db: ReturnType<typeof getAdminFirestore>) {
  const asset = await db.runTransaction(async tx => {
    const ad = (await tx.get(doc.ref)).data() as StoredAd | undefined;
    if (!ad || (ad.status !== 'draft' && ad.status !== 'cancelled') || !ad.mediaType ||
        !ad.uploadCleanupAt || ad.uploadCleanupAt > Date.now()) return null;
    const lease = activeUpload(db, ad.ownerId);
    const leaseData = (await tx.get(lease)).data();
    if (leaseData?.id === doc.id) tx.delete(lease);
    tx.update(doc.ref, { status: 'cancelled' });
    return { ownerId: ad.ownerId, type: ad.mediaType };
  });
  if (!asset) return;
  await deleteAdminAdTestUpload(asset.ownerId, {
    publicId: `mybucket/ads/submissions/${asset.ownerId}/${doc.id}`, resourceType: asset.type,
  }, undefined, undefined, 'submissions');
  await doc.ref.delete();
}

export async function purgeExpiredOffers(db = getAdminFirestore()) {
  const cutoff = Date.now() - EXPIRED_RETENTION;
  const ads = db.collection('offerAds');
  const [expired, retry, abandoned] = await Promise.all([
    ads.where('publishedUntil', '>', 0).where('publishedUntil', '<=', cutoff).limit(40).get(),
    ads.where('status', '==', 'deleting').limit(40).get(),
    ads.where('uploadCleanupAt', '>', 0).where('uploadCleanupAt', '<=', Date.now()).limit(40).get(),
  ]);
  const unique = new Map([...expired.docs, ...retry.docs].map(doc => [doc.id, doc]));
  const results = await Promise.allSettled([
    ...[...unique.values()].map(doc => removeExpiredOffer(doc.get('ownerId'), doc.id, db)),
    ...abandoned.docs.map(doc => purgeAbandonedUpload(doc, db)),
  ]);
  const failed = results.filter(result => result.status === 'rejected').length;
  if (failed) console.error('Expired advertisement cleanup failures:', failed);
  return { removed: results.length - failed, failed };
}

export async function sendOfferAd(action: string, uid: string, payload: Payload, db = getAdminFirestore()) {
  if (action === 'ads.paymentContact') {
    const ref = db.collection('offerAdPaymentContacts').doc(uid);
    if (payload.phone === undefined) return { phone: (await ref.get()).data()?.phone ?? '' };
    const phone = typeof payload.phone === 'string' && payload.phone.length <= 24 ? normalizePaymentContactPhone(payload.phone) : null;
    if (!phone) return fail('invalid_payment_phone');
    await ref.set({ phone }, { merge: true });
    return { phone };
  }
  if (action === 'ads.freePolicy') {
    return { freeIntervalDays: (await policyRef(db).get()).data()?.freeIntervalDays ?? 7 };
  }
  if (action === 'ads.freeEligibility') {
    return db.runTransaction(tx => freeOfferEligibility(db, tx, uid, '', Date.now(), true), { readOnly: true });
  }
  if (action === 'ads.renewal') return readOfferForRenewal(uid, payload, db);
  const id = adId(payload.id);
  if (action === 'ads.deleteExpired') return removeExpiredOffer(uid, id, db);
  const ref = db.collection('offerAds').doc(id);

  if (action === 'ads.cancel') {
    const mediaType = await db.runTransaction(async tx => {
      const draft = (await tx.get(ref)).data() as StoredAd | undefined;
      if (!draft) return null;
      if (draft.ownerId !== uid) return fail('invalid_ad_id', 403);
      if (draft.status === 'cancelled') return draft.mediaType;
      if (draft.status !== 'draft') return fail('ad_already_submitted', 409);
      if (draft.uploadDay) {
        const usage = uploadUsage(db, draft.uploadDay).doc(uid);
        const lease = activeUpload(db, uid);
        const [usageDoc, leaseDoc] = await Promise.all([tx.get(usage), tx.get(lease)]);
        tx.set(usage, { cancellations: (usageDoc.data()?.cancellations ?? 0) + 1 }, { merge: true });
        // Release after the provider confirms deletion, so another upload cannot overlap.
        if (leaseDoc.data()?.id === id) tx.set(lease, { cancelling: true }, { merge: true });
      }
      tx.update(ref, { status: 'cancelled' });
      return draft.mediaType;
    });
    if (mediaType) {
      await deleteAdminAdTestUpload(uid, {
        publicId: `mybucket/ads/submissions/${uid}/${id}`, resourceType: mediaType,
      }, undefined, undefined, 'submissions');
    }
    await db.runTransaction(async tx => {
      const lease = activeUpload(db, uid);
      if ((await tx.get(lease)).data()?.id === id) tx.delete(lease);
    });
    return { cancelled: true };
  }

  if (action === 'ads.prepare') {
    const fields = adFields(payload);
    const mediaType = payload.resourceType;
    if (mediaType !== null && mediaType !== 'image' && mediaType !== 'video') return fail('invalid_media_type');
    return db.runTransaction(async tx => {
      const now = Date.now();
      const day = cairoDay.format(now);
      const existing = (await tx.get(ref)).data() as StoredAd | undefined;
      if (existing && existing.ownerId !== uid) return fail('invalid_ad_id', 403);
      if (existing?.status === 'cancelled') return fail('ad_cancelled', 409);
      if (existing && existing.status !== 'draft') return { submitted: true, signed: null };
      await assertFreeOfferAvailable(db, tx, uid, id, now, true);
      if (existing && existing.mediaType !== mediaType) return fail('invalid_media_type');
      let signed = null;
      if (mediaType) {
        if (existing?.uploadDay) return fail('ad_upload_already_issued', 409);
        const usage = uploadUsage(db, day).doc(uid);
        const lease = activeUpload(db, uid);
        const [used, active, policy] = await Promise.all([tx.get(usage), tx.get(lease), tx.get(policyRef(db))]);
        if (policy.data()?.uploadsPaused === true) return fail('ad_upload_paused', 503);
        const count = used.data()?.issued ?? 0;
        if (count >= MAX_UPLOADS) return fail('ad_upload_daily_limit', 429);
        if ((active.data()?.expiresAt ?? 0) > now) return fail('ad_upload_active', 409);
        signed = signAdminAdTestUpload(uid, payload, undefined, now, id, 'submissions');
        tx.set(usage, { issued: count + 1 }, { merge: true });
        tx.set(lease, { id, expiresAt: now + 3600000 });
      } else if (!existing) {
        const quota = db.collection('offerAdUploadLimits').doc(`${uid}_${day}`);
        const count = (await tx.get(quota)).data()?.count ?? 0;
        if (count >= 5) return fail('ad_daily_limit', 429);
        tx.set(quota, { count: count + 1 });
      }
      tx.set(ref, {
        ...fields, ownerId: uid, status: 'draft', mediaType, media: null, submittedAt: 0, rejectionReason: '',
        ...(signed && { uploadDay: day, uploadCleanupAt: now + DAY }),
      });
      return { submitted: false, signed };
    });
  }

  const draft = (await ref.get()).data() as StoredAd | undefined;
  if (!draft || draft.ownerId !== uid) return fail('invalid_ad_id', 403);
  if (draft.status === 'cancelled') return fail('ad_cancelled', 409);
  if (draft.status !== 'draft') return { submitted: true };
  expiry(draft, Date.now());

  let media: StoredMedia | null = null;
  let verifiedBytes = 0;
  if (draft.mediaType) {
    const publicId = `mybucket/ads/submissions/${uid}/${id}`;
    if (payload.publicId !== publicId || payload.resourceType !== draft.mediaType) return fail('invalid_upload_request');
    const confirmed = await confirmAdminAdTestUpload(uid, payload, undefined, undefined, 'submissions');
    verifiedBytes = confirmed.bytes;
    media = { publicId, resourceType: confirmed.resourceType, version: confirmed.version, format: confirmed.format };
  }
  await db.runTransaction(async tx => {
    const latest = (await tx.get(ref)).data() as StoredAd | undefined;
    if (!latest || latest.ownerId !== uid) return fail('invalid_ad_id', 403);
    if (latest.status === 'cancelled') return fail('ad_cancelled', 409);
    if (latest.status !== 'draft') return;
    expiry(latest, Date.now());
    await assertFreeOfferAvailable(db, tx, uid, id, Date.now(), true);
    if (latest.uploadDay) {
      const usage = uploadUsage(db, latest.uploadDay).doc(uid);
      const lease = activeUpload(db, uid);
      const [usageDoc, leaseDoc] = await Promise.all([tx.get(usage), tx.get(lease)]);
      const totals = usageDoc.data();
      tx.set(usage, { verified: (totals?.verified ?? 0) + 1, bytes: (totals?.bytes ?? 0) + verifiedBytes }, { merge: true });
      if (leaseDoc.data()?.id === id) tx.delete(lease);
    }
    // The per-account write serializes concurrent submissions and decisions, including empty query results.
    tx.set(db.collection('offerAdApprovalLedger').doc(uid), { touchedAt: Date.now() }, { merge: true });
    tx.update(ref, { status: 'pending', submittedAt: Date.now(), media, uploadCleanupAt: 0 });
  });
  return { submitted: true };
}

export async function reviewOfferAds(action: string, uid: string, payload: Payload, db = getAdminFirestore()) {
  if (action === 'admin.ads.uploadStats') {
    const day = cairoDay.format(Date.now());
    const ref = policyRef(db);
    if (typeof payload.uploadsPaused === 'boolean') await ref.set({ uploadsPaused: payload.uploadsPaused }, { merge: true });
    const [snapshot, policy] = await Promise.all([uploadUsage(db, day).get(), ref.get()]);
    const totals = { issued: 0, verified: 0, bytes: 0, cancellations: 0, limitedAccounts: 0 };
    for (const doc of snapshot.docs) {
      const data = doc.data();
      totals.issued += data.issued ?? 0;
      totals.verified += data.verified ?? 0;
      totals.bytes += data.bytes ?? 0;
      totals.cancellations += data.cancellations ?? 0;
      if (data.issued >= MAX_UPLOADS) totals.limitedAccounts++;
    }
    return { ...totals, uploadsPaused: policy.data()?.uploadsPaused === true };
  }
  if (action === 'admin.ads.policy') {
    const ref = policyRef(db);
    if (payload.freeIntervalDays === undefined) return { freeIntervalDays: (await ref.get()).data()?.freeIntervalDays ?? 7 };
    const days = payload.freeIntervalDays;
    if (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > 90) return fail('invalid_ad_interval');
    await ref.set({ freeIntervalDays: days }, { merge: true });
    return { freeIntervalDays: days };
  }
  if (action === 'admin.ads.list') {
    const status = payload.status ?? 'pending';
    if (status !== 'pending' && status !== 'approved' && status !== 'rejected') return fail('invalid_ad_status');
    const snapshot = await db.collection('offerAds').where('status', '==', status).get();
    return snapshot.docs.map(doc => {
      const ad = doc.data() as StoredAd;
      return { ...offerView(doc.id, ad), status, submittedAt: ad.submittedAt, rejectionReason: ad.rejectionReason };
    }).sort((a, b) => b.submittedAt - a.submittedAt);
  }
  const ref = db.collection('offerAds').doc(adId(payload.id));
  const status = payload.status;
  if (status !== 'approved' && status !== 'rejected') return fail('invalid_ad_status');
  const rejectionReason = status === 'rejected' ? field(payload.reason ?? '', 500, false) : '';
  return db.runTransaction(async tx => {
    const ad = (await tx.get(ref)).data() as StoredAd | undefined;
    if (!ad) return fail('invalid_ad_id', 404);
    if (ad.status === status) return { status };
    if (ad.status !== 'pending') return fail('ad_already_reviewed', 409);
    const now = Date.now();
    if (status === 'approved' && ad.endsAt <= now) return fail('ad_schedule_expired', 409);
    if (status === 'approved') {
      await assertFreeOfferAvailable(db, tx, ad.ownerId, ref.id, now, false);
      tx.set(db.collection('offerAdApprovalLedger').doc(ad.ownerId), { lastApproval: now });
    }
    tx.update(ref, { status, rejectionReason, reviewerId: uid, reviewedAt: now, publishedUntil: status === 'approved' ? ad.endsAt : 0 });
    return { status };
  });
}
