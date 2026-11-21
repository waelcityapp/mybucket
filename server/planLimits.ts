import { parsePlanFeatureCopy } from '../src/config/planLimitFeatures.js';
import { FieldValue } from 'firebase-admin/firestore';
import { DEFAULT_PLAN_LIMITS, isPlanLimit, parsePlanLimits, type PlanLimitsDraft } from '../src/config/planLimits.js';
import { getAdminFirestore } from './firebaseAdmin.js';
import { SubscriptionError } from './subscriptionService.js';

const DRAFT_PATH = 'appSettings/planLimitsDraft';

function readDraft(snapshot: FirebaseFirestore.DocumentSnapshot): PlanLimitsDraft {
  if (!snapshot.exists) return { limits: DEFAULT_PLAN_LIMITS, copy: {}, revision: 0 };
  const limits = parsePlanLimits(snapshot.get('limits'));
  const copy = parsePlanFeatureCopy(snapshot.get('copy'));
  const revision: unknown = snapshot.get('revision');
  if (!limits || !copy || !isPlanLimit(revision)) {
    throw new SubscriptionError(503, 'invalid_plan_limits_draft', 'Unable to read the plan limits draft.');
  }
  return { limits, copy, revision };
}

export async function readPlanLimitsDraft() {
  return readDraft(await getAdminFirestore().doc(DRAFT_PATH).get());
}

export async function savePlanLimitsDraft(payload: Record<string, unknown>, uid: string) {
  const limits = parsePlanLimits(payload.limits);
  const copy = parsePlanFeatureCopy(payload.copy);
  if (!limits || !copy || !isPlanLimit(payload.revision)) {
    throw new SubscriptionError(400, 'invalid_plan_limits', 'Enter a non-negative whole number for each limit.');
  }
  const db = getAdminFirestore();
  const ref = db.doc(DRAFT_PATH);
  return db.runTransaction(async transaction => {
    const current = readDraft(await transaction.get(ref));
    if (current.revision !== payload.revision) {
      throw new SubscriptionError(409, 'plan_limits_draft_changed', 'The draft was changed. Reload before saving.');
    }
    const next = { limits, copy, revision: current.revision + 1 };
    transaction.set(ref, { ...next, updatedBy: uid, updatedAt: FieldValue.serverTimestamp() });
    return next;
  });
}

// This document is written only by the coordinated publishing workflow.
export const PUBLISHED_PLAN_LIMITS_PATH = 'appSettings/publishedPlanLimits';

export function publishedPlanLimits(snapshot: FirebaseFirestore.DocumentSnapshot) {
  if (!snapshot.exists) return null;
  const limits = parsePlanLimits(snapshot.get('limits'));
  if (!limits) throw new SubscriptionError(503, 'invalid_published_plan_limits', 'Unable to verify published plan limits.');
  return limits;
}

export async function readPublishedPlanLimits() {
  const snapshot = await getAdminFirestore().doc(PUBLISHED_PLAN_LIMITS_PATH).get();
  const limits = publishedPlanLimits(snapshot) ?? DEFAULT_PLAN_LIMITS;
  const copy = parsePlanFeatureCopy(snapshot.get('copy'));
  if (!copy) throw new SubscriptionError(503, 'invalid_published_plan_copy', 'Unable to read published plan content.');
  return { limits, copy, active: snapshot.exists };
}

export async function publishPlanLimits(payload: Record<string, unknown>, uid: string) {
  if (!isPlanLimit(payload.revision)) {
    throw new SubscriptionError(400, 'invalid_plan_limits', 'A saved plan draft is required.');
  }
  const db = getAdminFirestore();
  const draftRef = db.doc(DRAFT_PATH);
  const publishedRef = db.doc(PUBLISHED_PLAN_LIMITS_PATH);
  const historyRef = db.collection('planLimitsPublicationHistory').doc();
  return db.runTransaction(async tx => {
    const [draftSnapshot, publishedSnapshot] = await Promise.all([tx.get(draftRef), tx.get(publishedRef)]);
    const draft = readDraft(draftSnapshot);
    if (draft.revision !== payload.revision) {
      throw new SubscriptionError(409, 'plan_limits_draft_changed', 'The draft was changed. Reload before publishing.');
    }
    const previous = { limits: publishedPlanLimits(publishedSnapshot) ?? DEFAULT_PLAN_LIMITS, copy: parsePlanFeatureCopy(publishedSnapshot.get('copy')) ?? {} };
    const next = { limits: draft.limits, copy: draft.copy, active: true };
    if (publishedSnapshot.get('revision') === draft.revision) return next;
    const publishedAt = FieldValue.serverTimestamp();
    tx.set(publishedRef, { ...draft, publishedBy: uid, publishedAt });
    tx.create(historyRef, { previous, next, revision: draft.revision, publishedBy: uid, publishedAt });
    return next;
  });
}
