export const DAILY_AD_VIDEO_PLAYS = 3;

export function cairoVideoDay(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

/** Find the next Cairo date boundary, including daylight-saving changes. */
export function nextCairoVideoDay(now = new Date()): number {
  const current = now.getTime();
  if (!Number.isFinite(current)) throw new Error('invalid_date');
  const today = cairoVideoDay(now);
  let low = Math.floor(current / 1000), high = low + 27 * 60 * 60;
  if (cairoVideoDay(new Date(high * 1000)) === today) throw new Error('date_boundary_unavailable');
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (cairoVideoDay(new Date(middle * 1000)) === today) low = middle; else high = middle;
  }
  return high * 1000;
}

function key(id: string, now: Date) { return `mybucket_ad_video_${encodeURIComponent(id)}_${cairoVideoDay(now)}`; }
export function adVideoPlays(storage: Storage, id: string, now = new Date()): number {
  if (!id || id.length > 200) throw new Error('invalid_video_id');
  const value = storage.getItem(key(id, now));
  if (value === null) return 0;
  if (!/^[0-3]$/.test(value)) return DAILY_AD_VIDEO_PLAYS;
  return Number(value);
}
export function takeAdVideoPlay(storage: Storage, id: string, now = new Date()): number {
  const count = adVideoPlays(storage, id, now);
  if (count >= DAILY_AD_VIDEO_PLAYS) return 0;
  storage.setItem(key(id, now), String(count + 1));
  return DAILY_AD_VIDEO_PLAYS - count - 1;
}
