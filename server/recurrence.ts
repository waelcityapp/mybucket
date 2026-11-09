/** Calendar-safe recurrence utilities; pure and independent of Firestore. */
export type Frequency = 'none' | 'weekly' | 'monthly' | 'yearly' | 'installments';
export type Recurrence = { frequency: Frequency; totalCount: number | null };
export type OccurrenceChange = {
  fromIndex: number;
  title: string;
  amount: number;
  currency: string;
  note: string;
  anchorDate: string;
};
export type OccurrenceOverride = {
  title?: string;
  amount?: number;
  currency?: string;
  note?: string;
  dueDate?: string;
};
export const isoDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z').toISOString().slice(0, 10) === value;

export function shiftDate(start: string, freq: Frequency, number: number): string {
  if (freq === 'none' || number === 0) return start;
  const [y,m,d] = start.split('-').map(Number);
  if (freq === 'weekly') {
    const day = new Date(Date.UTC(y, m - 1, d + number * 7, 12));
    return day.toISOString().slice(0, 10);
  }
  const months = freq === 'yearly' ? number * 12 : number;
  const targetStart = new Date(Date.UTC(y, m - 1 + months, 12, 12));
  const maxDay = new Date(Date.UTC(targetStart.getUTCFullYear(), targetStart.getUTCMonth() + 1, 0, 12)).getUTCDate();
  targetStart.setUTCDate(Math.min(d, maxDay));
  return targetStart.toISOString().slice(0, 10);
}

export function occurrenceDate(baseDate: string, frequency: Frequency, index: number, changes: OccurrenceChange[] = []): string {
  const segment = [...changes].filter(change => change.fromIndex <= index).sort((a,b) => b.fromIndex-a.fromIndex)[0];
  return segment ? shiftDate(segment.anchorDate, frequency, index - segment.fromIndex) : shiftDate(baseDate, frequency, index);
}

export function occurrenceId(masterId: string, index: number) {
  return masterId + '__' + index;
}
export function parseOccurrenceId(value: string) {
  const match = /^([a-f0-9-]{36})__(\d{1,6})$/.exec(value);
  return match ? { masterId: match[1], index: Number(match[2]) } : null;
}
