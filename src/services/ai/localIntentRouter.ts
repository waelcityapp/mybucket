import { isFinancialQueryText } from '../../utils/semanticParser';
import { isExplicitMoneyReceipt } from '../../utils/receivedMoneyPhrase';

export type LocalCommandIntent = 'SAVE_REQUEST' | 'FINANCIAL_QUERY' | 'CREATE_TRANSACTION' | 'UNKNOWN';

/** Route locally and conservatively: an unknown utterance is never a new expense. */
export function classifyLocalIntent(rawText: string, hasDraft: boolean = false): LocalCommandIntent {
  const raw = rawText.toLowerCase().trim();
  if (!raw) return 'UNKNOWN';
  // A confirmation requires the actual save control. "سجلت" is NOT "سجل".
  if (/^(?:تمام\s+)?(?:احفظ(?:ها| العملية)?|سجل(?:ها| العملية)?|أكد|اكد|تأكيد|حفظ العملية|اعتمد(?:ها)?|save(?: it)?|confirm(?: it)?)[!؟.\s]*$/i.test(raw)) {
    return 'SAVE_REQUEST';
  }
  if (hasDraft) return 'UNKNOWN'; // The caller processes explicit draft corrections.
  if (isFinancialQueryText(raw)) return 'FINANCIAL_QUERY';
  if (isExplicitMoneyReceipt(raw)) return 'CREATE_TRANSACTION';
  const event = /(?:^|[\s،,.])(?:أنا\s+|انا\s+|i\s+)?(?:صرفت|صرفنا|دفعت|دفعنا|اشتريت|شريت|جبت|قبضت|استلمت|جالي|دخلني|حولت|حوّلت|حولي|حولنا|نقلت|سددت|paid|spent|bought|purchased|received|earned|transferred|transfer|i paid|i spent)(?=$|[\s،,.])/i.test(raw);
  const financialNoun = /(?:^|[\s،,.])(?:مصروف|دخل|ايراد|إيراد|مرتب|راتب|تحويل|income|expense|salary)(?=$|[\s،,.])/i.test(raw);
  if (event || financialNoun) return 'CREATE_TRANSACTION';
  const money = /(?:^|[\s،,.])\d+(?:[.,]\d+)?\s*(?:جنيه|جنية|egp|دولار|usd|ريال|sar|درهم|aed|eur|يورو)(?=$|[\s،,.])/i;
  const rest = raw.replace(money, '').replace(/[\s،,.]+/g, '');
  if (money.test(raw) && rest.length >= 3) return 'CREATE_TRANSACTION';
  return 'UNKNOWN';
}
