import { queueVipPush, readVipPushCampaigns } from './vipPush.js';
import { adContactError, adVideoLimit, containsExternalAdLink, normalizeAdPhone, normalizeGoogleMapsUrl } from '../src/utils/adContent.js';
import { DEFAULT_PAID_AD_PRICES, isPaidAdPrice, paidAdDailyPrice, adRunDays, normalizePaymentContactPhone, normalizeAdTransferReference, type LegacyAdTransfer, validVipDurationDays } from '../src/utils/adCheckout.js';
import { createHash, randomUUID } from 'node:crypto';
import { getAdminFirestore } from './firebaseAdmin.js';
import { confirmAdminAdTestUpload, deleteAdminAdTestUpload, signAdminAdTestUpload } from './adminAdTestUpload.js';
import { SubscriptionError } from './subscriptionService.js';
import { DEMO_ADS } from '../src/data/demoAds.js';
import { DEFAULT_FREE_OFFER_POLICY, supportsOfferFavorites, type FreeOfferEligibility, type FreeOfferPolicy, type OfferEngagement, type OfferReactionState, OFFER_CATEGORY_IDS, OFFER_EDIT_REQUEST_LIMIT, type OfferAdEditReview, type MyOfferAd, type OfferAdStatus, type PublicOfferAd } from '../src/data/offerAds.js';

const DAY = 86400000;
const MAX_UPLOADS = 3;
const OWNER_MAX_UPLOADS = 20;
const cairoDay = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' });
const EXPIRED_RETENTION = 10 * DAY;
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
type Payload = Record<string, unknown>;
type AdFields = Omit<PublicOfferAd, 'id' | 'media' | 'engagement'>;
type StoredMedia = Pick<Awaited<ReturnType<typeof confirmAdminAdTestUpload>>, 'publicId' | 'resourceType' | 'version' | 'format'>;
type OfferTextFields = ReturnType<typeof adTextFields>;
type OfferEditRequest = { id: string; status: 'pending'; submittedAt: number; changes: OfferTextFields; mediaChange?: StoredMedia | null }
  | { id: string; status: 'approved' | 'rejected'; reason: string };
type StoredAd = AdFields & {
  viewCount?: number;
  likeCount?: number;
  favoriteCount?: number;
  ownerId: string;
  status: OfferAdStatus | 'draft' | 'cancelled' | 'deleting';
  mediaType: StoredMedia['resourceType'] | null;
  media: StoredMedia | null;
  payment?: { method: 'instapay'; tier?: 'featured' | 'vip'; amountEgp: number; dailyPriceEgp?: number; phone: string };
  receipt?: StoredMedia;
  submittedAt: number;
  reviewedAt?: number;
  uploadDay?: string;
  uploadCleanupAt?: number;
  rejectionReason: string;
  paidPrepared?: boolean;
  priceLockedAt?: number;
  formerVipSchedule?: { startsAt: number; endsAt: number };
  adContentVersion?: 1;
  legacyTransfer?: LegacyAdTransfer;
  confirmedTransfer?: { reference: string; amountEgp: number; transferredAt?: number };
  uploadCleanupClaim?: { id: string; expiresAt: number };
  correctionId?: string;
  correctedBy?: string;
  editRevision?: string;
  editRequestsUsed?: number;
  editRequest?: OfferEditRequest;
  editTarget?: string;
  cleanupPublicId?: string;
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

function adTextFields(payload: Payload) {
  const categorySlug = field(payload.categorySlug, 60);
  if (!OFFER_CATEGORY_IDS.some(category => category === categorySlug)) return fail('invalid_ad_details');
  return {
    categorySlug,
    title: field(payload.title, 120),
    description: field(payload.description, 1000),
    merchant: field(payload.merchant, 100),
    contact: field(payload.contact ?? '', 200, false),
    ...(payload.callPhone !== undefined && { callPhone: field(payload.callPhone, 50, false) }),
    ...(payload.whatsappPhone !== undefined && { whatsappPhone: field(payload.whatsappPhone, 50, false) }),
    ...(payload.mapsUrl !== undefined && { mapsUrl: field(payload.mapsUrl, 2048, false) }),
  };
}

function adFields(payload: Payload, paid: boolean, vipDurationDays?: number): AdFields {
  return {
    ...adTextFields(payload),
    ...(vipDurationDays !== undefined ? { vipDurationDays, startsAt: 0, endsAt: vipDurationDays * DAY }
      : paid ? expiry(payload, Date.now(), true) : { startsAt: 0, endsAt: 0 }),
  };
}

function validateAdContent(fields: Omit<AdFields, 'startsAt' | 'endsAt'>, paid: boolean) {
  if ([fields.title, fields.merchant, fields.description, fields.contact].some(value => typeof value === 'string' && containsExternalAdLink(value))) {
    return fail('ad_external_link');
  }
  if (!paid && (fields.callPhone || fields.whatsappPhone || fields.mapsUrl)) return fail('invalid_ad_details');
  const error = adContactError(fields);
  if (error) return fail(error);
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

function offerTier(ad: StoredAd) {
  return ad.payment ? ad.payment.tier ?? 'featured' : 'free';
}

function requiresVideoCorrection(ad: StoredAd) {
  return !ad.payment && (ad.mediaType === 'video' || ad.media?.resourceType === 'video');
}

function offerView(id: string, ad: StoredAd): PublicOfferAd {
  const { title, description, merchant, categorySlug, contact, startsAt, endsAt, media, callPhone, whatsappPhone, mapsUrl } = ad;
  return { id, title, description, merchant, categorySlug, contact, startsAt, endsAt,
    ...(callPhone && { callPhone }), ...(whatsappPhone && { whatsappPhone }), ...(mapsUrl && { mapsUrl }), ...(ad.vipDurationDays && { vipDurationDays: ad.vipDurationDays }), engagement: engagementOf(ad), tier: offerTier(ad), media: media ? mediaView(media) : undefined };
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
    if (reaction === 'saved' && (demo || !ad || !supportsOfferFavorites(offerTier(ad)))) {
      return fail('ad_favorites_unavailable', 409);
    }
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
    const ad = doc.data() as StoredAd;
    const { title, merchant, status, submittedAt, startsAt, endsAt, rejectionReason, media } = ad;
    if (status !== 'pending' && status !== 'approved' && status !== 'rejected' && status !== 'deleting') return [];
    const deleteAfter = status === 'approved' && now >= endsAt ? endsAt + EXPIRED_RETENTION : null;
    if (deleteAfter !== null && now >= deleteAfter) return [];
    const preview = media && status !== 'deleting' ? mediaView(media, true) : undefined;
    const thumbnailUrl = preview?.type === 'video' ? preview.poster : preview?.url;
    return [{ id: doc.id, title, merchant, thumbnailUrl, tier: offerTier(ad), status, submittedAt, startsAt, endsAt, rejectionReason, deleteAfter,
      requiresVideoCorrection: !ad.correctedBy && requiresVideoCorrection(ad),
      editRequestsUsed: ad.editRequestsUsed ?? 0,
      ...(ad.editRequest && { editRequestStatus: ad.editRequest.status }),
      ...(ad.editRequest?.status === 'rejected' && { editRejectionReason: ad.editRequest.reason }) }];
  }).sort((a, b) => b.submittedAt - a.submittedAt);
}

