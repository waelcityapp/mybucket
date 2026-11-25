import { parsePlanFeatureCopy, type PlanFeatureCopy } from './planLimitFeatures.js';

export const DEFAULT_PLAN_LIMITS = {
  basicEntries: 15, proAiEntries: 15, proEntries: 25,
  basicInquiries: 3, proInquiries: 10,
  basicAccounts: 4, proAccounts: 10,
  basicCategories: 7, proCategories: 20,
  basicOpenItems: 1, proOpenItems: 3,
  basicReminders: 5, proReminders: 20,
  proExports: 4,
};

export type PlanLimits = typeof DEFAULT_PLAN_LIMITS;
export type PlanLimitKey = keyof PlanLimits;
export type PlanPresentation = { limits: PlanLimits; copy: PlanFeatureCopy };
export type PublishedPlanPresentation = PlanPresentation & { active: boolean };
export type PlanLimitsDraft = PlanPresentation & { revision: number };

export const PLAN_LIMIT_KEYS = Object.keys(DEFAULT_PLAN_LIMITS) as PlanLimitKey[];

export function isPlanLimit(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function parsePlanLimits(value: unknown): PlanLimits | null {
  if (!value || typeof value !== 'object') return null;
  const fields = value as Record<string, unknown>;
  const limits = { ...DEFAULT_PLAN_LIMITS };
  const legacyAdditional = fields.proAdditionalEntries;
  const legacyAi = fields.proAiEntries;
  for (const key of PLAN_LIMIT_KEYS) {
    const limit = key === 'proEntries' && fields.proEntries === undefined && isPlanLimit(legacyAdditional) && isPlanLimit(legacyAi)
      ? legacyAdditional + legacyAi
      : fields[key];
    if (!isPlanLimit(limit)) return null;
    limits[key] = limit;
  }
  return limits;
}

export async function fetchPublishedPlanLimits(signal?: AbortSignal): Promise<PublishedPlanPresentation> {
  const response = await fetch('/api/gateway', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'subscription.publicPlanLimits' }),
    cache: 'no-store',
    signal,
  });
  const result = await response.json();
  const limits = response.ok && result.ok === true ? parsePlanLimits(result.data?.limits) : null;
  const copy = parsePlanFeatureCopy(result.data?.copy);
  if (!limits || !copy || typeof result.data?.active !== 'boolean') throw new Error('published_plan_limits_unavailable');
  return { limits, copy, active: result.data.active };
}
