export const PRO_TRIAL_DAYS = 15;
export const BASIC_FREE_DAYS = 75; // Default only; Firebase setting takes priority.
export type TrialDurations = { proDays: number; basicDays: number };
let currentDurations: TrialDurations = { proDays: PRO_TRIAL_DAYS, basicDays: BASIC_FREE_DAYS };
export function getTrialDurations(): TrialDurations { return { ...currentDurations }; }
export function setTrialDurations(value: TrialDurations): void {
  if (!Number.isInteger(value.proDays) || !Number.isInteger(value.basicDays) ||
      value.proDays < 1 || value.proDays > 365 || value.basicDays < value.proDays || value.basicDays > 365)
    throw new Error('Invalid trial settings');
  currentDurations = { proDays: value.proDays, basicDays: value.basicDays };
}
export const PRO_PRICE_EGP = 180;
export const PRO_MARKETER_PRICE_EGP = 120;
export const BASIC_PRICE_EGP: number | null = null; // Pending approval.
export type TrialStage = 'pro-trial' | 'basic-free' | 'paid' | 'expired';
export function addDays(start: string, days: number) { const time = Date.parse(start); if (!Number.isFinite(time)) throw new Error('Invalid trial start'); return new Date(time + days * 86400000).toISOString(); }
export function stageFor(sub: { trialStartedAt: string; isPaid: boolean; paidExpiresAt?: string | null }, now=Date.now()): TrialStage {
  if (sub.isPaid && sub.paidExpiresAt && Date.parse(sub.paidExpiresAt)>now) return 'paid';
  const start = Date.parse(sub.trialStartedAt);
  if (!Number.isFinite(start)) return 'expired';
  if (now < start + currentDurations.proDays*86400000) return 'pro-trial';
  if (now < start + currentDurations.basicDays*86400000) return 'basic-free';
  return 'expired';
}
