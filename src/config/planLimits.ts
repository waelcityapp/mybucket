export const DEFAULT_PLAN_LIMITS = {
  basicEntries: 15, proAiEntries: 15, proAdditionalEntries: 10,
  basicInquiries: 3, proInquiries: 10,
  basicAccounts: 4, proAccounts: 10,
  basicCategories: 7, proCategories: 20,
  basicOpenItems: 1, proOpenItems: 3,
  basicReminders: 5, proReminders: 20,
  proExports: 4,
};

export type PlanLimits = typeof DEFAULT_PLAN_LIMITS;
export type PlanLimitKey = keyof PlanLimits;
export type PlanLimitsDraft = { limits: PlanLimits; revision: number };

export const PLAN_LIMIT_KEYS = Object.keys(DEFAULT_PLAN_LIMITS) as PlanLimitKey[];

export function isPlanLimit(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

export function parsePlanLimits(value: unknown): PlanLimits | null {
  if (!value || typeof value !== 'object') return null;
  const fields = value as Record<string, unknown>;
  const limits = { ...DEFAULT_PLAN_LIMITS };
  for (const key of PLAN_LIMIT_KEYS) {
    const limit = fields[key];
    if (!isPlanLimit(limit)) return null;
    limits[key] = limit;
  }
  return limits;
}
