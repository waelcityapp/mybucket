export function offerShareExcerpt(description: string, limit = 120): string {
  const normalized = description.trim().replace(/\s+/gu, ' ');
  const letters = Array.from(normalized);
  if (letters.length <= limit) return normalized;
  const prefix = letters.slice(0, limit - 1).join('');
  const space = prefix.lastIndexOf(' ');
  return `${(space > limit / 2 ? prefix.slice(0, space) : prefix).trimEnd()}…`;
}

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;

export function compactOfferId(id: string): string {
  if (!uuid.test(id)) return id;
  const hex = id.replace(/-/g, '');
  let bytes = '';
  for (let offset = 0; offset < hex.length; offset += 2) {
    bytes += String.fromCharCode(parseInt(hex.slice(offset, offset + 2), 16));
  }
  return btoa(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function expandOfferId(code: string): string | null {
  if (/^demo-[a-z0-9-]{1,70}$/.test(code)) return code;
  if (!/^[A-Za-z0-9_-]{22}$/.test(code)) return null;
  const bytes = atob(code.replace(/-/g, '+').replace(/_/g, '/') + '==');
  const hex = Array.from(bytes, byte => byte.charCodeAt(0).toString(16).padStart(2, '0')).join('');
  const id = [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
  return compactOfferId(id) === code ? id : null;
}

export function offerSharePath(id: string, lang: 'ar' | 'en') {
  return `/s/${lang === 'en' ? 'en/' : ''}${encodeURIComponent(compactOfferId(id))}`;
}
