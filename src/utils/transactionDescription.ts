/**
 * Extract only the user's stated transaction note. Never invent categories or
 * reasons. Reason clauses preserve their wording, numbers and private labels.
 */
export function extractTransactionDescription(raw: string, parsedAmount: number | null): string {
  if (!raw.trim()) return '';

  const connector = /(?:^|\s)(علشان|عشان|بخصوص|بسبب|لأجل|من أجل|because|regarding)(?=\s|$)/i.exec(raw);
  const header = connector ? raw.slice(0, connector.index) : raw;
  const explanation = connector ? raw.slice(connector.index + connector[0].length).trim() : '';

  let note = header.trim()
    .replace(/(?:^|\s)(?:الساعة|ساعة)\s*\d{1,2}(?::\d{2})?\s*(?:صباحا|صباحاً|مساء|مساءً|الصبح|بالليل|عصراً|العصر|am|pm)?(?=\s|$|[،,.])/gi, ' ')
    .replace(/(?:^|\s)(?:يوم|بتاريخ)\s*\d{1,2}(?:\s*(?:يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر))?(?=\s|$|[،,.])/gi, ' ')
    .replace(/(?:^|\s)(?:النهاردة|امبارح|أمس|اليوم|today|yesterday)(?=\s|$|[،,.])/gi, ' ');

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
    .replace(/(^|[\s،,])(?:دفعت|صرفت|اشتريت|قبضت|حولت|حول|استلمت|جالي|paid|spent|bought|purchased|received|earned|transferred|transfer|moved)(?=\s|$|[،,.])/gi, '$1')
    .replace(/(?:^|\s)(?:من\s+)?(?:الكاش|البنك|الفيزا|كاش|فيزا|بنك|cash|card|bank)(?=\s|$|[،,.])/gi, ' ')
    .replace(/(?:^|\s)(?:للكاش|للبنك|للفيزا|إلى\s+الكاش|الى\s+الكاش|إلى\s+البنك|الى\s+البنك|إلى\s+الفيزا|الى\s+الفيزا)(?=\s|$|[،,.])/gi, ' ')
    .replace(/(?:^|\s)(?:جنيه|جنية|egp|usd|دولار|ريال|درهم|eur|يورو)(?=\s|$|[،,.])/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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
