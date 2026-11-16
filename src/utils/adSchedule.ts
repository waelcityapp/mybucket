export type AdScheduleValue = { day: string; month: string; year: string; hour: string; minute: string; period: '' | 'am' | 'pm' };
export const emptyAdSchedule = (): AdScheduleValue => ({ day: '', month: '', year: '', hour: '', minute: '', period: '' });

/** Interpret the selected calendar and clock values in the device's local time zone. */
export function adScheduleDate(value: AdScheduleValue): Date | null {
  if (!value.day || !value.month || !value.year || !value.hour || !value.minute || !value.period) return null;
  if (!/^\d{1,2}$/.test(value.day) || !/^\d{1,2}$/.test(value.month) || !/^\d{4}$/.test(value.year) || !/^\d{1,2}$/.test(value.hour) || !/^\d{2}$/.test(value.minute)) return null;
  const day = Number(value.day), month = Number(value.month), year = Number(value.year), hour = Number(value.hour), minute = Number(value.minute);
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31 || hour < 1 || hour > 12 || minute < 0 || minute > 59 || !['am', 'pm'].includes(value.period)) return null;
  const hour24 = (hour % 12) + (value.period === 'pm' ? 12 : 0);
  const date = new Date(year, month - 1, day, hour24, minute, 0, 0);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hour24 || date.getMinutes() !== minute) return null;
  return date;
}
