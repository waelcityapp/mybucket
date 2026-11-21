import { FieldValue } from 'firebase-admin/firestore';
import { DEFAULT_PLAN_LIMITS, isPlanLimit, parsePlanLimits, type PlanLimitsDraft } from '../src/config/planLimits.js';
import { getAdminFirestore } from './firebaseAdmin.js';
import { SubscriptionError } from './subscriptionService.js';

const DRAFT_PATH = 'appSettings/planLimitsDraft';

function readDraft(snapshot: FirebaseFirestore.DocumentSnapshot): PlanLimitsDraft {
  if (!snapshot.exists) return { limits: DEFAULT_PLAN_LIMITS, revision: 0 };
  const limits = parsePlanLimits(snapshot.get('limits'));
  const revision: unknown = snapshot.get('revision');
  if (!limits || !isPlanLimit(revision)) {
    throw new SubscriptionError(503, 'invalid_plan_limits_draft', 'Unable to read the plan limits draft.');
  }
  return { limits, revision };
}

export async function readPlanLimitsDraft() {
  return readDraft(await getAdminFirestore().doc(DRAFT_PATH).get());
}

export async function savePlanLimitsDraft(payload: Record<string, unknown>, uid: string) {
  const limits = parsePlanLimits(payload.limits);
  if (!limits || !isPlanLimit(payload.revision)) {
    throw new SubscriptionError(400, 'invalid_plan_limits', 'Enter a non-negative whole number for each limit.');
  }
  const db = getAdminFirestore();
  const ref = db.doc(DRAFT_PATH);
  return db.runTransaction(async transaction => {
    const current = readDraft(await transaction.get(ref));
    if (current.revision !== payload.revision) {
      throw new SubscriptionError(409, 'plan_limits_draft_changed', 'The draft was changed. Reload before saving.');
    }
    const next = { limits, revision: current.revision + 1 };
    transaction.set(ref, { ...next, updatedBy: uid, updatedAt: FieldValue.serverTimestamp() });
    return next;
  });
}
