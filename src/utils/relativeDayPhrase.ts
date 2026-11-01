/**
 * Match explicit "N days ago" as one phrase in written or spoken Egyptian Arabic.
 * Transaction-date parsing and optional-note cleanup share this matcher.
 */
export interface RelativeDayPhrase {
  days: number;
  start: number;
  end: number;
}

const dayWords: Record<string, number> = {
  واحد: 1, واحده: 1, واحدة: 1,
  اتنين: 2, اثنين: 2, اثنان: 2,
  تلت: 3, تلات: 3, تلاته: 3, تلاتة: 3, ثلاث: 3, ثلاثة: 3, ثلاثه: 3,
  اربع: 4, اربعه: 4, أربعة: 4,
  خمس: 5, خمسه: 5, خمسة: 5,
  ست: 6, سته: 6, ستة: 6,
  سبع: 7, سبعه: 7, سبعة: 7,
  تمان: 8, تمانيه: 8, تمانية: 8, ثمانيه: 8, ثمانية: 8,
  تسع: 9, تسعه: 9, تسعة: 9,
  عشر: 10, عشره: 10, عشرة: 10,
};
const englishDayWords: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5,
  six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};

const arabicCountWords = Object.keys(dayWords).sort((a, b) => b.length - a.length).join('|');
const arabicPattern = new RegExp(
  '(?:^|[\\s،,])(?:من|قبل|منذ)\\s+([0-9٠-٩]+|' + arabicCountWords + ')\\s+(?:أيام|ايام|يوم)(?=$|[\\s،,.:؛!?؟])',
  'i'
);
const englishPattern = /\b([0-9]+|one|two|three|four|five|six|seven|eight|nine|ten)\s+days?\s+ago\b/i;

export function findRelativeDayPhrase(text: string): RelativeDayPhrase | null {
  const arabic = arabicPattern.exec(text);
  const english = englishPattern.exec(text);
  const selected = (!english || (arabic && arabic.index <= english.index)) ? arabic : english;
  if (!selected || selected.index === undefined) return null;

  const digitNormalized = selected[1].replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
  const wordNormalized = digitNormalized.toLowerCase().replace(/[أإآ]/g, 'ا');
  const days = /^\d+$/.test(digitNormalized)
    ? Number(digitNormalized)
    : dayWords[selected[1]] ?? dayWords[wordNormalized] ?? englishDayWords[wordNormalized] ?? 0;

  if (!Number.isInteger(days) || days < 1 || days > 3650) return null;
  return { days, start: selected.index, end: selected.index + selected[0].length };
}

export function removeRelativeDayPhrase(text: string): string {
  const matched = findRelativeDayPhrase(text);
  if (!matched) return text;
  return text.slice(0, matched.start) + ' ' + text.slice(matched.end);
}
