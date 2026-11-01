/**
 * Common Egyptian-Arabic speech recognition spellings for "today", plus
 * Modern Standard Arabic and English. Match complete tokens: never erase
 * parts of longer words in a legitimate transaction description.
 */
const todayDateToken = /(?:^|[\s،,.؛:!?؟])(?:النهاردة|النهارده|النهاردا|النهرده|اليوم|today)(?=$|[\s،,.؛:!?؟])/i;
const allTodayDateTokens = /(?:^|[\s،,.؛:!?؟])(?:النهاردة|النهارده|النهاردا|النهرده|اليوم|today)(?=$|[\s،,.؛:!?؟])/gi;

export function hasTodayDateExpression(text: string): boolean {
  return todayDateToken.test(text);
}

export function removeTodayDateExpression(text: string): string {
  return text.replace(allTodayDateTokens, ' ');
}
