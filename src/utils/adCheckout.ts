export const MAX_RECEIPT_IMAGE_BYTES = 5 * 1024 * 1024;

export function isReceiptImageAllowed(type: string, bytes: number): boolean {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(type)
    && Number.isSafeInteger(bytes) && bytes > 0 && bytes <= MAX_RECEIPT_IMAGE_BYTES;
}

export const AD_TRIAL_DAILY_PRICE_EGP = 100;
export const AD_VIP_DAILY_PRICE_EGP = 200;

export function paidAdDailyPrice(tier: 'featured' | 'vip') {
  return tier === 'vip' ? AD_VIP_DAILY_PRICE_EGP : AD_TRIAL_DAILY_PRICE_EGP;
}

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