const policyRef = (db: ReturnType<typeof getAdminFirestore>) => db.collection('offerAdSettings').doc('policy');

function paidOfferPrices(settings?: FirebaseFirestore.DocumentData) {
  const prices = settings?.paidPrices;
  if (prices === undefined) return DEFAULT_PAID_AD_PRICES;
  if (!isPaidAdPrice(prices?.featured) || !isPaidAdPrice(prices?.vip)) {
    return fail('ad_prices_unavailable', 503);
  }
  return { featured: prices.featured, vip: prices.vip };
}

function readLegacyTransfer(value: unknown): LegacyAdTransfer {
  const input = value as Partial<LegacyAdTransfer> | undefined;
  const reference = normalizeAdTransferReference(input?.reference);
  const transferredAt = input?.transferredAt;
  const amountEgp = input?.amountEgp;
  if (!reference || typeof transferredAt !== 'number' || !Number.isSafeInteger(transferredAt) ||
      transferredAt <= 0 || transferredAt > Date.now() || typeof amountEgp !== 'number' ||
      !Number.isSafeInteger(amountEgp) || amountEgp <= 0) return fail('ad_legacy_transfer_invalid');
  return { reference, transferredAt, amountEgp };
}

function requiresPaidReceipt(payment?: StoredAd['payment']) {
  return !!payment && (payment.amountEgp !== 0 || payment.dailyPriceEgp !== 0);
}


// The phase-one waiting period has a new storage key so an old saved interval
// cannot override the initial 14 days. The admin and client API keep their field names.
function freeOfferPolicy(settings?: FirebaseFirestore.DocumentData): FreeOfferPolicy {
  return {
    freeDurationDays: settings?.freeDurationDays ?? DEFAULT_FREE_OFFER_POLICY.freeDurationDays,
    freeIntervalDays: settings?.freeWaitDays ?? DEFAULT_FREE_OFFER_POLICY.freeIntervalDays,
  };
}

async function freeOfferEligibility(
  db: ReturnType<typeof getAdminFirestore>,
  tx: FirebaseFirestore.Transaction,
  uid: string,
  id: string,
  now: number,
): Promise<FreeOfferEligibility> {
  const [settings, ledger, existing] = await Promise.all([
    tx.get(policyRef(db)),
    tx.get(db.collection('offerAdApprovalLedger').doc(uid)),
    tx.get(db.collection('offerAds').where('ownerId', '==', uid)),
  ]);
  const policy = freeOfferPolicy(settings.data());
  let lastApproval = ledger.data()?.lastApproval ?? 0;
  let pending = false;
  for (const doc of existing.docs) {
    const ad = doc.data() as StoredAd;
    if (ad.payment || doc.id === id) continue;
    // A legacy scheduled approval also occupies the free slot until its end.
    if (ad.status === 'approved' && ad.endsAt > now) return { ...policy, status: 'active' };
    if (ad.status === 'pending') pending = true;
    if (ad.status === 'approved' || ad.status === 'deleting') lastApproval = Math.max(lastApproval, ad.reviewedAt ?? 0);
  }
  if (pending) return { ...policy, status: 'pending' };
  const availableAt = lastApproval + policy.freeIntervalDays * DAY;
  if (lastApproval && availableAt > now) return { ...policy, status: 'interval', availableAt };
  return { ...policy, status: 'available' };
}

async function assertFreeOfferAvailable(...args: Parameters<typeof freeOfferEligibility>) {
  const eligibility = await freeOfferEligibility(...args);
  if (eligibility.status === 'active') fail('ad_active_exists', 409);
  if (eligibility.status === 'pending') fail('ad_pending_exists', 409);
  if (eligibility.status === 'interval') fail('ad_free_interval', 429);
  return eligibility;
}

function correctableVideoAd(ad: StoredAd | undefined, uid: string): ad is StoredAd & { status: 'rejected' } {
  return !!ad && ad.ownerId === uid && ad.status === 'rejected' && !ad.correctedBy && requiresVideoCorrection(ad);
}

