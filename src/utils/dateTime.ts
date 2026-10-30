import { Language } from '../types';

/**
 * Returns current local date formatted as YYYY-MM-DD
 */
export function getCurrentLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns current local time formatted as HH:mm (24-hour)
 */
export function getCurrentLocalTime(): string {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Combines date string (YYYY-MM-DD) and time string (HH:mm) into an ISO string
 */
export function toDateTimeISO(dateStr: string, timeStr?: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  let hours = 12;
  let minutes = 0;

  if (timeStr) {
    const parts = timeStr.split(':').map(Number);
    if (!isNaN(parts[0])) hours = parts[0];
    if (!isNaN(parts[1])) minutes = parts[1];
  }

  const d = new Date(year, (month || 1) - 1, day || 1, hours, minutes, 0);
  return d.toISOString();
}

/**
 * Formats a date & time for user display in Arabic or English
 * e.g. "5 سبتمبر 2026 · 03:30 م" or "5 Sep 2026 · 3:30 PM"
 */
export function formatDateTimeDisplay(
  dateStr: string,
  timeStr?: string,
  isoStr?: string,
  lang: Language = 'ar'
): string {
  let targetDate: Date;

  if (isoStr) {
    targetDate = new Date(isoStr);
  } else if (dateStr) {
    const [y, m, d] = dateStr.split('-').map(Number);
    let h = 12;
    let min = 0;
    if (timeStr) {
      const parts = timeStr.split(':').map(Number);
      if (!isNaN(parts[0])) h = parts[0];
      if (!isNaN(parts[1])) min = parts[1];
    }
    targetDate = new Date(y, (m || 1) - 1, d || 1, h, min);
  } else {
    targetDate = new Date();
  }

  if (isNaN(targetDate.getTime())) {
    return dateStr || '';
  }

  const locale = lang === 'ar' ? 'ar-EG' : 'en-US';

  const dateFormatted = targetDate.toLocaleDateString(locale, {
    day: 'numeric',
    month: lang === 'ar' ? 'long' : 'short',
    year: 'numeric',
  });

  const timeFormatted = targetDate.toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return `${dateFormatted} · ${timeFormatted}`;
}

/**
 * Formats just the date portion
 * e.g. "5 سبتمبر 2026"
 */
export function formatDateDisplay(dateStr: string, lang: Language = 'ar'): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const targetDate = new Date(y, (m || 1) - 1, d || 1);
  if (isNaN(targetDate.getTime())) return dateStr;

  const locale = lang === 'ar' ? 'ar-EG' : 'en-US';
  return targetDate.toLocaleDateString(locale, {
    day: 'numeric',
    month: lang === 'ar' ? 'long' : 'short',
    year: 'numeric',
  });
}

/**
 * Natural language relative date/time parser
 * Supports:
 * - "النهاردة الساعة 3", "اليوم الساعة 3:30", "today at 3pm"
 * - "امبارح الساعة 8 مساءً", "امس 8 مساء", "yesterday at 8pm"
 * - "منذ ساعتين", "من ساعتين", "من ساعة", "2 hours ago"
 * - "دلوقتي", "الآن", "now"
 */
