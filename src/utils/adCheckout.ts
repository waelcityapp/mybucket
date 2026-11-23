import { adScheduleDate } from './adSchedule.js';

export const MAX_RECEIPT_IMAGE_BYTES = 5 * 1024 * 1024;

export function isReceiptImageAllowed(type: string, bytes: number): boolean {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(type)
    && Number.isSafeInteger(bytes) && bytes > 0 && bytes <= MAX_RECEIPT_IMAGE_BYTES;
}

export type PaidAdPrices = { featured: number; vip: number };
export const DEFAULT_PAID_AD_PRICES: Readonly<PaidAdPrices> = { featured: 100, vip: 200 };
export const MAX_AD_DAILY_PRICE_EGP = 1_000_000;

export function isPaidAdPrice(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 && value <= MAX_AD_DAILY_PRICE_EGP;
}

export function paidAdDailyPrice(tier: keyof PaidAdPrices, prices = DEFAULT_PAID_AD_PRICES) {
  return prices[tier];
}

export type LegacyAdTransfer = { reference: string; transferredAt: number; amountEgp: number };
export type AdPriceLock = { dailyPriceEgp: number; amountEgp: number; createdAt: number; legacyTransfer?: LegacyAdTransfer };

export function normalizeAdTransferReference(value: unknown) {
  if (typeof value !== 'string' || value.length > 100) return null;
  const reference = value.trim().replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) & 15))
    .replace(/\s+/g, '').toUpperCase();
  return /^[A-Z0-9-]{5,48}$/.test(reference) ? reference : null;
}

export function cairoAdTransferTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(value);
  if (!match) return null;
  const [, year, month, day, hh, minute, ss = '0'] = match;
  const hour = Number(hh), seconds = Number(ss);
  if (hour > 23 || seconds > 59) return null;
  const date = adScheduleDate({ year, month, day, minute, hour: String(hour % 12 || 12), period: hour >= 12 ? 'pm' : 'am' });
  return date ? date.getTime() + seconds * 1000 : null;
}
export type AdPriceLockResult = { priceChanged: true; prices: PaidAdPrices }
  | ({ priceChanged: false } & AdPriceLock);

export function normalizePaymentContactPhone(phone: string): string | null {
  const digits = phone.trim().replace(/[٠-٩۰-۹]/g, digit =>
    String(digit.charCodeAt(0) - (digit.charCodeAt(0) < 0x6f0 ? 0x660 : 0x6f0))
  ).replace(/[\s()-]/g, '');
  const match = /^(?:0|\+20|0020)(1[0125]\d{8})$/.exec(digits);
  return match ? '+20' + match[1] : null;
}

export function isPaymentContactPhoneValid(phone: string): boolean {
  return normalizePaymentContactPhone(phone) !== null;
}

export function adRunDays(startsAt: Date, endsAt: Date): number | null {
  const start = startsAt.getTime();
  const end = endsAt.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.ceil((end - start) / 86_400_000);
}


export function validVipDurationDays(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value > 0 &&
    Date.now() + value * 86_400_000 <= 8.64e15;
}
