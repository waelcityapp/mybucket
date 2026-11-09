export type GrantPlan = 'basic' | 'pro';
export type FreeGrant = { plan: GrantPlan; startsAt: string; endsAt: string };

/** Returns only currently active, well-formed grants. Expiry is exclusive. */
export function activeGrant(value: unknown, now = Date.now()): FreeGrant | null {
  if (!value || typeof value !== 'object') return null;
  const grant = value as Partial<FreeGrant>;
  if (grant.plan !== 'basic' && grant.plan !== 'pro') return null;
  if (typeof grant.startsAt !== 'string' || typeof grant.endsAt !== 'string') return null;
  const start = Date.parse(grant.startsAt), end = Date.parse(grant.endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || now < start || now >= end) return null;
  return { plan: grant.plan, startsAt: grant.startsAt, endsAt: grant.endsAt };
}

/** Parse server-owned access fields without interpreting a grant as paid. */
export function grantFromAccess(data: Record<string, unknown> | null): FreeGrant | null {
  if (!data) return null;
  const date = (value: unknown): string | null => {
    if (!value || typeof value !== 'object' || !('seconds' in value)) return null;
    const seconds = (value as { seconds: unknown }).seconds;
    const nanos = 'nanoseconds' in value ? (value as { nanoseconds: unknown }).nanoseconds : 0;
    if (typeof seconds !== 'number' || !Number.isFinite(seconds)) return null;
    if (typeof nanos !== 'number' || !Number.isFinite(nanos) || nanos < 0 || nanos >= 1e9) return null;
    const parsed = new Date(seconds * 1000 + Math.floor(nanos / 1e6));
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
  };
  const startsAt = date(data.grantStartsAt), endsAt = date(data.grantUntil);
  if ((data.grantPlan !== 'basic' && data.grantPlan !== 'pro') || !startsAt || !endsAt || Date.parse(endsAt) <= Date.parse(startsAt)) return null;
  return { plan: data.grantPlan, startsAt, endsAt };
}