export async function readOfferForRenewal(uid: string, payload: Payload, db = getAdminFirestore()) {
  const doc = await db.collection('offerAds').doc(adId(payload.id)).get();
  const ad = doc.data() as StoredAd | undefined;
  if (payload.correction === true) {
    if (!correctableVideoAd(ad, uid)) return fail('ad_correction_unavailable', 404);
    return { ...offerView(doc.id, ad), media: undefined };
  }
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
    const proposedMedia = ad.editRequest?.status === 'pending' ? ad.editRequest.mediaChange : null;
    return { media: ad.media, receipt: ad.receipt, proposedMedia };
  });
  if (!asset) return { removed: true };
  if (asset.media) {
    await destroy(uid, {
      publicId: asset.media.publicId, resourceType: asset.media.resourceType,
    }, undefined, undefined, 'submissions');
  }
  if (asset.proposedMedia) await destroy(uid, asset.proposedMedia, undefined, undefined, 'submissions');
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
    if (ad.priceLockedAt && (ad.uploadCleanupClaim?.expiresAt ?? 0) > Date.now()) return null;
    const claim = ad.priceLockedAt ? { id: randomUUID(), expiresAt: Date.now() + 5 * 60_000 } : undefined;
    const lease = activeUpload(db, ad.ownerId);
    const leaseData = (await tx.get(lease)).data();
    if (leaseData?.id === doc.id) tx.delete(lease);
    tx.update(doc.ref, { status: 'cancelled', ...(claim && { uploadCleanupClaim: claim }) });
    return { ownerId: ad.ownerId, type: ad.mediaType, paid: requiresPaidReceipt(ad.payment), claim, cleanupPublicId: ad.cleanupPublicId };
  });
  if (!asset) return;
  if (asset.type) await deleteAdminAdTestUpload(asset.ownerId, {
    publicId: asset.cleanupPublicId ?? `mybucket/ads/submissions/${asset.ownerId}/${doc.id}`, resourceType: asset.type,
  }, undefined, undefined, 'submissions');
  if (asset.paid) await deleteAdminAdTestUpload(asset.ownerId, {
    publicId: `mybucket/ads/receipts/${asset.ownerId}/${doc.id}`, resourceType: 'image',
  }, undefined, undefined, 'receipts');
  if (!asset.claim) {
    await doc.ref.delete();
    return;
  }
  await db.runTransaction(async tx => {
    const snapshot = await tx.get(doc.ref);
    if (snapshot.get('uploadCleanupClaim')?.id !== asset.claim?.id) return;
    tx.update(doc.ref, { status: 'draft', uploadDay: '', uploadCleanupAt: 0, uploadCleanupClaim: null });
  });
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

function scheduleRetiredAdMedia(tx: FirebaseFirestore.Transaction, db: ReturnType<typeof getAdminFirestore>, uid: string, media: StoredMedia) {
  tx.create(db.collection('offerAds').doc(), {
    ownerId: uid, status: 'cancelled', mediaType: media.resourceType,
    cleanupPublicId: media.publicId, uploadCleanupAt: Date.now() + DAY,
  });
}

export async function reviewOfferAdEdits(action: string, payload: Payload, db = getAdminFirestore()) {
  const ads = db.collection('offerAds');
  if (action === 'admin.ads.editRequests.list') {
    const result = await ads.where('editRequest.status', '==', 'pending').get();
    const reviews: OfferAdEditReview[] = [];
    for (const doc of result.docs) {
      const ad = doc.data() as StoredAd;
      const request = ad.editRequest;
      if (request?.status !== 'pending' || !isPublicOffer(ad, Date.now())) continue;
      reviews.push({
        original: offerView(doc.id, ad),
        proposed: offerView(doc.id, { ...ad, ...request.changes, media: request.mediaChange === undefined ? ad.media : request.mediaChange }),
        requestId: request.id, submittedAt: request.submittedAt,
      });
    }
    return reviews.sort((a, b) => a.submittedAt - b.submittedAt);
  }
  const ref = ads.doc(adId(payload.id));
  const requestId = adId(payload.requestId);
  const status = payload.status;
  if (status !== 'approved' && status !== 'rejected') return fail('invalid_ad_status');
  const reason = status === 'rejected' ? field(payload.reason ?? '', 500, false) : '';
  return db.runTransaction(async tx => {
    const ad = (await tx.get(ref)).data() as StoredAd | undefined;
    const request = ad?.editRequest;
    if (!ad || !request || request.id !== requestId) return fail('ad_edit_request_unavailable', 409);
    if (request.status === status) return { status };
    if (request.status !== 'pending' || !isPublicOffer(ad, Date.now())) return fail('ad_edit_request_unavailable', 409);
    const retired = status === 'approved' && request.mediaChange !== undefined ? ad.media
      : status === 'rejected' ? request.mediaChange : null;
    if (retired) scheduleRetiredAdMedia(tx, db, ad.ownerId, retired);
    tx.update(ref, {
      editRequest: { id: requestId, status, reason },
      ...(status === 'approved' && {
        ...request.changes, editRevision: requestId,
        ...(request.mediaChange !== undefined && { media: request.mediaChange, mediaType: request.mediaChange?.resourceType ?? null }),
      }),
    });
    return { status };
  });
}

