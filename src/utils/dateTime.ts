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
export function parseNaturalDateTime(input: string): { date: string; time: string; dateTime: string } {
  const now = new Date();
  const text = input.toLowerCase().trim();

  let targetDate = new Date(now.getTime());
  let timeSet = false;

  // Relative day adjustments
  if (text.includes('امبارح') || text.includes('أمس') || text.includes('yesterday')) {
    targetDate.setDate(targetDate.getDate() - 1);
  } else if (text.includes('اول امبارح') || text.includes('أول أمس')) {
    targetDate.setDate(targetDate.getDate() - 2);
  }

  // Relative hours: "منذ ساعتين" / "من ساعتين" / "2 hours ago"
  if (text.includes('ساعتين') || text.includes('2 hours')) {
    targetDate.setHours(targetDate.getHours() - 2);
    timeSet = true;
  } else if (text.includes('ساعة') || text.includes('1 hour') || text.includes('hour ago')) {
    targetDate.setHours(targetDate.getHours() - 1);
    timeSet = true;
  } else if (text.includes('نصف ساعة') || text.includes('نص ساعة') || text.includes('30 mins') || text.includes('30 min')) {
    targetDate.setMinutes(targetDate.getMinutes() - 30);
    timeSet = true;
  }

  // Explicit hour detection: e.g. "الساعة 3", "الساعة 8 مساءً", "3:30", "at 3pm"
  const timeRegex = /(?:الساعة|at)\s*(\d{1,2})(?::(\d{2}))?\s*(صباحا|صباحاً|مساء|مساءً|am|pm)?/i;
  const match = text.match(timeRegex);

  if (match) {
    let hour = parseInt(match[1], 10);
    const minute = match[2] ? parseInt(match[2], 10) : 0;
    const period = match[3] ? match[3].toLowerCase() : '';

    if ((period.includes('مساء') || period === 'pm') && hour < 12) {
      hour += 12;
    } else if ((period.includes('صباح') || period === 'am') && hour === 12) {
      hour = 0;
    } else if (!period && hour <= 11 && hour >= 1 && (text.includes('بالليل') || text.includes('العصر') || text.includes('المغرب') || text.includes('العشا'))) {
      hour += 12;
    }

    targetDate.setHours(hour, minute, 0, 0);
    timeSet = true;
  }

  if (!timeSet) {
    // Keep current time
  }

  const y = targetDate.getFullYear();
  const m = String(targetDate.getMonth() + 1).padStart(2, '0');
  const d = String(targetDate.getDate()).padStart(2, '0');
  const dateStr = `${y}-${m}-${d}`;

  const h = String(targetDate.getHours()).padStart(2, '0');
  const min = String(targetDate.getMinutes()).padStart(2, '0');
  const timeStr = `${h}:${min}`;

  return {
    date: dateStr,
    time: timeStr,
    dateTime: targetDate.toISOString(),
  };
}
