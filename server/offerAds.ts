import { paidAdDailyPrice, adRunDays, normalizePaymentContactPhone } from '../src/utils/adCheckout.js';
import { createHash } from 'node:crypto';
import { getAdminFirestore } from './firebaseAdmin.js';
import { confirmAdminAdTestUpload, deleteAdminAdTestUpload, signAdminAdTestUpload } from './adminAdTestUpload.js';
import { SubscriptionError } from './subscriptionService.js';
import { DEMO_ADS } from '../src/data/demoAds.js';
import { type OfferEngagement, type OfferReactionState, OFFER_CATEGORY_IDS, type MyOfferAd, type OfferAdStatus, type PublicOfferAd } from '../src/data/offerAds.js';

const DAY = 86400000;
const MAX_UPLOADS = 3;
const OWNER_MAX_UPLOADS = 20;
const cairoDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' });
const EXPIRED_RETENTION = 10 * DAY;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
type Payload = Record<string, unknown>;
type AdFields = Omit<PublicOfferAd, 'id' | 'media' | 'engagement'>;
type StoredMedia = Pick<Awaited<ReturnType<typeof confirmAdminAdTestUpload>>, 'publicId' | 'resourceType' | 'version' | 'format'>;
type StoredAd = AdFields & {
  viewCount?: number;
  likeCount?: number;
  favoriteCount?: number;
  ownerId: string;
  status: OfferAdStatus | 'draft' | 'cancelled' | 'deleting';
  mediaType: StoredMedia['resourceType'] | null;
  media: StoredMedia | null;
  payment?: { method: 'instapay'; tier?: 'featured' | 'vip'; amountEgp: number; phone: string };
  receipt?: StoredMedia;
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

function expiry(payload: Payload, now: number, allowPast = false) {
  const { startsAt, endsAt } = payload;
  if (typeof startsAt !== 'number' || typeof endsAt !== 'number' ||
      !Number.isSafeInteger(startsAt) || !Number.isSafeInteger(endsAt) ||
      startsAt <= 0 || startsAt >= endsAt || (!allowPast && endsAt <= now) || endsAt > 8.64e15) return fail('invalid_ad_dates');
  return { startsAt, endsAt };
}

function adFields(payload: Payload, allowPast = false): AdFields {
  const categorySlug = field(payload.categorySlug, 60);
  if (!OFFER_CATEGORY_IDS.some(category => category === categorySlug)) return fail('invalid_ad_details');
  return {
    categorySlug,
    title: field(payload.title, 120),
    description: field(payload.description, 1000),
    merchant: field(payload.merchant, 100),
    contact: field(payload.contact, 200, false),
    ...expiry(payload, Date.now(), allowPast),
  };
}

function mediaView(media: StoredMedia, thumbnail = false): PublicOfferAd['media'] {
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
    url: media.resourceType === 'video' ? signedUrl('mp4', 'f_mp4/') : signedUrl(media.format, thumbnail ? 'c_limit,w_320/' : ''),
    ...(media.resourceType === 'video' && { poster: signedUrl('jpg', 'so_0.5,c_limit,w_640/') }),
  };
}

function offerView(id: string, ad: StoredAd): PublicOfferAd {
  const { title, description, merchant, categorySlug, contact, startsAt, endsAt, media } = ad;
  return { id, title, description, merchant, categorySlug, contact, startsAt, endsAt, engagement: engagementOf(ad), tier: ad.payment ? ad.payment.tier ?? 'featured' : 'free', media: media ? mediaView(media) : undefined };
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
  return readPublishedOffers(false, db, now);
}

export async function readPublishedOffers(includeViews: boolean, db = getAdminFirestore(), now = Date.now()) {
  const snapshot = await db.collection('offerAds').where('publishedUntil', '>', now).get();
  return snapshot.docs.flatMap(doc => {
    const ad = doc.data() as StoredAd;
    if (!isPublicOffer(ad, now)) return [];
    const offer = offerView(doc.id, ad);
    return [includeViews ? { ...offer, viewCount: ad.viewCount ?? 0 } : offer];
  }).sort((a, b) => b.startsAt - a.startsAt);
}

function engagementOf(data?: Partial<OfferEngagement>): OfferEngagement {
  return { likeCount: data?.likeCount ?? 0, favoriteCount: data?.favoriteCount ?? 0 };
}