export async function editOwnOfferAd(action: string, uid: string, payload: Payload, db = getAdminFirestore(), confirmUpload = confirmAdminAdTestUpload) {
  const direct = action.startsWith('admin.ads.edit.');
  const operation = action.split('.').at(-1);
  const ads = db.collection('offerAds');
  const ref = ads.doc(adId(payload.id));
  const editable = (snapshot: FirebaseFirestore.DocumentSnapshot) => {
    const ad = snapshot.data() as StoredAd | undefined;
    if (!ad || ad.ownerId !== uid || (ad.status !== 'pending' && ad.status !== 'approved' && ad.status !== 'rejected')) {
      return fail('ad_edit_unavailable', 404);
    }
    if (!direct && !isPublicOffer(ad, Date.now())) return fail('ad_edit_unavailable', 404);
    return ad;
  };
  const checkRequest = (ad: StoredAd) => {
    if (direct) return;
    if (ad.editRequest?.status === 'pending') fail('ad_edit_request_pending', 409);
    if ((ad.editRequestsUsed ?? 0) >= OFFER_EDIT_REQUEST_LIMIT) fail('ad_edit_request_limit', 409);
  };
  if (operation === 'read') {
    const ad = editable(await ref.get());
    checkRequest(ad);
    return { ...offerView(ref.id, ad), editRevision: ad.editRevision ?? '' };
  }
  const getChanges = (ad: StoredAd) => {
    const fields = adTextFields(payload);
    validateAdContent(fields, !!ad.payment);
    return {
      ...fields,
      contact: ad.payment ? ad.contact ?? '' : fields.contact,
      callPhone: normalizeAdPhone(fields.callPhone ?? '') ?? '',
      whatsappPhone: normalizeAdPhone(fields.whatsappPhone ?? '', true) ?? '',
      mapsUrl: normalizeGoogleMapsUrl(fields.mapsUrl ?? '') ?? '',
    };
  };
  const checkRevision = (ad: StoredAd) => {
    if ((ad.editRevision ?? '') !== payload.editRevision) return fail('ad_edit_conflict', 409);
  };
  if (operation === 'prepare') {
    return db.runTransaction(async tx => {
      const ad = editable(await tx.get(ref));
      checkRequest(ad);
      checkRevision(ad);
      getChanges(ad);
      const mediaType = payload.resourceType;
      if (mediaType !== 'image' && (mediaType !== 'video' || !ad.payment)) return fail('invalid_media_type');
      if ((await tx.get(policyRef(db))).data()?.uploadsPaused === true) return fail('ad_upload_paused', 503);
      const operationId = randomUUID();
      const now = Date.now();
      const signed = signAdminAdTestUpload(uid, payload, undefined, now, operationId, 'submissions');
      if (!direct) {
        const usage = uploadUsage(db, cairoDay.format(now)).doc(uid);
        const issued = (await tx.get(usage)).data()?.issued ?? 0;
        if (issued >= MAX_UPLOADS) return fail('ad_upload_daily_limit', 429);
        tx.set(usage, { issued: issued + 1, limit: MAX_UPLOADS }, { merge: true });
      }
      tx.create(ads.doc(operationId), {
        ownerId: uid, status: 'cancelled', editTarget: ref.id, mediaType, uploadCleanupAt: now + DAY,
        ...(!direct && { uploadDay: cairoDay.format(now) }),
      });
      return { editId: operationId, signed };
    });
  }
  if (operation !== 'save') return fail('ad_edit_unavailable', 404);
  const operationId = adId(payload.editId);
  if (operationId === ref.id) return fail('invalid_ad_id');
  const upload = ads.doc(operationId);
  const ad = editable(await ref.get());
  const alreadySaved = (ad: StoredAd) => direct ? ad.editRevision === operationId : ad.editRequest?.id === operationId;
  if (alreadySaved(ad)) return { saved: true };
  checkRequest(ad);
  checkRevision(ad);
  const changes = getChanges(ad);
  const replace = payload.mediaAction === 'replace';
  if (!replace && payload.mediaAction !== 'keep' && payload.mediaAction !== 'remove') return fail('invalid_media_type');
  const activeReplacement = (snapshot: FirebaseFirestore.DocumentSnapshot) => {
    const staged = snapshot.data() as StoredAd | undefined;
    if (staged?.ownerId !== uid || staged.editTarget !== ref.id || staged.status !== 'cancelled' ||
        (staged.uploadCleanupAt ?? 0) <= Date.now() || staged.mediaType !== payload.resourceType ||
        payload.publicId !== `mybucket/ads/submissions/${uid}/${operationId}`) return fail('invalid_upload_request');
    return staged;
  };
  let media: StoredMedia | null = null;
  let verifiedBytes = 0;
  if (replace) {
    activeReplacement(await upload.get());
    const { publicId, resourceType, version, format, bytes } = await confirmUpload(uid, payload, undefined, undefined, 'submissions', adVideoLimit(offerTier(ad)));
    media = { publicId, resourceType, version, format };
    verifiedBytes = bytes;
  }
  await db.runTransaction(async tx => {
    const current = editable(await tx.get(ref));
    if (alreadySaved(current)) return;
    checkRequest(current);
    checkRevision(current);
    if (replace) {
      const staged = activeReplacement(await tx.get(upload));
      if (staged.uploadDay) {
        const usage = uploadUsage(db, staged.uploadDay).doc(uid);
        const stats = (await tx.get(usage)).data();
        tx.set(usage, { verified: (stats?.verified ?? 0) + 1, bytes: (stats?.bytes ?? 0) + verifiedBytes }, { merge: true });
      }
      tx.delete(upload);
    }
    const changingMedia = payload.mediaAction !== 'keep';
    if (!direct) {
      const editRequest: OfferEditRequest = {
        id: operationId, status: 'pending', submittedAt: Date.now(), changes,
        ...(changingMedia && { mediaChange: media }),
      };
      tx.update(ref, { editRequest, editRequestsUsed: (current.editRequestsUsed ?? 0) + 1 });
      return;
    }
    if (changingMedia && current.media) scheduleRetiredAdMedia(tx, db, uid, current.media);
    tx.update(ref, {
      ...changes, editRevision: operationId,
      ...(changingMedia && { media, mediaType: media?.resourceType ?? null }),
    });
  });
  return { saved: true };
}

