export type ReminderAlert = { id: string; kind: 'obligation' | 'receivable'; title: string; amount: number; currency: string; dueDate: string; leadDays?: number; remindTime?: string; done: boolean; alertDisabled?: boolean; snoozedUntil?: string | null };
export type DismissedAlerts = { day: string; ids: string[] };

export function cairoClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const p = Object.fromEntries(parts.map(x => [x.type, x.value]));
  return { day: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}
export function visibleReminderAlerts(items: ReminderAlert[], now = new Date()) {
  const { day, time } = cairoClock(now);
  return items.filter(item => {
    if (item.done || item.alertDisabled || typeof item.leadDays !== 'number' || !/^\d{4}-\d{2}-\d{2}$/.test(item.dueDate)) return false;
    const date = new Date(item.dueDate + 'T12:00:00Z');
    if (!Number.isFinite(date.getTime())) return false;
    date.setUTCDate(date.getUTCDate() - item.leadDays);
    const starts = date.toISOString().slice(0, 10);
    return (!item.snoozedUntil || item.snoozedUntil <= day) && starts <= day && (item.remindTime || '09:00') <= time;
  });
}
export function shouldShowReminderBanner(items: ReminderAlert[], dismissed: DismissedAlerts | null, now = new Date()) {
  if (!items.length) return false;
  return !dismissed || dismissed.day !== cairoClock(now).day || items.some(item => !dismissed.ids.includes(item.id));
}
