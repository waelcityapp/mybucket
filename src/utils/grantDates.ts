/** Grant dates are displayed and expire by Cairo calendar days. */
export function cairoGrantDate(time: number): string {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date(time));
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}
export function grantLastDayAfterMonths(months: number, now = Date.now()): string {
  if (!Number.isInteger(months) || months < 1 || months > 120) throw new Error('Invalid grant duration');
  const [year, month, day] = cairoGrantDate(now).split('-').map(Number);
  const target = new Date(Date.UTC(year, month - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return target.toISOString().slice(0, 10);
}