const reactionsFor = (db: ReturnType<typeof getAdminFirestore>, uid: string) =>
  db.collection('offerAdReactions').doc(uid).collection('ads');

export async function readDemoOfferEngagement(includeViews = false, db = getAdminFirestore()) {
  const refs = DEMO_ADS.map(ad => db.collection('demoOfferEngagement').doc(ad.id));
  const docs = await db.getAll(...refs);
  return Object.fromEntries(docs.map(doc => {
    const data = doc.data();
    const engagement = engagementOf(data);
    return [doc.id, includeViews ? { ...engagement, viewCount: data?.viewCount ?? 0 } : engagement];
  }));
}

export async function readMyOfferReactions(uid: string, db = getAdminFirestore()) {
  const snapshot = await reactionsFor(db, uid).get();
  return Object.fromEntries(snapshot.docs.map(doc => [doc.id, doc.data() as OfferReactionState]));
}

export async function setOfferReaction(uid: string, payload: Payload, db = getAdminFirestore()) {
  const { reaction, active } = payload;
  if ((reaction !== 'liked' && reaction !== 'saved') || typeof active !== 'boolean') return fail('invalid_ad_reaction');
  const demo = DEMO_ADS.some(ad => ad.id === payload.id);
  const id = demo ? payload.id as string : adId(payload.id);
  const adRef = db.collection(demo ? 'demoOfferEngagement' : 'offerAds').doc(id);
  const userRef = reactionsFor(db, uid).doc(id);

  return db.runTransaction(async tx => {
    const [adSnapshot, userSnapshot] = await Promise.all([tx.get(adRef), tx.get(userRef)]);
    const ad = adSnapshot.data() as StoredAd | undefined;
    if (!demo && (!ad || !isPublicOffer(ad, Date.now()))) return fail('ad_not_available', 404);
    const previous = userSnapshot.data() as OfferReactionState | undefined;
    const state = { liked: previous?.liked === true, saved: previous?.saved === true };
    const engagement = engagementOf(ad);
    if (state[reaction] === active) return { state, engagement };

    state[reaction] = active;
    const counter = reaction === 'liked' ? 'likeCount' : 'favoriteCount';
    engagement[counter] = Math.max(0, engagement[counter] + (active ? 1 : -1));
    tx.set(adRef, engagement, { merge: true });
    if (state.liked || state.saved) tx.set(userRef, state);
    else tx.delete(userRef);
    return { state, engagement };
  });
}

export async function recordOfferCardView(payload: Payload, db = getAdminFirestore()) {
  const { sessionId } = payload;
  if (typeof sessionId !== 'string' || !uuid.test(sessionId)) return fail('invalid_ad_view_session');
  const demo = DEMO_ADS.some(ad => ad.id === payload.id);
  const id = demo ? payload.id as string : adId(payload.id);
  const ref = db.collection(demo ? 'demoOfferEngagement' : 'offerAds').doc(id);
  const session = ref.collection('viewSessions').doc(sessionId);
  return db.runTransaction(async tx => {
    const [adSnapshot, sessionSnapshot] = await Promise.all([tx.get(ref), tx.get(session)]);
    const ad = adSnapshot.data() as StoredAd | undefined;
    if (!demo && (!ad || !isPublicOffer(ad, Date.now()))) return null;
    const previous = ad?.viewCount ?? 0;
    if (sessionSnapshot.exists) return previous;
    const viewCount = previous + 1;
    tx.set(ref, { viewCount }, { merge: true });
    tx.create(session, { viewedAt: Date.now() });
    return viewCount;
  });
}

