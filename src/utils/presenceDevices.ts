export type PresenceDevice = 'mobile' | 'computer' | 'unknown';

// UA strings can be intentionally disguised. Unrecognized devices stay unknown.
export function classifyPresenceDevice(userAgent: string): PresenceDevice {
  if (/android|iphone|ipad|ipod|mobile/i.test(userAgent)) return 'mobile';
  if (/windows|macintosh|linux|cros/i.test(userAgent)) return 'computer';
  return 'unknown';
}
