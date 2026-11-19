export type AdScheduleValue = { day: string; month: string; year: string; hour: string; minute: string; period: '' | 'am' | 'pm' };
export const emptyAdSchedule = (): AdScheduleValue => ({ day: '', month: '', year: '', hour: '', minute: '', period: '' });

export const AD_TIME_ZONE = 'Africa/Cairo';
const cairoClock = new Intl.DateTimeFormat('en-GB', {
  timeZone: AD_TIME_ZONE, calendar: 'gregory', numberingSystem: 'latn',
  year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

function cairoParts(date: Date) {
  const parts = Object.fromEntries(cairoClock.formatToParts(date).map(part => [part.type, Number(part.value)]));
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour, minute: parts.minute };
}

export function cairoAdScheduleNow(now = new Date()): AdScheduleValue {
  const { year, month, day, hour, minute } = cairoParts(now);
  return { year: String(year), month: String(month), day: String(day),
    hour: String(hour % 12 || 12), minute: String(minute).padStart(2, '0'), period: hour < 12 ? 'am' : 'pm' };
}

/** Resolve a Cairo wall time to an instant, including daylight saving changes. */
export function adScheduleDate(value: AdScheduleValue): Date | null {
  if (!value.day || !value.month || !value.year || !value.hour || !value.minute || !value.period) return null;
  if (!/^\d{1,2}$/.test(value.day) || !/^\d{1,2}$/.test(value.month) || !/^\d{4}$/.test(value.year) || !/^\d{1,2}$/.test(value.hour) || !/^\d{2}$/.test(value.minute)) return null;
  const day = Number(value.day), month = Number(value.month), year = Number(value.year), hour = Number(value.hour), minute = Number(value.minute);
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31 || hour < 1 || hour > 12 || minute < 0 || minute > 59 || !['am', 'pm'].includes(value.period)) return null;
  const hour24 = (hour % 12) + (value.period === 'pm' ? 12 : 0);
  const wallTime = Date.UTC(year, month - 1, day, hour24, minute);
  const date = new Date(wallTime);
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;

  // Try offsets on both sides of a transition. Missing times are invalid.
  // If a time repeats as clocks move back, use its earlier occurrence.
  const matches = [-86400000, 86400000].flatMap(delta => {
    const sample = wallTime + delta;
    const local = cairoParts(new Date(sample));
    const offset = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute) - sample;
    const instant = wallTime - offset;
    const check = cairoParts(new Date(instant));
    return check.year === year && check.month === month && check.day === day &&
      check.hour === hour24 && check.minute === minute ? [instant] : [];
  });
  return matches.length ? new Date(Math.min(...matches)) : null;
}