export function parseNaturalDateTime(
  input: string,
  referenceDate: Date = new Date()
): { date: string; time: string; dateTime: string } {
  const targetDate = new Date(referenceDate.getTime());
  const text = input.toLowerCase().trim()
    .replace(/[٠-٩]/g, d => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .replace(/[أإآ]/g, 'ا');

  const subtractDays = (days: number) => targetDate.setDate(targetDate.getDate() - days);
  const subtractMonths = (months: number) => {
    const day = targetDate.getDate();
    targetDate.setDate(1);
    targetDate.setMonth(targetDate.getMonth() - months);
    const lastDay = new Date(targetDate.getFullYear(), targetDate.getMonth() + 1, 0).getDate();
    targetDate.setDate(Math.min(day, lastDay));
  };

  // Always check "day before yesterday" before "yesterday".
  if (/(?:اول\s*امبارح|اول\s*امس|day before yesterday)/.test(text)) {
    subtractDays(2);
  } else if (/(?:امبارح|امس|yesterday)/.test(text)) {
    subtractDays(1);
  } else if (/(?:من|قبل|منذ)\s*(?:اسبوعين|two weeks)/.test(text)) {
    subtractDays(14);
  } else if (/(?:من|قبل|منذ)\s*(?:اسبوع|سبوع|week)(?!\w)/.test(text)) {
    subtractDays(7);
  } else if (/(?:من|قبل|منذ)\s*(?:شهرين|two months)/.test(text)) {
    subtractMonths(2);
  } else if (/(?:من|قبل|منذ)\s*(?:شهر|month)(?:\s*(?:فات|اللي فات|ago))?/.test(text)
      || /(?:الشهر|شهر)\s*(?:اللي فات|الماضي|الفات)/.test(text)) {
    subtractMonths(1);
  } else if (/(?:من|قبل|منذ)\s*(?:سنه|سنة|عام|year)(?:\s*(?:فاتت|فات|ago))?/.test(text)) {
    subtractMonths(12);
  } else if (/\b(?:last week|a week ago|one week ago)\b/.test(text)) {
    subtractDays(7);
  } else if (/\b(?:last month|a month ago|one month ago)\b/.test(text)) {
    subtractMonths(1);
  } else if (/\b(?:last year|a year ago|one year ago)\b/.test(text)) {
    subtractMonths(12);
  } else if (/\b(?:two days ago|day before yesterday)\b/.test(text)) {
    subtractDays(2);
  } else {
    const englishDuration = text.match(/\b(\d+|one|two|three|four|five|six|seven|ten)\s+(days?|weeks?|months?|years?)\s+ago\b/);
    const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, ten: 10 };
    if (englishDuration) {
      const n = words[englishDuration[1]] || Number(englishDuration[1]);
      const unit = englishDuration[2];
      if (n > 0 && n <= 3650) {
        if (unit.startsWith('day')) subtractDays(n);
        else if (unit.startsWith('week')) subtractDays(n * 7);
        else if (unit.startsWith('month')) subtractMonths(n);
        else subtractMonths(n * 12);
      }
    }
    const duration = text.match(/(?:من|قبل|منذ)\s*(\d+)\s*(ايام|يوم|اسابيع|اسبوع|شهور|اشهر|شهر|سنين|سنوات|سنة|سنه|days?|weeks?|months?|years?)(?:\s*(?:فات|فاتت|ago))?/);
    if (duration) {
      const n = Number(duration[1]);
      const unit = duration[2];
      if (n > 0 && n <= 3650) {
        if (/^(?:ايام|يوم|days?)/.test(unit)) subtractDays(n);
        else if (/^(?:اسابيع|اسبوع|weeks?)/.test(unit)) subtractDays(n * 7);
        else if (/^(?:شهور|اشهر|شهر|months?)/.test(unit)) subtractMonths(n);
        else subtractMonths(n * 12);
      }
    }
  }

  // Don't mistake "الساعة 3" for "من ساعة".
  if (/(?:منذ|من|قبل)\s*(?:ساعتين|2\s*hours?)/.test(text)) {
    targetDate.setHours(targetDate.getHours() - 2);
  } else if (/(?:نصف|نص)\s*ساعة|30\s*min/.test(text)) {
    targetDate.setMinutes(targetDate.getMinutes() - 30);
  } else if (/(?:منذ|من|قبل)\s*(?:ساعة|ساعه|1\s*hour)/.test(text)) {
    targetDate.setHours(targetDate.getHours() - 1);
  }

  const timeRegex = /(?:الساعة|at)\s*(\d{1,2})(?::(\d{2}))?\s*(صباحا|صباحاً|مساء|مساءً|am|pm)?/i;
  const match = text.match(timeRegex);
  if (match) {
    let hour = Number(match[1]);
    const minute = match[2] ? Number(match[2]) : 0;
    const period = match[3]?.toLowerCase() || '';
    if (hour >= 1 && hour <= 12 && minute <= 59) {
      if ((period.includes('مساء') || period === 'pm') && hour < 12) hour += 12;
      else if ((period.includes('صباح') || period === 'am') && hour === 12) hour = 0;
      else if (!period && hour <= 11 && /بالليل|العصر|المغرب|العشا/.test(text)) hour += 12;
      targetDate.setHours(hour, minute, 0, 0);
    }
  }

  const y = String(targetDate.getFullYear());
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  const dateStr = [y, m, d].join('-');
  const h = String(targetDate.getHours()).padStart(2, '0');
  const min = String(targetDate.getMinutes()).padStart(2, '0');
  const timeStr = [h, min].join(':');
  return { date: dateStr, time: timeStr, dateTime: targetDate.toISOString() };
}
