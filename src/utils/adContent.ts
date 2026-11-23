import { parsePhoneNumberWithError } from 'libphonenumber-js/max';

export const AD_NO_LINKS_AR = 'ممنوع منعًا باتًا وضع أي روابط خارجية في أي جزء من الإعلان.';
export const AD_NO_LINKS_EN = 'External links are strictly prohibited in any part of the ad.';

export type AdContactDetails = { callPhone?: string; whatsappPhone?: string; mapsUrl?: string };

export function normalizeAdPhone(raw: string, mobileOnly = false): string | null {
  const text = raw.trim().replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) & 15));
  if (text.length > 50 || !/^\+?[\d(). -]+$/.test(text)) return null;
  const number = text.startsWith('00') ? '+' + text.slice(2) : text;
  try {
    const phone = parsePhoneNumberWithError(number, { defaultCountry: 'EG', extract: false });
    const type = phone.getType();
    if (!phone.isValid()) return null;
    if (type !== 'MOBILE' && type !== 'FIXED_LINE_OR_MOBILE' && (mobileOnly || type !== 'FIXED_LINE')) return null;
    return phone.number;
  } catch {
    return null;
  }
}

export function normalizeGoogleMapsUrl(raw: string): string | null {
  const value = raw.trim();
  if (value.length > 2048 || /[\s\\]/u.test(value)) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password || url.port) return null;
    const path = url.pathname;
    if (url.hostname === 'maps.app.goo.gl' && /^\/[A-Za-z0-9_-]+\/?$/.test(path)) return url.href;
    if (url.hostname === 'goo.gl' && /^\/maps\/[A-Za-z0-9_-]+\/?$/.test(path)) return url.href;
    if (['maps.google.com', 'maps.google.com.eg'].includes(url.hostname) && path === '/' && url.search) return url.href;
    if (['google.com', 'www.google.com', 'maps.google.com', 'google.com.eg', 'www.google.com.eg', 'maps.google.com.eg'].includes(url.hostname) &&
      /^\/maps(?:\/(?:place|search|dir|data|@[^/]+|embed|preview)(?:\/.*)?|\/?)$/.test(path)) return url.href;
  } catch {
    return null;
  }
  return null;
}

export function containsExternalAdLink(value: string): boolean {
  const text = value.normalize('NFKC').replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
    .replace(/[。｡]/g, '.');
  return /(?:\b(?:https?|ftps?|mailto|tel|whatsapp|javascript|data|file|tg)\s*:|\b[a-z][a-z\d+.-]*:\s*\/\/|\bwww\s*\.|(?:[\p{L}\p{N}](?:[\p{L}\p{N}-]*[\p{L}\p{N}])?\.)+(?:xn--[\p{L}\p{N}-]+|\p{L}{2,})(?![\p{L}\p{N}-])|\b(?:\d{1,3}\.){3}\d{1,3}\b)/iu.test(text);
}

export function adContactError(fields: AdContactDetails) {
  if (fields.callPhone?.trim() && !normalizeAdPhone(fields.callPhone)) return 'ad_invalid_call_phone';
  if (fields.whatsappPhone?.trim() && !normalizeAdPhone(fields.whatsappPhone, true)) return 'ad_invalid_whatsapp_phone';
  if (fields.mapsUrl?.trim() && !normalizeGoogleMapsUrl(fields.mapsUrl)) return 'ad_invalid_maps_url';
  return null;
}

export function adVideoLimit(tier: 'free' | 'featured' | 'vip') {
  return tier === 'featured' ? 30 : tier === 'vip' ? 60 : 0;
}
