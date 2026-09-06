import { FinancialAccount, Category, TransactionType, CurrencyCode } from '../types';
import { parseNaturalDateTime } from './dateTime';
import { parseSemanticNumberRoles, isFinancialQueryText } from './semanticParser';

export interface ParsedTransactionDraft {
  type: TransactionType;
  amount: number | null;
  currency: CurrencyCode;
  accountId: string;
  toAccountId?: string;
  categoryId?: string;
  description: string;
  date: string;
  time: string;
  dateTime: string;
  rawText: string;
}

export function parseNaturalLanguageInput(
  text: string,
  accounts: FinancialAccount[],
  categories: Category[]
): ParsedTransactionDraft {
  const raw = text.trim();
  const lower = raw.toLowerCase();

  // Use semantic number-role parser and query detection
  const semanticRoles = parseSemanticNumberRoles(raw);
  const isQuery = isFinancialQueryText(raw);

  // 1. Detect Type
  let type: TransactionType = 'expense';
  if (
    lower.includes('حولت') ||
    lower.includes('تحويل') ||
    lower.includes('حول') ||
    lower.includes('نقل') ||
    lower.includes('transfer')
  ) {
    type = 'transfer';
  } else if (
    lower.includes('قبضت') ||
    lower.includes('راتب') ||
    lower.includes('مرتب') ||
    lower.includes('دخل') ||
    lower.includes('استلمت') ||
    lower.includes('جالي') ||
    lower.includes('مكافأة') ||
    lower.includes('أرباح') ||
    lower.includes('ارباح') ||
    lower.includes('income') ||
    lower.includes('salary')
  ) {
    type = 'income';
  }

  // 2. Extract Amount:
  // If the user is asking a question/query (e.g. "أنا صرفت قد إيه" or "دفعت كام"), amount is strictly null.
  // When recording a transaction, only numbers whose semantic role is an actual transaction amount are used
  // (numbers representing days of month, hours of day, or date ranges are NEVER used as amounts).
  let amount: number | null = isQuery ? null : semanticRoles.amount;

  // 3. Extract Currency
  let currency: CurrencyCode = semanticRoles.currency;

  // 4. Extract Accounts
  let accountId = accounts[0]?.id || '';
  let toAccountId: string | undefined = undefined;

  // Source Account detection
  if (lower.includes('كاش') || lower.includes('نقدي') || lower.includes('cash')) {
    const cashAcc = accounts.find((a) => a.type === 'cash');
    if (cashAcc) accountId = cashAcc.id;
  } else if (lower.includes('فيزا') || lower.includes('visa') || lower.includes('كارت') || lower.includes('card')) {
    const cardAcc = accounts.find((a) => a.type === 'card');
    if (cardAcc) accountId = cardAcc.id;
  } else if (lower.includes('بنك') || lower.includes('bank') || lower.includes('حساب بنكي')) {
    const bankAcc = accounts.find((a) => a.type === 'bank');
    if (bankAcc) accountId = bankAcc.id;
  } else if (lower.includes('دولار') || lower.includes('مدخرات')) {
    const savAcc = accounts.find((a) => a.currency === 'USD' || a.type === 'savings');
    if (savAcc) accountId = savAcc.id;
  }

  // Transfer destination account detection
  if (type === 'transfer') {
    // Look for "إلى" / "لـ"
    if (lower.includes('للكاش') || lower.includes('إلى الكاش') || lower.includes('الى الكاش')) {
      toAccountId = accounts.find((a) => a.type === 'cash')?.id;
    } else if (lower.includes('للبنك') || lower.includes('إلى البنك') || lower.includes('للحساب البنكي')) {
      toAccountId = accounts.find((a) => a.type === 'bank')?.id;
    } else if (lower.includes('للفيزا') || lower.includes('إلى الفيزا')) {
      toAccountId = accounts.find((a) => a.type === 'card')?.id;
    }

    if (!toAccountId) {
      // Pick second account if available
      toAccountId = accounts.find((a) => a.id !== accountId)?.id || accounts[1]?.id;
    }
  }

  // 5. Extract Category
  let categoryId: string | undefined = undefined;
  if (type !== 'transfer') {
    const availableCats = categories.filter((c) => c.type === (type === 'income' ? 'income' : 'expense'));

    if (lower.includes('بنزين') || lower.includes('مواصلات') || lower.includes('اوبر') || lower.includes('تاكسي')) {
      categoryId = availableCats.find((c) => c.nameAr.includes('مواصلات') || c.name.toLowerCase().includes('transport'))?.id;
    } else if (lower.includes('قهوة') || lower.includes('كافيه') || lower.includes('شاي') || lower.includes('مطعم') || lower.includes('عشاء') || lower.includes('غداء') || lower.includes('أكل') || lower.includes('اكل')) {
      categoryId = availableCats.find((c) => c.nameAr.includes('طعام') || c.nameAr.includes('قهوة') || c.name.toLowerCase().includes('food'))?.id;
    } else if (lower.includes('سوبر ماركت') || lower.includes('ماركت') || lower.includes('طلبات البيت') || lower.includes('بقالة')) {
      categoryId = availableCats.find((c) => c.nameAr.includes('سوبر') || c.nameAr.includes('بقالة') || c.nameAr.includes('طعام'))?.id;
    } else if (lower.includes('راتب') || lower.includes('مرتب')) {
      categoryId = availableCats.find((c) => c.nameAr.includes('راتب') || c.name.toLowerCase().includes('salary'))?.id;
    } else if (lower.includes('فواتير') || lower.includes('كهرباء') || lower.includes('نت') || lower.includes('فاتورة')) {
      categoryId = availableCats.find((c) => c.nameAr.includes('فواتير') || c.name.toLowerCase().includes('bill'))?.id;
    } else if (lower.includes('تسوق') || lower.includes('هدوم') || lower.includes('ملابس')) {
      categoryId = availableCats.find((c) => c.nameAr.includes('تسوق') || c.name.toLowerCase().includes('shopping'))?.id;
    }

    if (!categoryId && availableCats.length > 0) {
      categoryId = availableCats[0].id;
    }
  }

  // 6. Extract Description
  let description = raw;
  // Clean common trigger words from description
  let cleanDesc = raw
    .replace(/(?:دفعت|صرفت|اشتريت|قبضت|حولت|حول|استلمت|جالي)\s*/gi, '')
    .replace(/\b\d+(?:[.,]\d+)?\b/g, '')
    .replace(/(?:جنيه|egp|usd|دولار|\$)/gi, '')
    .replace(/(?:من الكاش|من البنك|من الفيزا|للكاش|للبنك|للفيزا|كاش|فيزا|بنك)/gi, '')
    .replace(/(?:النهاردة|امبارح|أمس|الساعة\s*\d+(?::\d+)?\s*(?:مساءً|صباحاً|مساء|صباح)?)/gi, '')
    .replace(/(?:يوم\s*\d+\s*(?:يناير|فبراير|مارس|أبريل|ابريل|مايو|يونيو|يوليو|أغسطس|اغسطس|سبتمبر|أكتوبر|اكتوبر|نوفمبر|ديسمبر)?)/gi, '')
    .trim();

  if (cleanDesc.length > 1) {
    description = cleanDesc;
  } else {
    // Fallback based on category or type
    if (lower.includes('بنزين')) description = 'بنزين';
    else if (lower.includes('قهوة')) description = 'قهوة';
    else if (lower.includes('سوبر ماركت')) description = 'مشتريات سوبر ماركت';
    else if (lower.includes('راتب')) description = 'راتب';
    else if (type === 'transfer') description = 'تحويل مالي';
    else description = type === 'income' ? 'دخل' : 'مصروف';
  }

  // 7. Extract Date and Time
  const dt = parseNaturalDateTime(raw);
  const date = semanticRoles.specificDateStr || dt.date;
  const time = semanticRoles.specificTimeStr || dt.time;
  const dateTime = `${date}T${time}:00.000Z`;

  return {
    type,
    amount,
    currency,
    accountId,
    toAccountId,
    categoryId,
    description,
    date,
    time,
    dateTime,
    rawText: raw,
  };
}
