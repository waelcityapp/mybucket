/** Keep free-form contact details readable and link only complete phone numbers. */
export function adContactPhone(contact: string): string | null {
  const normalized = contact.trim()
    .replace(/[٠-٩]/g, digit => String(digit.charCodeAt(0) - 0x660))
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x6f0))
    .replace(/[\s().-]/g, '');
  return /^\+?[0-9]{7,15}$/.test(normalized) ? `tel:${normalized}` : null;
}
