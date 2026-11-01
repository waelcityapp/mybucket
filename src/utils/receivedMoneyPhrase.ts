/**
 * Recognize explicit money RECEIVED by the user, not any use of "أخدت".
 * "أخدت تاكسي/دواء بـ 200" is a purchase, while "أخدت 200 من فلان"
 * describes incoming funds (including repayment of money owed).
 *
 * A receipt is a positive account cashflow; its category is deliberately NOT
 * guessed (a debt repayment is not necessarily newly earned salary/revenue).
 */
const receiptVerb = /(?:^|[\s،,.])(?:اخدت|أخدت|أخذت|خدت|خدنا)(?=$|[\s،,.])/i;
const explicitReturn = /(?:^|[\s،,.])(?:استرديت|استرددت|استرجعت|رجعلي|رجعتلي|ردلي|ردولي)(?=$|[\s،,.])/i;
const moneyAmount = /(?:^|[\s،,.])(?:\d+|[٠-٩]+)(?:[.,]\d+)?(?:\s*(?:جنيه|جنية|ج|egp|دولار|usd|ريال|درهم|eur|يورو))?(?=$|[\s،,.])/i;
const receiptLeading = /(?:^|[\s،,.])(?:اخدت|أخدت|أخذت|خدت|خدنا)\s+(?:(?:\d+|[٠-٩]+)(?:[.,]\d+)?|(?:فلوس|فلوسي|مبلغ|مستحقاتي|حقي|حقى)|(?:من|عند)\s+\S+)/i;
const payerSource = /(?:^|[\s،,.])(?:من|عند)\s+(?!(?:الكاش|كاش|البنك|بنك|الحساب|حساب|الفيزا|فيزا|المحفظة|محفظة|cash|bank|card)(?=$|[\s،,.]))[^\s،,.]+/i;
const moneyMention = /(?:^|[\s،,.])(?:فلوس|فلوسي|مبلغ|مستحقاتي|حقي|حقى)(?=$|[\s،,.])/i;

export function isExplicitMoneyReceipt(rawText: string): boolean {
  const text = rawText.trim();
  if (!text) return false;
  if (explicitReturn.test(text)) return moneyAmount.test(text) || moneyMention.test(text);
  if (!receiptVerb.test(text) || !receiptLeading.test(text)) return false;
  // Money must have come from an actual person or organization; do not confuse
  // cash withdrawn from one's own bank account with new income.
  return payerSource.test(text) && (moneyAmount.test(text) || moneyMention.test(text));
}