export async function readMyOfferAds(uid: string, db = getAdminFirestore()): Promise<MyOfferAd[]> {
  const now = Date.now();
  const snapshot = await db.collection('offerAds').where('ownerId', '==', uid).get();
  return snapshot.docs.flatMap<MyOfferAd>(doc => {
    const { title, merchant, status, submittedAt, startsAt, endsAt, rejectionReason, payment, media } = doc.data() as StoredAd;
    if (status !== 'pending' && status !== 'approved' && status !== 'rejected' && status !== 'deleting') return [];
    const deleteAfter = status === 'approved' && now >= endsAt ? endsAt + EXPIRED_RETENTION : null;
    if (deleteAfter !== null && now >= deleteAfter) return [];
    const preview = media && status !== 'deleting' ? mediaView(media, true) : undefined;
    const thumbnailUrl = preview?.type === 'video' ? preview.poster : preview?.url;
    return [{ id: doc.id, title, merchant, thumbnailUrl, tier: payment ? payment.tier ?? 'featured' : 'free', status, submittedAt, startsAt, endsAt, rejectionReason, deleteAfter }];
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
    if (ad.payment) continue;
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
    if (ad.status !== 'approved' && ad.status !== 'deleting') return fail('ad_not_deletable', 409);
    const ledger = db.collection('offerAdApprovalLedger').doc(uid);
    const current = (await tx.get(ledger)).data()?.lastApproval ?? 0;
    if (!ad.payment && (ad.reviewedAt ?? 0) > current) tx.set(ledger, { lastApproval: ad.reviewedAt });
    if (ad.status !== 'deleting') tx.update(ref, { status: 'deleting' });
    return { media: ad.media, receipt: ad.receipt };
  });
  if (!asset) return { removed: true };
  if (asset.media) {
    await destroy(uid, {
      publicId: asset.media.publicId, resourceType: asset.media.resourceType,
    }, undefined, undefined, 'submissions');
  }
  if (asset.receipt) await destroy(uid, { publicId: asset.receipt.publicId, resourceType: 'image' }, undefined, undefined, 'receipts');
  // Delete the document only after Cloudinary confirms removal. The scheduled job can retry failed removals.
  await db.recursiveDelete(ref);
  return { removed: true };
}

const uploadUsage = (db: ReturnType<typeof getAdminFirestore>, day: string) =>
  db.collection('offerAdUploadDays').doc(day).collection('accounts');
const activeUpload = (db: ReturnType<typeof getAdminFirestore>, uid: string) =>
  db.collection('offerAdActiveUploads').doc(uid);

