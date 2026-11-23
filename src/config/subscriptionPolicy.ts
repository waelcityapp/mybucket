import { activeGrant, type FreeGrant } from './grantPolicy.js';

export const BASIC_FREE_DAYS = 75;
export type TrialDurations = { basicDays: number };
let currentDurations: TrialDurations = { basicDays: BASIC_FREE_DAYS };
export function getTrialDurations(): TrialDurations { return { ...currentDurations }; }
export function isBasicTrialDuration(days: unknown): days is number {
  return typeof days === 'number' && Number.isInteger(days) && days >= 1 && days <= 365;
}
export function setTrialDurations(value: TrialDurations): void {
  if (!isBasicTrialDuration(value.basicDays)) throw new Error('Invalid trial settings');
  currentDurations = { basicDays: value.basicDays };
}
export const PRO_PRICE_EGP = 180;
export const PRO_MARKETER_PRICE_EGP = 120;
export const BASIC_PRICE_EGP = 100;
export const BASIC_MARKETER_PRICE_EGP = 80;
export type TrialStage = 'pro-trial' | 'basic-free' | 'paid-basic' | 'paid' | 'expired';
export function addDays(start: string, days: number) { const time = Date.parse(start); if (!Number.isFinite(time)) throw new Error('Invalid trial start'); return new Date(time + days * 86400000).toISOString(); }
export function stageFor(sub: { trialStartedAt: string; isPaid: boolean; paidPlan?: 'basic' | 'pro'; paidExpiresAt?: string | null; grant?: FreeGrant | null }, now=Date.now(), durations: TrialDurations = currentDurations): TrialStage {
  const paid = sub.isPaid && sub.paidExpiresAt && Date.parse(sub.paidExpiresAt) > now;
  if (paid && sub.paidPlan !== 'basic') return 'paid';
  const grant = activeGrant(sub.grant, now);
  if (grant?.plan === 'pro') return 'pro-trial';
  if (paid) return 'paid-basic';
  if (grant) return 'basic-free';
  const start = Date.parse(sub.trialStartedAt);
  if (!Number.isFinite(start)) return 'expired';
  if (now < start + durations.basicDays*86400000) return 'basic-free';
  return 'expired';
}

type AccessDates = {
  trialStartedAt: string;
  isPaid: boolean;
  paidExpiresAt?: string | null;
  grant?: FreeGrant | null;
};

export function nextAccessChange(sub: AccessDates, now: number, durations = currentDurations): number | null {
  const boundaries = [
    Date.parse(sub.trialStartedAt) + durations.basicDays * 86400000,
    sub.isPaid ? Date.parse(sub.paidExpiresAt ?? '') : NaN,
    Date.parse(sub.grant?.startsAt ?? ''),
    Date.parse(sub.grant?.endsAt ?? ''),
  ].filter(time => Number.isFinite(time) && time > now);
  return boundaries.length ? Math.min(...boundaries) : null;
}

export function accessEndedLabel(sub: AccessDates | null, ar: boolean, durations = currentDurations): string {
  const trialEnd = Date.parse(sub?.trialStartedAt ?? '') + durations.basicDays * 86400000;
  const paidEnd = Date.parse(sub?.paidExpiresAt ?? '');
  const grantEnd = Date.parse(sub?.grant?.endsAt ?? '');
  if (Number.isFinite(grantEnd) && grantEnd > (paidEnd || 0) && grantEnd > (trialEnd || 0)) {
    return ar ? 'انتهت مدة المنحة' : 'Your grant has ended';
  }
  if (Number.isFinite(paidEnd) && paidEnd >= (trialEnd || 0)) {
    return ar ? 'انتهت مدة الاشتراك' : 'Your subscription has ended';
  }
  return ar ? 'انتهت الفترة المجانية' : 'Your free period has ended';
}
