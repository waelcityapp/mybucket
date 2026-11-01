import { removeRelativeDayPhrase } from './relativeDayPhrase';
import { removeTodayDateExpression } from './todayDateExpression';

/**
 * Extract only the user's stated transaction note. Never invent categories or
 * reasons. Reason clauses preserve their wording, numbers and private labels.
 */
export function extractTransactionDescription(raw: string, parsedAmount: number | null): string {
  if (!raw.trim()) return '';

  const connector = /(?:^|\s)(علشان|عشان|بخصوص|بسبب|لأجل|من أجل|because|regarding)(?=\s|$)/i.exec(raw);
  const header = connector ? raw.slice(0, connector.index) : raw;
  const explanation = connector
    ? removeTodayDateExpression(removeRelativeDayPhrase(raw.slice(connector.index + connector[0].length))).trim()
      .replace(/^(?:(?:أنا|انا|إني|اني)\s+)?(?:جبت|جايب|جايبة)\s+/i, '')
    : '';

  let note = removeTodayDateExpression(removeRelativeDayPhrase(header.trim()))
    .replace(/(?:^|\s)(?:الساعة|ساعة)\s*\d{1,2}(?::\d{2})?\s*(?:صباحا|صباحاً|مساء|مساءً|الصبح|بالليل|عصراً|العصر|am|pm)?(?=\s|$|[،,.])/gi, ' ')
    .replace(/(?:^|\s)(?:يوم|بتاريخ)\s*\d{1,2}(?:\s*(?:يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر))?(?=\s|$|[،,.])/gi, ' ')
    // Treat "أول امبارح" and equivalent phrases as a single date expression.
    .replace(/(?:^|\s)(?:من\s+)?(?:أول|اول|قبل)\s+(?:امبارح|إمبارح|أمس|امس)(?=\s|$|[،,.])/gi, ' ')
    .replace(/(?:^|\s)(?:(?:the\s+)?day\s+before\s+yesterday|(?:two|2)\s+days?\s+ago)(?=\s|$|[،,.])/gi, ' ')
    .replace(/(?:^|\s)(?:امبارح|إمبارح|أمس|امس|yesterday)(?=\s|$|[،,.])/gi, ' ');

  // Match on a same-length normalized copy while keeping original characters.
  // Remove the transaction amount once, leaving numbers in user notes intact.
  if (parsedAmount !== null && parsedAmount > 0) {
    const normalized = note.replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
    const amountToken = /(?<!\d)(\d+(?:[.,]\d+)?)\s*(ألف|الف|k)?\s*(جنيه|جنية|ج|egp|usd|دولار|ريال|درهم|eur|يورو|\$)?/gi;
    for (const token of normalized.matchAll(amountToken)) {
      const numericValue = Number(token[1].replace(',', '.'));
      const value = token[2] ? numericValue * 1000 : numericValue;
      if (value === parsedAmount && token.index !== undefined) {
        note = note.slice(0, token.index) + ' ' + note.slice(token.index + token[0].length);
        break;
      }
    }
  }

  note = note
    .replace(/(^|[\s،,])(?:دفعت|صرفت|صرفتها|صرفته|صرافه|صرافة|اشتريت|قبضت|حولت|حول|استلمت|جالي|paid|spent|bought|purchased|received|earned|transferred|transfer|moved)(?=\s|$|[،,.])/gi, '$1')
    .replace(/(?:^|\s)(?:من\s+)?(?:الكاش|البنك|الفيزا|كاش|فيزا|بنك|cash|card|bank)(?=\s|$|[،,.])/gi, ' ')
    .replace(/(?:^|\s)(?:للكاش|للبنك|للفيزا|إلى\s+الكاش|الى\s+الكاش|إلى\s+البنك|الى\s+البنك|إلى\s+الفيزا|الى\s+الفيزا)(?=\s|$|[،,.])/gi, ' ')
    .replace(/(?:^|\s)(?:جنيه|جنية|egp|usd|دولار|ريال|درهم|eur|يورو)(?=\s|$|[،,.])/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    // "أنا جبت هدية لأخويا" describes the item, not the user's identity.
    // Drop introductory speech filler but never strip words inside the note.
    .replace(/^(?:(?:أنا|انا|إني|اني|I)\s+)?(?:جبت|جايب|جايبة|i bought)\s+/i, '')
    .replace(/^(?:(?:أنا|انا|إني|اني|I)\s+)+/i, '')
    .replace(/^(?:على|علي|في|فى|لـ)\s+(?=\S)/i, '')
    .trim()
    .replace(/^(?:أنا|انا|إني|اني|I|في|فى|على|علي|من)$/i, '')
    .replace(/^[\s،,.:؛;-]+|[\s،,.:؛;-]+$/g, '')
    .trim();

  if (!note) return explanation;
  if (!explanation) return note;
  // Keep an actual written connector between two meaningful note phrases.
  return [note, connector?.[1] || '', explanation].filter(Boolean).join(' ');
}
