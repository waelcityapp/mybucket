export type RegistrationPeriod = 'all' | 'today' | 'week' | 'month';
const cairo = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Start of a Cairo calendar day, including changes to Egypt's UTC offset. */
function cairoMidnight(year: number, month: number, day: number): number {
  const target = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  const dateAt = (instant: number) => {
    const parts = Object.fromEntries(cairo.formatToParts(new Date(instant)).map(part => [part.type, part.value]));
    return `${parts.year}-${parts.month}-${parts.day}`;
  };
  const utc = Date.UTC(year, month - 1, day);
  let low = utc - 18 * 3600000, high = utc + 18 * 3600000;
  // Find the first instant belonging to the local date, including DST changes at midnight.
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (dateAt(middle) < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

/** Calendar periods, not rolling 24-hour / 7-day / 30-day windows. Week begins Saturday. */
export function registrationPeriodStart(period: RegistrationPeriod, now = Date.now()): string | null {
  if (period === 'all') return null;
  if (!['today', 'week', 'month'].includes(period)) throw new Error('Invalid registration period');
  const parts = Object.fromEntries(cairo.formatToParts(new Date(now)).map(part => [part.type, part.value]));
  const year = Number(parts.year), month = Number(parts.month), day = Number(parts.day);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (period === 'month') date.setUTCDate(1);
  if (period === 'week') date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 1) % 7);
  return new Date(cairoMidnight(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate())).toISOString();
}
