import { CurrencyCode } from '../types';

export const EASTERN_ARABIC_DIGITS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export function normalizeArabicDigits(str: string): string {
  return str.replace(/[٠-٩]/g, (d) => String(EASTERN_ARABIC_DIGITS.indexOf(d)));
}

export const ARABIC_MONTHS: Record<string, number> = {
  يناير: 1,
  فبراير: 2,
  مارس: 3,
  أبريل: 4,
  ابريل: 4,
  مايو: 5,
  يونيو: 6,
  يوليو: 7,
  أغسطس: 8,
  اغسطس: 8,
  سبتمبر: 9,
  أكتوبر: 10,
  اكتوبر: 10,
  نوفمبر: 11,
  ديسمبر: 12,
  january: 1,
  february: 2,
  march: 3,
  april: 4,
  may: 5,
  june: 6,
  july: 7,
  august: 8,
  september: 9,
  october: 10,
  november: 11,
  december: 12,
  jan: 1,
  feb: 2,
  mar: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  oct: 10,
  nov: 11,
  dec: 12,
};

export interface SemanticNumberRoles {
  dateFrom: string | null;
  dateTo: string | null;
  dayFromNum: number | null;
  dayToNum: number | null;
  specificDay: number | null;
  specificMonth: number | null;
  specificYear: number | null;
  specificDateStr: string | null;
  specificHour: number | null;
  specificMinute: number | null;
  specificTimeStr: string | null;
  amount: number | null;
  currency: CurrencyCode;
}

/**
 * Determines whether the user input is an informational question/query (FINANCIAL_QUERY)
 * versus an action to record a new financial event (CREATE_TRANSACTION).
 *
 * CRITICAL RULE:
 * Never classify a sentence as CREATE_TRANSACTION merely because:
 * - it contains "صرفت" or "دفعت"
 * - it contains numbers
 * - it contains a financial category
 */
export function isFinancialQueryText(rawText: string): boolean {
  const norm = normalizeArabicDigits(rawText).toLowerCase().trim();

  // 1. Explicit punctuation
  if (norm.includes('؟') || norm.includes('?')) {
    return true;
  }

  // 2. Interrogative question words in Arabic
  // "كام", "كم", "بكام", "بكم"
  if (/(?:^|\s)(?:كام|كم|بكام|بكم)(?:\s|$)/.test(norm)) {
    return true;
  }

  // "قد إيه", "قد ايه", "اد ايه"
  if (/(?:قد\s*إيه|قد\s*ايه|اد\s*ايه)/.test(norm)) {
    return true;
  }

  // "إيه اللي صرفته", "ايه اللي", "صرفت ايه", "دفعت ايه", "اشتريت ايه"
  if (
    /(?:إيه\s*اللي|ايه\s*اللي|اي\s*اللي|صرفت\s*ايه|صرفت\s*إيه|دفعت\s*ايه|دفعت\s*إيه|اشتريت\s*ايه|اشتريت\s*إيه)/.test(
      norm
    )
  ) {
    return true;
  }

  // "معايا كام", "معي كم", "رصيدي", "رصيد الحساب"
  if (/(?:معايا\s*كام|معي\s*كم|رصيدي|رصيد\s*(?:الحساب|البنك|الكاش|الفيزا)?)/.test(norm)) {
    return true;
  }

  // 3. Inquiry verbs / command words asking for displays, reports, comparisons
  // "وريني", "اعرض", "هات", "بين", "شوف", "استعلم", "قارن"
  if (/(?:^|\s)(?:وريني|اعرض|هات|بين|شوف|استعلم|قارن)(?:\s|$)/.test(norm)) {
    return true;
  }

  // 4. Aggregation & statistical inquiry terms
  // "إجمالي", "اجمالي", "مجموع", "أكتر", "اكتر", "أقل", "اقل", "أعلى", "اعلى"
  if (/(?:إجمالي|اجمالي|مجموع|أكتر|اكتر|أقل|اقل|أعلى|اعلى)\s*(?:ما\s*صرفته|صرفت|مصاريف|دخل)?/.test(norm)) {
    return true;
  }

  // 5. Date range inquiry without an explicit payment statement
  // "من يوم 3 ليوم 18" with "صرفت" or "بنزين"
  if (
    /من\s*(?:يوم\s*)?\d+\s*(?:إلى|الي|ليوم|لـ|ل|حتى)\s*(?:يوم\s*)?\d+/.test(norm) &&
    (norm.includes('صرفت') || norm.includes('دفعت') || norm.includes('خلال') || norm.includes('الفترة'))
  ) {
    // If it does not contain a clear statement like "دفعت 500 جنيه"
    if (!/(?:دفعت|صرفت)\s*\d+\s*(?:جنيه|egp|usd|دولار)/.test(norm)) {
      return true;
    }
  }

  // 6. English query phrases
  if (
    /(?:how\s+much|what\s+did\s+i\s+spend|show\s+me|total\s+spent|my\s+balance|did\s+i\s+spend)/.test(
      norm
    )
  ) {
    return true;
  }

  return false;
}

