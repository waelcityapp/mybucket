export const MAX_RECEIPT_IMAGE_BYTES = 5 * 1024 * 1024;

export function isReceiptImageAllowed(type: string, bytes: number): boolean {
  return ['image/jpeg', 'image/png', 'image/webp'].includes(type)
    && Number.isSafeInteger(bytes) && bytes > 0 && bytes <= MAX_RECEIPT_IMAGE_BYTES;
}

export function isPaymentContactPhoneValid(phone: string): boolean {
  const normalized = phone.trim().replace(/[\s()-]/g, '');
  return /^(?:01[0125]\d{8}|\+201[0125]\d{8})$/.test(normalized);
}

export function adRunDays(startsAt: Date, endsAt: Date): number | null {
  const start = startsAt.getTime();
  const end = endsAt.getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return Math.ceil((end - start) / 86_400_000);
}
