export const PRO_TRIAL_DAYS = 15;
export const BASIC_FREE_DAYS = 60;
export const PRO_PRICE_EGP = 180;
export const PRO_MARKETER_PRICE_EGP = 120;
export const BASIC_PRICE_EGP: number | null = null; // Pending approval.
export type TrialStage = 'pro-trial' | 'basic-free' | 'paid' | 'expired';
export function addDays(start: string, days: number) { const time = Date.parse(start); if (!Number.isFinite(time)) throw new Error('Invalid trial start'); return new Date(time + days * 86400000).toISOString(); }
export function stageFor(sub: { trialStartedAt: string; isPaid: boolean; paidExpiresAt?: string | null }, now=Date.now()): TrialStage {
  if (sub.isPaid && sub.paidExpiresAt && Date.parse(sub.paidExpiresAt)>now) return 'paid';
  const start = Date.parse(sub.trialStartedAt);
  if (!Number.isFinite(start)) return 'expired';
  if (now < start + PRO_TRIAL_DAYS*86400000) return 'pro-trial';
  if (now < start + BASIC_FREE_DAYS*86400000) return 'basic-free';
  return 'expired';
}