/**
 * Parses numbers and identifies their semantic roles:
 * - Date range boundaries (e.g. "من يوم 3 ليوم 18 في شهر مارس")
 * - Specific day of month (e.g. "يوم 3 مارس", "يوم 15 مارس")
 * - Specific time of day (e.g. "الساعة 3")
 * - Transaction amount (only numbers not used as day, time, or date boundaries)
 */
export function parseSemanticNumberRoles(
  rawText: string,
  referenceDate: Date = new Date()
): SemanticNumberRoles {
  const norm = normalizeArabicDigits(rawText);
  const lower = norm.toLowerCase();

  const consumedRanges: Array<{ start: number; end: number; val: number; role: string }> = [];

  // Currency detection
  let currency: CurrencyCode = 'EGP';
  if (lower.includes('دولار') || lower.includes('usd') || lower.includes('$')) {
    currency = 'USD';
  } else if (lower.includes('ريال') || lower.includes('sar')) {
    currency = 'SAR';
  } else if (lower.includes('درهم') || lower.includes('aed')) {
    currency = 'AED';
  } else if (lower.includes('يورو') || lower.includes('eur') || lower.includes('€')) {
    currency = 'EUR';
  }

  // 1. DATE RANGE BOUNDARY EXTRACTION
  // Examples:
  // "من يوم 3 ليوم 18 في شهر مارس"
  // "من يوم 3 الى يوم 18 مارس"
  // "من 3 لـ 18 مارس"
  let dateFrom: string | null = null;
  let dateTo: string | null = null;
  let dayFromNum: number | null = null;
  let dayToNum: number | null = null;

  const rangeRegex =
    /(?:من\s*(?:يوم\s*)?(\d{1,2}))\s*(?:إلى|الي|ليوم|لـ|ل|حتى|وحتى)\s*(?:يوم\s*)?(\d{1,2})(?:\s*(?:في|من)?\s*(?:شهر)?\s*(يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر|[a-zA-Z]+))?/i;
  const rangeMatch = norm.match(rangeRegex);

  if (rangeMatch) {
    dayFromNum = parseInt(rangeMatch[1], 10);
    dayToNum = parseInt(rangeMatch[2], 10);
    let rangeMonth = referenceDate.getMonth() + 1;
    if (rangeMatch[3]) {
      const mKey = rangeMatch[3].toLowerCase();
      if (ARABIC_MONTHS[mKey]) {
        rangeMonth = ARABIC_MONTHS[mKey];
      }
    }
    const year = referenceDate.getFullYear();
    dateFrom = `${year}-${String(rangeMonth).padStart(2, '0')}-${String(dayFromNum).padStart(2, '0')}`;
    dateTo = `${year}-${String(rangeMonth).padStart(2, '0')}-${String(dayToNum).padStart(2, '0')}`;

    const matchStart = rangeMatch.index ?? 0;
    const matchEnd = matchStart + rangeMatch[0].length;
    consumedRanges.push({ start: matchStart, end: matchEnd, val: dayFromNum, role: 'date_range_start' });
    consumedRanges.push({ start: matchStart, end: matchEnd, val: dayToNum, role: 'date_range_end' });
  }

  // 2. DAY OF MONTH EXTRACTION
  // Examples:
  // "يوم 3 مارس" / "3 مارس" / "يوم 15 مارس" / "15 مارس"
  let specificDay: number | null = null;
  let specificMonth: number | null = null;
  let specificYear: number | null = referenceDate.getFullYear();
  let specificDateStr: string | null = null;

  const dayMonthRegex =
    /(?:(?:يوم|بتاريخ|on)\s*)?(\d{1,2})\s*(يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر|[a-zA-Z]+)/gi;
  let dmMatch: RegExpExecArray | null;
  while ((dmMatch = dayMonthRegex.exec(norm)) !== null) {
    const dVal = parseInt(dmMatch[1], 10);
    const mStr = dmMatch[2].toLowerCase();
    if (ARABIC_MONTHS[mStr] && dVal >= 1 && dVal <= 31) {
      const matchStart = dmMatch.index;
      const matchEnd = matchStart + dmMatch[0].length;
      const overlaps = consumedRanges.some((c) => matchStart >= c.start && matchStart < c.end);
      if (!overlaps) {
        specificDay = dVal;
        specificMonth = ARABIC_MONTHS[mStr];
        specificDateStr = `${specificYear}-${String(specificMonth).padStart(2, '0')}-${String(specificDay).padStart(2, '0')}`;
        consumedRanges.push({ start: matchStart, end: matchEnd, val: dVal, role: 'day_of_month' });
      }
    }
  }

  // Standalone "يوم (\d{1,2})" without month name
  if (specificDay === null) {
    const dayOnlyRegex = /(?:يوم|بتاريخ)\s*(\d{1,2})\b/gi;
    let doMatch: RegExpExecArray | null;
    while ((doMatch = dayOnlyRegex.exec(norm)) !== null) {
      const dVal = parseInt(doMatch[1], 10);
      if (dVal >= 1 && dVal <= 31) {
        const matchStart = doMatch.index;
        const matchEnd = matchStart + doMatch[0].length;
        const overlaps = consumedRanges.some((c) => matchStart >= c.start && matchStart < c.end);
        if (!overlaps) {
          specificDay = dVal;
          specificMonth = referenceDate.getMonth() + 1;
          specificDateStr = `${specificYear}-${String(specificMonth).padStart(2, '0')}-${String(specificDay).padStart(2, '0')}`;
          consumedRanges.push({ start: matchStart, end: matchEnd, val: dVal, role: 'day_of_month' });
          break;
        }
      }
    }
  }

  // 3. TIME OF DAY EXTRACTION
  // Examples:
  // "الساعة 3" / "الساعة 8 مساءً" / "الساعة 3:30" / "at 3"
  let specificHour: number | null = null;
  let specificMinute: number | null = null;
  let specificTimeStr: string | null = null;

  const timeRegex =
    /(?:الساعة|ساعة|at)\s*(\d{1,2})(?::(\d{2}))?\s*(صباحا|صباحاً|مساء|مساءً|الصبح|بالليل|عصراً|العصر|am|pm)?/gi;
  let tMatch: RegExpExecArray | null;
  while ((tMatch = timeRegex.exec(norm)) !== null) {
    const matchStart = tMatch.index;
    const matchEnd = matchStart + tMatch[0].length;
    const overlaps = consumedRanges.some((c) => matchStart >= c.start && matchStart < c.end);
    if (!overlaps) {
      const rawHour = parseInt(tMatch[1], 10);
      const rawMin = tMatch[2] ? parseInt(tMatch[2], 10) : 0;
      const period = tMatch[3] ? tMatch[3].toLowerCase() : '';

      let adjustedHour = rawHour;
      if (
        (period.includes('مساء') || period === 'pm' || period.includes('بالليل') || period.includes('العصر')) &&
        rawHour < 12
      ) {
        adjustedHour += 12;
      } else if ((period.includes('صباح') || period === 'am' || period.includes('الصبح')) && rawHour === 12) {
        adjustedHour = 0;
      }

      specificHour = rawHour;
      specificMinute = rawMin;
      specificTimeStr = `${String(adjustedHour).padStart(2, '0')}:${String(rawMin).padStart(2, '0')}`;
      consumedRanges.push({ start: matchStart, end: matchEnd, val: rawHour, role: 'time_of_day' });
    }
  }

  // 4. RELATIVE TIME DURATIONS (exclude from amount!)
  // e.g. "من 3 ساعات", "قبل 5 أيام"
  const durationRegex = /(?:من|قبل|منذ)\s*(\d+)\s*(?:ساعات|ساعة|أيام|ايام|يوم|دقائق|دقيقة|شهور|شهر)/gi;
  let durMatch: RegExpExecArray | null;
  while ((durMatch = durationRegex.exec(norm)) !== null) {
    const dVal = parseInt(durMatch[1], 10);
    consumedRanges.push({
      start: durMatch.index,
      end: durMatch.index + durMatch[0].length,
      val: dVal,
      role: 'duration',
    });
  }

  // 5. TRANSACTION AMOUNT EXTRACTION
  // ONLY match numbers that are NOT consumed by day, time, range, or duration!
  let amount: number | null = null;
  const numRegex = /\b(\d+(?:[.,]\d+)?)\s*(k|ألف|الف)?(?:\s*(جنيه|egp|usd|دولار|\$|ريال|درهم|eur))?/gi;
  let nMatch: RegExpExecArray | null;

  while ((nMatch = numRegex.exec(norm)) !== null) {
    const rawValStr = nMatch[1].replace(',', '');
    const numVal = parseFloat(rawValStr);
    const startPos = nMatch.index;
    const endPos = startPos + nMatch[0].length;

    // Check if this token overlaps with any consumed role (day, time, date range, duration)
    const isConsumed = consumedRanges.some((c) => {
      if (startPos >= c.start && startPos < c.end) return true;
      if (endPos > c.start && endPos <= c.end) return true;
      return false;
    });

    if (!isConsumed && !isNaN(numVal) && numVal > 0) {
      let finalVal = numVal;
      if (nMatch[2] || nMatch[0].includes('k') || nMatch[0].includes('ألف') || nMatch[0].includes('الف')) {
        finalVal *= 1000;
      }
      amount = finalVal;
      break;
    }
  }

  return {
    dateFrom,
    dateTo,
    dayFromNum,
    dayToNum,
    specificDay,
    specificMonth,
    specificYear,
    specificDateStr,
    specificHour,
    specificMinute,
    specificTimeStr,
    amount,
    currency,
  };
}
