import { createHash, randomUUID } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { activeGrant, grantFromAccess } from '../src/config/grantPolicy.js';
import { getAdminFirestore } from './firebaseAdmin.js';
import { getOrCreateSubscription, SubscriptionError } from './subscriptionService.js';
import { signAdminAdTestUpload, confirmAdminAdTestUpload } from './adminAdTestUpload.js';
import { BASIC_PRICE_EGP, BASIC_MARKETER_PRICE_EGP, PRO_PRICE_EGP, PRO_MARKETER_PRICE_EGP } from '../src/config/subscriptionPolicy.js';

type Plan = 'basic' | 'pro';
type Status = 'pending' | 'correction' | 'approved';
type Payment = {
  uid: string; email: string | null; id: string; plan: Plan; amount: number; code: string | null;
  status: Status; reference?: string; createdAt: string; reviewedAt?: string; reason?: string; paidExpiresAt?: string;
  receipt: { publicId: string; format: string };
};

function fail(code: string, status = 400): never {
  throw new SubscriptionError(status, code, code);
}

function receiptUrl(receipt: Payment['receipt']) {
  const path = `${receipt.publicId}.${receipt.format}`;
  const signature = createHash('sha1').update(path + process.env.CLOUDINARY_API_SECRET).digest('base64url').slice(0, 8);
  return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/authenticated/s--${signature}--/${path}`;
}

export async function subscriptionPayment(action: string, user: { uid: string; email: string | null }, payload: Record<string, unknown>, db = getAdminFirestore()) {
  const latest = db.doc(`subscriptionPaymentLatest/${user.uid}`);
  const requests = db.collection('subscriptionPaymentRequests');
  if (action.startsWith('admin.') && user.email?.trim().toLowerCase() !== 'waelvts@gmail.com') fail('admin_only', 403);

  if (action === 'admin.subscriptionPayment.list') {
    const status = payload.status === 'approved' || payload.status === 'correction' ? payload.status : 'pending';
    const list = await requests.where('status', '==', status).limit(100).get();
    return list.docs.map(doc => doc.data() as Payment)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, 100).map(payment => ({ ...payment, receiptUrl: receiptUrl(payment.receipt) }));
  }

  if (action === 'admin.subscriptionPayment.review') {
    const { id, decision } = payload;
    if (typeof id !== 'string' || !/^[a-f0-9-]{36}$/.test(id) || (decision !== 'approve' && decision !== 'correction')) fail('invalid_review');
    const reason = typeof payload.reason === 'string' ? payload.reason.trim() : '';
    if (decision === 'correction' && (!reason || reason.length > 300)) fail('reason_required');
    const ref = requests.doc(id);
    return db.runTransaction(async tx => {
      const payment = (await tx.get(ref)).data() as Payment | undefined;
      if (!payment) return fail('payment_not_found', 404);
      if (payment.status !== 'pending') return { status: payment.status };
      const reviewed = { reviewedAt: new Date().toISOString(), reviewedBy: user.uid };
      if (decision === 'correction') {
        tx.update(ref, { ...reviewed, status: 'correction', reason });
        return { status: 'correction' };
      }
      const billing = db.doc(`users/${payment.uid}/billing/subscription`);
      const access = db.doc(`users/${payment.uid}/billing/access`);
      const supplied = typeof payload.reference === 'string' ? payload.reference : payment.reference ?? '';
      const reference = supplied.trim().replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) & 15))
        .replace(/\s+/g, '').toUpperCase();
      if (!/^[A-Z0-9-]{5,48}$/.test(reference)) fail('invalid_transfer_reference');
      const used = db.doc(`subscriptionPaymentReferences/${createHash('sha256').update(reference).digest('hex')}`);
      const [current, permission, duplicate] = await Promise.all([tx.get(billing), tx.get(access), tx.get(used)]);
      if (duplicate.exists) fail('reference_already_used', 409);
      if (!current.exists || !permission.exists) fail('access_record_missing', 409);
      const now = Date.now();
      const previousExpiry = Date.parse(current.get('paidExpiresAt') || '');
      if (current.get('isPaid') && previousExpiry > now && (current.get('paidPlan') || 'pro') !== payment.plan) fail('active_other_plan', 409);
      const grant = activeGrant(grantFromAccess(permission.data() || null), now);
      const grantEnd = payment.plan === 'pro' && grant?.plan === 'pro' ? Date.parse(grant.endsAt) : 0;
      const start = Math.max(now, grantEnd, current.get('isPaid') && Number.isFinite(previousExpiry) ? previousExpiry : 0);
      const expiry = new Date(start + 30 * 86400000);
      const paidExpiresAt = expiry.toISOString();
      const approvedBefore = Number(current.get('manualPaymentsApproved') || 0);
      const commission = payment.code ? (payment.plan === 'basic' ? (approvedBefore ? 10 : 25) : (approvedBefore ? 20 : 50)) : 0;
      tx.create(used, { requestId: id });
      tx.update(billing, {
        isPaid: true, status: 'paid', paidPlan: payment.plan, paidExpiresAt,
        monthlyPriceEgp: payment.amount, manualPaymentsApproved: approvedBefore + 1, updatedAt: reviewed.reviewedAt,
      });
      tx.update(access, { paidUntil: Timestamp.fromDate(expiry) });
      tx.update(ref, { ...reviewed, status: 'approved', reference, paidExpiresAt, commission });
      return { status: 'approved', paidExpiresAt };
    });
  }

  if (!['subscriptionPayment.status', 'subscriptionPayment.quote', 'subscriptionPayment.prepare', 'subscriptionPayment.submit'].includes(action)) fail('invalid_gateway_action');
  const pointer = (await latest.get()).data();
  if (action === 'subscriptionPayment.status') {
    if (!pointer?.id) return null;
    const payment = (await requests.doc(pointer.id).get()).data() as Payment | undefined;
    if (!payment) return null;
    return { id: payment.id, status: payment.status, plan: payment.plan, amount: payment.amount, createdAt: payment.createdAt, reviewedAt: payment.reviewedAt, reason: payment.reason, paidExpiresAt: payment.paidExpiresAt, receiptUrl: receiptUrl(payment.receipt) };
  }
  const plan = payload.plan;
  if (plan !== 'basic' && plan !== 'pro') return fail('invalid_plan');
  const sub = await getOrCreateSubscription(user.uid, undefined, true);
  if (sub.isPaid && Date.parse(sub.paidExpiresAt || '') > Date.now() && (sub.paidPlan || 'pro') !== plan) fail('active_other_plan', 409);
  const code = sub.hasAppliedAffiliateCode ? sub.affiliateCode : null;
  const amount = plan === 'basic' ? (code ? BASIC_MARKETER_PRICE_EGP : BASIC_PRICE_EGP) : (code ? PRO_MARKETER_PRICE_EGP : PRO_PRICE_EGP);
  if (pointer?.id) {
    const current = await requests.doc(pointer.id).get();
    if (action === 'subscriptionPayment.submit' && payload.publicId === current.get('receipt.publicId')) {
      return { id: current.id, status: current.get('status'), amount: current.get('amount') };
    }
    if (current.get('status') === 'pending') fail('payment_already_pending', 409);
  }
  if (action === 'subscriptionPayment.quote') return { amount };
  if (action === 'subscriptionPayment.prepare') {
    const now = Date.now();
    const signed = signAdminAdTestUpload(user.uid, { resourceType: 'image', bytes: payload.bytes }, undefined, now, randomUUID(), 'subscription-receipts');
    const quota = db.doc(`subscriptionPaymentUploadLimits/${user.uid}`);
    await db.runTransaction(async tx => {
      const history = (await tx.get(quota)).data();
      const attempts = history?.hour === Math.floor(now / 3600000) ? Number(history.attempts) : 0;
      if (attempts >= 8) fail('receipt_upload_limit', 429);
      tx.set(quota, { hour: Math.floor(now / 3600000), attempts: attempts + 1 });
    });
    return signed;
  }

  if (payload.quotedAmount !== amount) fail('payment_price_changed', 409);
  const verified = await confirmAdminAdTestUpload(user.uid, { ...payload, resourceType: 'image' }, undefined, fetch, 'subscription-receipts');
  console.info('[subscription-payment] receipt verified');
  const id = verified.publicId.split('/').at(-1)!;
  const ref = requests.doc(id);
  await db.runTransaction(async tx => {
    const [current, existing] = await Promise.all([tx.get(latest), tx.get(ref)]);
    if (existing.exists) return;
    const currentId = current.get('id');
    if (currentId && (await tx.get(requests.doc(currentId))).get('status') === 'pending') fail('payment_already_pending', 409);
    tx.create(ref, {
      uid: user.uid, email: user.email, id, plan, amount, code, status: 'pending',
      createdAt: new Date().toISOString(), receipt: { publicId: verified.publicId, format: verified.format },
    } satisfies Payment);
    tx.set(latest, { id });
  });
  console.info('[subscription-payment] request saved');
  return { id, status: 'pending', amount };
}