async function purgeAbandonedUpload(doc: FirebaseFirestore.QueryDocumentSnapshot, db: ReturnType<typeof getAdminFirestore>) {
  const asset = await db.runTransaction(async tx => {
    const ad = (await tx.get(doc.ref)).data() as StoredAd | undefined;
    if (!ad || (ad.status !== 'draft' && ad.status !== 'cancelled') || (!ad.mediaType && !ad.payment) ||
        !ad.uploadCleanupAt || ad.uploadCleanupAt > Date.now()) return null;
    const lease = activeUpload(db, ad.ownerId);
    const leaseData = (await tx.get(lease)).data();
    if (leaseData?.id === doc.id) tx.delete(lease);
    tx.update(doc.ref, { status: 'cancelled' });
    return { ownerId: ad.ownerId, type: ad.mediaType, paid: !!ad.payment };
  });
  if (!asset) return;
  if (asset.type) await deleteAdminAdTestUpload(asset.ownerId, {
    publicId: `mybucket/ads/submissions/${asset.ownerId}/${doc.id}`, resourceType: asset.type,
  }, undefined, undefined, 'submissions');
  if (asset.paid) await deleteAdminAdTestUpload(asset.ownerId, {
    publicId: `mybucket/ads/receipts/${asset.ownerId}/${doc.id}`, resourceType: 'image',
  }, undefined, undefined, 'receipts');
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

export async function sendOfferAd(action: string, uid: string, payload: Payload, db = getAdminFirestore(), isOwner = false) {
  const uploadLimit = isOwner ? OWNER_MAX_UPLOADS : MAX_UPLOADS;
  if (action === 'ads.paidAvailability') {
    const now = Date.now();
    const [usage, lease, policy] = await Promise.all([
      uploadUsage(db, cairoDay.format(now)).doc(uid).get(), activeUpload(db, uid).get(), policyRef(db).get(),
    ]);
    if (policy.data()?.uploadsPaused === true) return { available: false, reason: 'paused' };
    if ((usage.data()?.issued ?? 0) >= uploadLimit) return { available: false, reason: 'daily_limit' };
    if ((lease.data()?.expiresAt ?? 0) > now) return { available: false, reason: 'active' };
    return { available: true };
  }
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
    const assets = await db.runTransaction(async tx => {
      const draft = (await tx.get(ref)).data() as StoredAd | undefined;
      if (!draft) return null;
      if (draft.ownerId !== uid) return fail('invalid_ad_id', 403);
      if (draft.status === 'cancelled') return { mediaType: draft.mediaType, paid: !!draft.payment };
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
      return { mediaType: draft.mediaType, paid: !!draft.payment };
    });
    if (assets?.mediaType) {
      await deleteAdminAdTestUpload(uid, {
        publicId: `mybucket/ads/submissions/${uid}/${id}`, resourceType: assets.mediaType,
      }, undefined, undefined, 'submissions');
    }
    if (assets?.paid) await deleteAdminAdTestUpload(uid, {
      publicId: `mybucket/ads/receipts/${uid}/${id}`, resourceType: 'image',
    }, undefined, undefined, 'receipts');
    await db.runTransaction(async tx => {
      const lease = activeUpload(db, uid);
      if ((await tx.get(lease)).data()?.id === id) tx.delete(lease);
    });
    return { cancelled: true };
  }

  if (action === 'ads.prepare') {
    if (payload.tier !== undefined && payload.tier !== 'free' && payload.tier !== 'featured' && payload.tier !== 'vip') return fail('invalid_ad_details');
    const paidTier = payload.tier === 'featured' || payload.tier === 'vip' ? payload.tier : null;
    const featured = paidTier !== null;
    const fields = adFields(payload, featured);
    const phone = typeof payload.paymentPhone === 'string' && payload.paymentPhone.length <= 24 ? normalizePaymentContactPhone(payload.paymentPhone) : null;
    if (featured && !phone) return fail('invalid_payment_phone');
    const days = adRunDays(new Date(fields.startsAt), new Date(fields.endsAt));
    const amountEgp = paidTier && days ? days * paidAdDailyPrice(paidTier) : null;
    if (featured && (amountEgp === null || payload.amountEgp !== amountEgp)) return fail('invalid_payment_amount');
    const mediaType = payload.resourceType;
    if (mediaType !== null && mediaType !== 'image' && mediaType !== 'video') return fail('invalid_media_type');
    return db.runTransaction(async tx => {
      const now = Date.now();
      const day = cairoDay.format(now);
      const existing = (await tx.get(ref)).data() as StoredAd | undefined;
      if (existing && existing.ownerId !== uid) return fail('invalid_ad_id', 403);
      if (existing?.status === 'cancelled') return fail('ad_cancelled', 409);
      if (existing && existing.status !== 'draft') return { submitted: true, signed: null };
      if (!featured) await assertFreeOfferAvailable(db, tx, uid, id, now, true);
      if (existing && (existing.payment ? existing.payment.tier ?? 'featured' : null) !== paidTier) return fail('invalid_ad_details');
      if (existing && existing.mediaType !== mediaType) return fail('invalid_media_type');
      let signed = null;
      let receiptSigned = null;
      const permits = Number(!!mediaType || featured);
      if (permits) {
        if (existing?.uploadDay) return fail('ad_upload_already_issued', 409);
        const usage = uploadUsage(db, day).doc(uid);
        const lease = activeUpload(db, uid);
        const [used, active, policy] = await Promise.all([tx.get(usage), tx.get(lease), tx.get(policyRef(db))]);
        if (policy.data()?.uploadsPaused === true) return fail('ad_upload_paused', 503);
        const count = used.data()?.issued ?? 0;
        if (count + permits > uploadLimit) return fail('ad_upload_daily_limit', 429);
        if ((active.data()?.expiresAt ?? 0) > now) return fail('ad_upload_active', 409);
        if (mediaType) signed = signAdminAdTestUpload(uid, payload, undefined, now, id, 'submissions');
        if (featured) receiptSigned = signAdminAdTestUpload(uid, {
          resourceType: 'image', bytes: payload.receiptBytes,
        }, undefined, now, id, 'receipts');
        tx.set(usage, { issued: count + permits, limit: uploadLimit }, { merge: true });
        tx.set(lease, { id, expiresAt: now + 3600000 });
      } else if (!existing) {
        const quota = db.collection('offerAdUploadLimits').doc(`${uid}_${day}`);
        const count = (await tx.get(quota)).data()?.count ?? 0;
        if (count >= 5) return fail('ad_daily_limit', 429);
        tx.set(quota, { count: count + 1 });
      }
      tx.set(ref, {
        ...fields, ownerId: uid, status: 'draft', mediaType, media: null, submittedAt: 0, rejectionReason: '',
        ...(permits && { uploadDay: day, uploadCleanupAt: now + DAY }),
        ...(paidTier && { payment: { method: 'instapay', tier: paidTier, amountEgp, phone } }),
      });
      return { submitted: false, signed, receiptSigned };
    });
  }

  const draft = (await ref.get()).data() as StoredAd | undefined;
  if (!draft || draft.ownerId !== uid) return fail('invalid_ad_id', 403);
  if (draft.status === 'cancelled') return fail('ad_cancelled', 409);
  if (draft.status !== 'draft') return { submitted: true };
  expiry(draft, Date.now(), !!draft.payment);

  let media: StoredMedia | null = null;
  let verifiedBytes = 0;
  if (draft.mediaType) {
    const publicId = `mybucket/ads/submissions/${uid}/${id}`;
    if (payload.publicId !== publicId || payload.resourceType !== draft.mediaType) return fail('invalid_upload_request');
    const confirmed = await confirmAdminAdTestUpload(uid, payload, undefined, undefined, 'submissions');
    verifiedBytes = confirmed.bytes;
    media = { publicId, resourceType: confirmed.resourceType, version: confirmed.version, format: confirmed.format };
  }
  let receipt: StoredMedia | undefined;
  if (draft.payment) {
    const proof = payload.receipt;
    const publicId = `mybucket/ads/receipts/${uid}/${id}`;
    if (!proof || typeof proof !== 'object') return fail('receipt_required');
    const receiptPayload = proof as Payload;
    if (receiptPayload.publicId !== publicId || receiptPayload.resourceType !== 'image') return fail('invalid_upload_request');
    const confirmed = await confirmAdminAdTestUpload(uid, receiptPayload, undefined, undefined, 'receipts');
    verifiedBytes += confirmed.bytes;
    receipt = { publicId, resourceType: 'image', version: confirmed.version, format: confirmed.format };
  }
  await db.runTransaction(async tx => {
    const latest = (await tx.get(ref)).data() as StoredAd | undefined;
    if (!latest || latest.ownerId !== uid) return fail('invalid_ad_id', 403);
    if (latest.status === 'cancelled') return fail('ad_cancelled', 409);
    if (latest.status !== 'draft') return;
    expiry(latest, Date.now(), !!latest.payment);
    if (!latest.payment) await assertFreeOfferAvailable(db, tx, uid, id, Date.now(), true);
    if (latest.uploadDay) {
      const usage = uploadUsage(db, latest.uploadDay).doc(uid);
      const lease = activeUpload(db, uid);
      const [usageDoc, leaseDoc] = await Promise.all([tx.get(usage), tx.get(lease)]);
      const totals = usageDoc.data();
      tx.set(usage, { verified: (totals?.verified ?? 0) + Number(!!media) + Number(!!receipt), bytes: (totals?.bytes ?? 0) + verifiedBytes }, { merge: true });
      if (leaseDoc.data()?.id === id) tx.delete(lease);
    }
    // The per-account write serializes concurrent submissions and decisions, including empty query results.
    if (!latest.payment) tx.set(db.collection('offerAdApprovalLedger').doc(uid), { touchedAt: Date.now() }, { merge: true });
    tx.update(ref, { status: 'pending', submittedAt: Date.now(), media, uploadCleanupAt: 0, ...(receipt && { receipt }) });
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
      if (data.issued >= (data.limit ?? MAX_UPLOADS)) totals.limitedAccounts++;
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
      return { ...offerView(doc.id, ad), status, submittedAt: ad.submittedAt, rejectionReason: ad.rejectionReason,
        ...(ad.payment && { payment: { ...ad.payment, receiptUrl: ad.receipt ? mediaView(ad.receipt)?.url : undefined } }) };
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
    if (status === 'approved' && !ad.payment && ad.endsAt <= now) return fail('ad_schedule_expired', 409);
    if (status === 'approved' && ad.payment && (!ad.receipt || payload.paymentConfirmed !== true)) return fail('payment_confirmation_required');
    if (status === 'approved' && !ad.payment) {
      await assertFreeOfferAvailable(db, tx, ad.ownerId, ref.id, now, false);
      tx.set(db.collection('offerAdApprovalLedger').doc(ad.ownerId), { lastApproval: now });
    }
    const startsAt = ad.payment && status === 'approved' ? Math.max(now, ad.startsAt) : ad.startsAt;
    const endsAt = ad.endsAt + startsAt - ad.startsAt;
    tx.update(ref, { status, rejectionReason, reviewerId: uid, reviewedAt: now, startsAt, endsAt,
      publishedUntil: status === 'approved' ? endsAt : 0, ...(ad.payment && status === 'approved' && { paymentConfirmedAt: now }) });
    return { status };
  });
}