export async function sendOfferAd(action: string, uid: string, payload: Payload, db = getAdminFirestore(), isOwner = false, destroy = deleteAdminAdTestUpload) {
  const uploadLimit = isOwner ? OWNER_MAX_UPLOADS : MAX_UPLOADS;
  if (action === 'ads.paidPrices') return paidOfferPrices((await policyRef(db).get()).data());
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
    return freeOfferPolicy((await policyRef(db).get()).data());
  }
  if (action === 'ads.freeEligibility') {
    return db.runTransaction(tx => freeOfferEligibility(db, tx, uid, '', Date.now()), { readOnly: true });
  }
  if (action === 'ads.renewal') return readOfferForRenewal(uid, payload, db);
  const id = adId(payload.id);
  if (action === 'ads.deleteExpired') return removeExpiredOffer(uid, id, db);
  const ref = db.collection('offerAds').doc(id);

  if (action === 'ads.resumePayment') {
    const ad = (await ref.get()).data() as StoredAd | undefined;
    if (!ad || ad.ownerId !== uid || (ad.status !== 'draft' && ad.status !== 'cancelled') || !ad.priceLockedAt || ad.payment?.dailyPriceEgp === undefined) {
      return fail('ad_invoice_unavailable', 404);
    }
    return { ...offerView(id, ad), mediaType: ad.mediaType, payment: ad.payment,
      createdAt: ad.priceLockedAt, legacyTransfer: ad.legacyTransfer, videoLimit: ad.adContentVersion ? adVideoLimit(offerTier(ad)) : 60 };
  }

  if (action === 'ads.cancel') {
    const assets = await db.runTransaction(async tx => {
      const draft = (await tx.get(ref)).data() as StoredAd | undefined;
      if (!draft) return null;
      if (draft.ownerId !== uid) return fail('invalid_ad_id', 403);
      if (draft.editTarget || draft.cleanupPublicId) return fail('ad_cancelled', 409);
      if (draft.status === 'cancelled') return { mediaType: draft.mediaType, paid: !!draft.payment };
      if (draft.status !== 'draft') return fail('ad_already_submitted', 409);
      if (draft.priceLockedAt) return fail('ad_invoice_locked', 409);
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

  if (action === 'ads.prepare' || action === 'ads.lockPrice') {
    const lockPrice = action === 'ads.lockPrice';
    if (!lockPrice && payload.legacyTransfer !== undefined) return fail('invalid_ad_details');
    const legacyTransfer = payload.legacyTransfer === undefined ? undefined : readLegacyTransfer(payload.legacyTransfer);
    if (payload.tier !== undefined && payload.tier !== 'free' && payload.tier !== 'featured' && payload.tier !== 'vip') return fail('invalid_ad_details');
    const paidTier = payload.tier === 'featured' || payload.tier === 'vip' ? payload.tier : null;
    const featured = paidTier !== null;
    if (lockPrice && !featured) return fail('invalid_ad_details');
    const duration = payload.vipDurationDays;
    if ((duration !== undefined && (paidTier !== 'vip' || !validVipDurationDays(duration))) ||
        (lockPrice && paidTier === 'vip' && duration === undefined)) return fail('ad_invalid_vip_duration');
    const fields = adFields(payload, featured, validVipDurationDays(duration) ? duration : undefined);
    const correctionId = payload.correctionId === undefined ? undefined : adId(payload.correctionId);
    if (correctionId && (featured || correctionId === id)) return fail('invalid_ad_details');
    const phone = typeof payload.paymentPhone === 'string' && payload.paymentPhone.length <= 24 ? normalizePaymentContactPhone(payload.paymentPhone) : null;
    if (featured && !phone) return fail('invalid_payment_phone');
    const days = featured ? adRunDays(new Date(fields.startsAt), new Date(fields.endsAt)) : null;
    if (featured && (days === null || typeof payload.amountEgp !== 'number' || !Number.isSafeInteger(payload.amountEgp) || payload.amountEgp < 0)) {
      return fail('invalid_payment_amount');
    }
    const mediaType = payload.resourceType;
    if (mediaType !== null && mediaType !== 'image' && mediaType !== 'video') return fail('invalid_media_type');
    if (!featured && mediaType === 'video') return fail('ad_free_image_only');
    return db.runTransaction(async tx => {
      const now = Date.now();
      const day = cairoDay.format(now);
      const existing = (await tx.get(ref)).data() as StoredAd | undefined;
      if (existing && existing.ownerId !== uid) return fail('invalid_ad_id', 403);
      if (existing?.status === 'cancelled') return fail('ad_cancelled', 409);
      if (existing && existing.status !== 'draft') {
        if (lockPrice) return fail('ad_already_submitted', 409);
        return { submitted: true, signed: null };
      }
      const applyContentPolicy = !existing?.payment || existing.adContentVersion === 1;
      if (applyContentPolicy) {
        validateAdContent(fields, featured);
        if (fields.callPhone) fields.callPhone = normalizeAdPhone(fields.callPhone) ?? '';
        if (fields.whatsappPhone) fields.whatsappPhone = normalizeAdPhone(fields.whatsappPhone, true) ?? '';
        if (fields.mapsUrl) fields.mapsUrl = normalizeGoogleMapsUrl(fields.mapsUrl) ?? '';
      }
      if (!featured) await assertFreeOfferAvailable(db, tx, uid, id, now);
      if (existing && (existing.payment ? existing.payment.tier ?? 'featured' : null) !== paidTier) return fail('invalid_ad_details');
      if (existing && existing.correctionId !== correctionId) return fail('invalid_ad_details');
      if (correctionId) {
        const original = (await tx.get(db.collection('offerAds').doc(correctionId))).data() as StoredAd | undefined;
        if (!correctableVideoAd(original, uid)) return fail('ad_correction_unavailable', 404);
      }
      if (existing && existing.mediaType !== mediaType) return fail('invalid_media_type');
      let payment = existing?.payment;
      if (payment) {
        const previous = existing?.legacyTransfer;
        const sameClaim = !lockPrice || (previous?.reference === legacyTransfer?.reference &&
          previous?.transferredAt === legacyTransfer?.transferredAt && previous?.amountEgp === legacyTransfer?.amountEgp);
        const sameInvoice = sameClaim && existing?.vipDurationDays === fields.vipDurationDays && payment.phone === phone &&
          Object.entries(fields).every(([key, value]) => (existing?.[key as keyof StoredAd] ?? '') === value) &&
          (['callPhone', 'whatsappPhone', 'mapsUrl'] as const).every(key => (existing?.[key] ?? '') === (fields[key] ?? ''));
        if (!sameInvoice || payment.amountEgp !== payload.amountEgp) return fail('ad_invoice_mismatch', 409);
      } else if (paidTier && days !== null && phone) {
        if (!lockPrice) return fail('ad_invoice_not_locked', 409);
        const prices = legacyTransfer ? DEFAULT_PAID_AD_PRICES : paidOfferPrices((await tx.get(policyRef(db))).data());
        const dailyPriceEgp = paidAdDailyPrice(paidTier, prices);
        const amountEgp = days * dailyPriceEgp;
        if (!Number.isSafeInteger(amountEgp)) return fail('invalid_payment_amount');
        if (payload.amountEgp !== amountEgp) return { priceChanged: true, prices };
        payment = { method: 'instapay', tier: paidTier, amountEgp, dailyPriceEgp, phone };
      }

      if (lockPrice) {
        if (!payment || payment.dailyPriceEgp === undefined || (existing && !existing.priceLockedAt)) return fail('ad_invoice_unavailable', 409);
        if (!existing) tx.create(ref, {
          ...fields, ownerId: uid, status: 'draft', mediaType, media: null,
          submittedAt: 0, rejectionReason: '', payment, priceLockedAt: now, adContentVersion: 1, ...(legacyTransfer && { legacyTransfer }),
        });
        return { priceChanged: false, dailyPriceEgp: payment.dailyPriceEgp, amountEgp: payment.amountEgp,
          createdAt: existing?.priceLockedAt ?? now, ...((existing?.legacyTransfer ?? legacyTransfer) && { legacyTransfer: existing?.legacyTransfer ?? legacyTransfer }) };
      }
      let signed = null;
      let receiptSigned = null;
      const receiptRequired = requiresPaidReceipt(payment);
      const permits = Number(!!mediaType || receiptRequired);
      if (permits) {
        const reissue = Boolean(existing?.priceLockedAt && existing.uploadDay);
        if (existing?.uploadDay && !reissue) return fail('ad_upload_already_issued', 409);
        if (reissue && (existing?.uploadCleanupAt ?? 0) <= now) return fail('ad_upload_cleanup_pending', 409);
        const usage = uploadUsage(db, day).doc(uid);
        const lease = activeUpload(db, uid);
        const [used, active, policy] = await Promise.all([tx.get(usage), tx.get(lease), tx.get(policyRef(db))]);
        if (policy.data()?.uploadsPaused === true) return fail('ad_upload_paused', 503);
        const count = used.data()?.issued ?? 0;
        if (!reissue && count + permits > uploadLimit) return fail('ad_upload_daily_limit', 429);
        if ((active.data()?.expiresAt ?? 0) > now && (!reissue || active.data()?.id !== id)) return fail('ad_upload_active', 409);
        if (mediaType) signed = signAdminAdTestUpload(uid, payload, undefined, now, id, 'submissions');
        if (receiptRequired) receiptSigned = signAdminAdTestUpload(uid, {
          resourceType: 'image', bytes: payload.receiptBytes,
        }, undefined, now, id, 'receipts');
        if (!reissue) tx.set(usage, { issued: count + permits, limit: uploadLimit }, { merge: true });
        tx.set(lease, { id, expiresAt: Math.min(now + 3600000, existing?.uploadCleanupAt || Infinity) });
      } else if (!existing || (payment && !existing.paidPrepared)) {
        const quota = db.collection('offerAdUploadLimits').doc(`${uid}_${day}`);
        const count = (await tx.get(quota)).data()?.count ?? 0;
        if (count >= 5) return fail('ad_daily_limit', 429);
        tx.set(quota, { count: count + 1 });
      }
      tx.set(ref, {
        ...fields, ownerId: uid, status: 'draft', mediaType, media: null, submittedAt: 0, rejectionReason: '',
        ...(correctionId && { correctionId }),
        ...(permits && { uploadDay: existing?.uploadDay || day, uploadCleanupAt: existing?.uploadCleanupAt || now + DAY }),
        ...(payment && { payment }),
        ...(applyContentPolicy && { adContentVersion: 1 }),
        ...(existing?.priceLockedAt && { priceLockedAt: existing.priceLockedAt }),
        ...(existing?.legacyTransfer && { legacyTransfer: existing.legacyTransfer }),
        ...(payment && !permits && { paidPrepared: true }),
      });
      return { submitted: false, signed, receiptSigned };
    });
  }

  const draft = (await ref.get()).data() as StoredAd | undefined;
  if (!draft || draft.ownerId !== uid) return fail('invalid_ad_id', 403);
  if (draft.status === 'cancelled') return fail('ad_cancelled', 409);
  if (draft.status !== 'draft') return { submitted: true };
  if (draft.payment) {
    if (!draft.vipDurationDays) expiry(draft, Date.now(), true);
    if (draft.payment.dailyPriceEgp !== undefined && !draft.uploadDay && !draft.paidPrepared) return fail('ad_invoice_not_prepared', 409);
  }
  if (!draft.payment || draft.adContentVersion) validateAdContent(draft, !!draft.payment);
  if (requiresVideoCorrection(draft)) return fail('ad_free_image_only');

  let media: StoredMedia | null = null;
  let verifiedBytes = 0;
  if (draft.mediaType) {
    const publicId = `mybucket/ads/submissions/${uid}/${id}`;
    if (payload.publicId !== publicId || payload.resourceType !== draft.mediaType) return fail('invalid_upload_request');
    const confirmed = await confirmAdminAdTestUpload(uid, payload, undefined, undefined, 'submissions',
      draft.adContentVersion ? adVideoLimit(offerTier(draft)) : 60);
    verifiedBytes = confirmed.bytes;
    media = { publicId, resourceType: confirmed.resourceType, version: confirmed.version, format: confirmed.format };
  }
  let receipt: StoredMedia | undefined;
  if (requiresPaidReceipt(draft.payment)) {
    const proof = payload.receipt;
    const publicId = `mybucket/ads/receipts/${uid}/${id}`;
    if (!proof || typeof proof !== 'object') return fail('receipt_required');
    const receiptPayload = proof as Payload;
    if (receiptPayload.publicId !== publicId || receiptPayload.resourceType !== 'image') return fail('invalid_upload_request');
    const confirmed = await confirmAdminAdTestUpload(uid, receiptPayload, undefined, undefined, 'receipts');
    verifiedBytes += confirmed.bytes;
    receipt = { publicId, resourceType: 'image', version: confirmed.version, format: confirmed.format };
  }
  const originalRef = draft.correctionId ? db.collection('offerAds').doc(draft.correctionId) : null;
  if (originalRef) {
    const original = (await originalRef.get()).data() as StoredAd | undefined;
    if (!correctableVideoAd(original, uid)) {
      // A retried request may be observing its own successful correction.
      if (original?.ownerId === uid && original.correctedBy === id) return { submitted: true };
      return fail('ad_correction_unavailable', 404);
    }
    const publicId = original.media?.publicId ?? `mybucket/ads/submissions/${uid}/${originalRef.id}`;
    // The original is already rejected and cannot be published. Repeated removal
    // is safe, and a provider failure leaves both records available for retry.
    await destroy(uid, { publicId, resourceType: 'video' }, undefined, undefined, 'submissions');
  }

  await db.runTransaction(async tx => {
    const latest = (await tx.get(ref)).data() as StoredAd | undefined;
    if (!latest || latest.ownerId !== uid) return fail('invalid_ad_id', 403);
    if (latest.status === 'cancelled') return fail('ad_cancelled', 409);
    if (latest.status !== 'draft') return;
    if (latest.payment && !latest.vipDurationDays) expiry(latest, Date.now(), true);
    if (!latest.payment || latest.adContentVersion) validateAdContent(latest, !!latest.payment);
    if (requiresVideoCorrection(latest)) return fail('ad_free_image_only');
    if (!latest.payment) await assertFreeOfferAvailable(db, tx, uid, id, Date.now());
    if (latest.correctionId !== draft.correctionId) return fail('invalid_ad_details');
    if (originalRef) {
      const original = (await tx.get(originalRef)).data() as StoredAd | undefined;
      if (!correctableVideoAd(original, uid)) return fail('ad_correction_unavailable', 404);
    }
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
    if (originalRef) tx.update(originalRef, { correctedBy: id, mediaType: null, media: null });
    tx.update(ref, { status: 'pending', submittedAt: Date.now(), media, uploadCleanupAt: 0, ...(receipt && { receipt }) });
  });
  return { submitted: true };
}

export async function reviewOfferAds(action: string, uid: string, payload: Payload, db = getAdminFirestore()) {
  if (action === 'admin.ads.prices') {
    const ref = policyRef(db);
    if (payload.featured === undefined && payload.vip === undefined) return paidOfferPrices((await ref.get()).data());
    if (!isPaidAdPrice(payload.featured) || !isPaidAdPrice(payload.vip)) return fail('invalid_ad_prices');
    const paidPrices = { featured: payload.featured, vip: payload.vip };
    await db.runTransaction(async tx => {
      const settings = (await tx.get(ref)).data();
      const previous = paidOfferPrices(settings);
      const changed = previous.featured !== paidPrices.featured || previous.vip !== paidPrices.vip;
      tx.set(ref, { paidPrices, ...(changed && settings?.firstPaidPriceChangeAt === undefined && { firstPaidPriceChangeAt: Date.now() }) }, { merge: true });
    });
    return paidPrices;
  }
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
    const updates: Record<string, number> = {};
    for (const [field, key] of [['freeIntervalDays', 'freeWaitDays'], ['freeDurationDays', 'freeDurationDays']] as const) {
      const days = payload[field];
      if (days === undefined) continue;
      if (typeof days !== 'number' || !Number.isInteger(days) || days < 1 || days > 90) return fail('invalid_ad_policy');
      updates[key] = days;
    }
    if (Object.keys(updates).length) await ref.set(updates, { merge: true });
    return freeOfferPolicy((await ref.get()).data());
  }
  if (action === 'admin.ads.list') {
    const status = payload.status ?? 'pending';
    if (status !== 'pending' && status !== 'approved' && status !== 'rejected') return fail('invalid_ad_status');
    const snapshot = await db.collection('offerAds').where('status', '==', status).get();
    const campaigns = await readVipPushCampaigns(db, status === 'approved'
      ? snapshot.docs.filter(doc => doc.get('payment.tier') === 'vip').map(doc => doc.id)
      : []);
    return snapshot.docs.map(doc => {
      const ad = doc.data() as StoredAd;
      return { ...offerView(doc.id, ad), status, submittedAt: ad.submittedAt, rejectionReason: ad.rejectionReason,
        ...(ad.legacyTransfer && { legacyTransfer: ad.legacyTransfer }),
        ...(campaigns.has(doc.id) && { vipPushCampaign: campaigns.get(doc.id) }),
        ...(ad.formerVipSchedule && { formerVipSchedule: ad.formerVipSchedule }),
        ...(ad.confirmedTransfer && { confirmedTransfer: ad.confirmedTransfer }),
        requiresVideoCorrection: !ad.correctedBy && requiresVideoCorrection(ad),
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
    if (ad.legacyTransfer && status === 'rejected') return fail('ad_legacy_transfer_pending', 409);
    const now = Date.now();
    if (status === 'approved' && requiresVideoCorrection(ad)) return fail('ad_free_image_only', 409);
    // Admin approves regular paid ads after reviewing the submitted image, including test receipts.
    // This is not automated bank payment verification.
    if (status === 'approved' && requiresPaidReceipt(ad.payment) && !ad.receipt) return fail('receipt_required');
    // Existing exceptional old-transfer claims retain their separate reconciliation rules.
    if (status === 'approved' && ad.legacyTransfer && payload.paymentConfirmed !== true) return fail('payment_confirmation_required');
    const approveVip = status === 'approved' && ad.payment?.tier === 'vip';
    const formerVipSchedule = approveVip && !ad.vipDurationDays && ad.startsAt > now
      ? { startsAt: ad.startsAt, endsAt: ad.endsAt } : undefined;
    if (formerVipSchedule && payload.publishVipNow !== true) return fail('ad_vip_immediate_confirmation_required', 409);
    let confirmedTransfer: StoredAd['confirmedTransfer'];
    if (status === 'approved' && ad.legacyTransfer && ad.payment && requiresPaidReceipt(ad.payment)) {
      const reference = normalizeAdTransferReference(payload.transferReference);
      if (!reference) return fail('invalid_transfer_reference');
      if (payload.receivedAmountEgp !== ad.payment.amountEgp) return fail('ad_transfer_amount_mismatch', 409);
      if (ad.legacyTransfer) {
        const settings = (await tx.get(policyRef(db))).data();
        const firstChange = settings?.firstPaidPriceChangeAt;
        const currentPrices = paidOfferPrices(settings);
        if (reference !== ad.legacyTransfer.reference || payload.receivedAt !== ad.legacyTransfer.transferredAt ||
          ad.legacyTransfer.amountEgp !== ad.payment.amountEgp) return fail('ad_legacy_transfer_mismatch', 409);
        if (firstChange === undefined) {
          if (currentPrices.featured !== DEFAULT_PAID_AD_PRICES.featured || currentPrices.vip !== DEFAULT_PAID_AD_PRICES.vip) {
            return fail('ad_legacy_transfer_cutoff_unknown', 409);
          }
        } else if (!Number.isSafeInteger(firstChange) || ad.legacyTransfer.transferredAt >= firstChange) {
          return fail('ad_legacy_transfer_after_cutoff', 409);
        }
      }
      // The subscription approval path checks this same index before claiming a transfer.
      const used = db.doc(`subscriptionPaymentReferences/${createHash('sha256').update(reference).digest('hex')}`);
      if ((await tx.get(used)).exists) return fail('reference_already_used', 409);
      confirmedTransfer = { reference, amountEgp: ad.payment.amountEgp,
        ...(ad.legacyTransfer && { transferredAt: ad.legacyTransfer.transferredAt }) };
      tx.create(used, { offerAdId: ref.id, reviewedBy: uid, reviewedAt: now });
    }
    let { startsAt, endsAt } = ad;
    if (status === 'approved') {
      if (ad.payment) {
        startsAt = approveVip ? now : Math.max(now, ad.startsAt);
        endsAt += startsAt - ad.startsAt;
      } else {
        const policy = await assertFreeOfferAvailable(db, tx, ad.ownerId, ref.id, now);
        startsAt = now;
        endsAt = now + policy.freeDurationDays * DAY;
        tx.set(db.collection('offerAdApprovalLedger').doc(ad.ownerId), { lastApproval: now }, { merge: true });
      }
    }
    if (status === 'approved' && ad.payment?.tier === 'vip') queueVipPush(tx, db, ref.id, startsAt, endsAt);
    tx.update(ref, { status, rejectionReason, reviewerId: uid, reviewedAt: now, startsAt, endsAt,
      publishedUntil: status === 'approved' ? endsAt : 0, ...(formerVipSchedule && { formerVipSchedule }), ...(confirmedTransfer && { paymentConfirmedAt: now, confirmedTransfer }) });
    return { status };
  });
}
