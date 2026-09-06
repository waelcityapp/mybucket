import { ARABIC_FINANCIAL_SLANG_BASE } from '../services/ai/aiKnowledgeBase';
import { aiLearnedMemory } from '../services/ai/aiLearnedMemory';

export interface MatchableCategory {
  id: string;
  name: string;
  nameAr: string;
  type?: string;
  [key: string]: any;
}

export interface MatchableAccount {
  id: string;
  name: string;
  nameAr: string;
  type?: string;
  currency?: string;
  [key: string]: any;
}

/**
 * Normalizes Arabic text for resilient comparison (removes diacritics, unifies alef, taa marbuta, etc.)
 */
export function normalizeArabic(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '') // Remove tashkeel/harakat
    .replace(/[إأآا]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[\s\-_]+/g, ' ')
    .trim();
}

/**
 * Build consolidated category synonyms from ARABIC_FINANCIAL_SLANG_BASE
 */
const CATEGORY_SYNONYMS: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {};
  for (const item of ARABIC_FINANCIAL_SLANG_BASE) {
    map[item.categoryKey] = item.synonyms;
  }
  return map;
})();

/**
 * Intelligent category detection matching the user's spoken or typed text
 * against available categories in their account, backed by rich Egyptian slang and continuous user learned memory.
 */
export function matchCategoryFromText<T extends MatchableCategory>(text: string, categories: T[]): T | null {
  if (!text || !categories || categories.length === 0) return null;

  const normText = normalizeArabic(text);

  // 1. Check User's Personal Learned Memory first (highest priority personalized learning)
  const learned = aiLearnedMemory.findLearnedMatch(text);
  if (learned && learned.categoryId) {
    const matchedLearned = categories.find((c) => c.id === learned.categoryId);
    if (matchedLearned) return matchedLearned;
  }

  // 2. Direct synonym matching from comprehensive Arabic financial knowledge base
  for (const [key, synonyms] of Object.entries(CATEGORY_SYNONYMS)) {
    const matchedSynonym = synonyms.some((syn) => normText.includes(normalizeArabic(syn)));
    if (matchedSynonym) {
      // Find category that matches this key in its ID or names
      const found = categories.find((c) => {
        const idLower = c.id.toLowerCase();
        const nameLower = c.name.toLowerCase();
        const normNameAr = normalizeArabic(c.nameAr);

        if (key === 'transport' && (idLower.includes('transport') || normNameAr.includes('مواصلات') || normNameAr.includes('بنزين') || normNameAr.includes('وقود') || normNameAr.includes('سيار'))) return true;
        if (key === 'food' && (idLower.includes('food') || normNameAr.includes('طعام') || normNameAr.includes('مشروبات') || normNameAr.includes('مطاعم') || normNameAr.includes('كافيه'))) return true;
        if (key === 'groceries' && (idLower.includes('groceries') || normNameAr.includes('بقالة') || normNameAr.includes('سوبرماركت') || normNameAr.includes('تموين') || normNameAr.includes('بيت'))) return true;
        if (key === 'bills' && (idLower.includes('bills') || normNameAr.includes('فواتير') || normNameAr.includes('التزامات') || normNameAr.includes('اشتراك') || normNameAr.includes('خدمات'))) return true;
        if (key === 'shopping' && (idLower.includes('shopping') || normNameAr.includes('تسوق') || normNameAr.includes('ملابس') || normNameAr.includes('مشتريات'))) return true;
        if (key === 'health' && (idLower.includes('health') || normNameAr.includes('صحة') || normNameAr.includes('علاج') || normNameAr.includes('دواء') || normNameAr.includes('صيدلية'))) return true;
        if (key === 'salary' && (idLower.includes('salary') || normNameAr.includes('راتب') || normNameAr.includes('مرتب') || normNameAr.includes('دخل') || normNameAr.includes('أرباح'))) return true;
        if (key === 'freelance' && (idLower.includes('freelance') || normNameAr.includes('حر') || normNameAr.includes('مشاريع'))) return true;

        return idLower.includes(key) || nameLower.includes(key);
      });

      if (found) return found;
    }
  }

  // 2. Exact or partial word matching against category names (handles any custom category)
  for (const cat of categories) {
    const normName = normalizeArabic(cat.name);
    const normNameAr = normalizeArabic(cat.nameAr);

    // Full name match
    if (normText.includes(normName) || normText.includes(normNameAr)) {
      return cat;
    }

    // Split words in Arabic name (e.g. "مواصلات وبنزين" -> ["مواصلات", "بنزين"])
    const wordsAr = normNameAr.split(/\s+|و/).filter((w) => w.length > 2);
    for (const w of wordsAr) {
      if (normText.includes(w)) {
        return cat;
      }
    }

    const wordsEn = normName.split(/\s+|&/).filter((w) => w.length > 2);
    for (const w of wordsEn) {
      if (normText.includes(w)) {
        return cat;
      }
    }
  }

  return null;
}

/**
 * Intelligent account detection matching user's text against available accounts
 */
export function matchAccountFromText<T extends MatchableAccount>(text: string, accounts: T[]): T | null {
  if (!text || !accounts || accounts.length === 0) return null;

  const normText = normalizeArabic(text);

  // 0. Check User's Personal Learned Memory for Account
  const learned = aiLearnedMemory.findLearnedMatch(text);
  if (learned && learned.accountId) {
    const matchedLearned = accounts.find((a) => a.id === learned.accountId);
    if (matchedLearned) return matchedLearned;
  }

  // 1. Cash / نقدي
  if (
    normText.includes('كاش') ||
    normText.includes('نقدي') ||
    normText.includes('نقديه') ||
    normText.includes('cash') ||
    normText.includes('من الكاش') ||
    normText.includes('صرفت من الكاش')
  ) {
    const cashAcc = accounts.find((a) => a.type === 'cash' || normalizeArabic(a.nameAr).includes('كاش') || a.name.toLowerCase().includes('cash'));
    if (cashAcc) return cashAcc;
  }

  // 2. Bank / بنكي
  if (
    normText.includes('بنك') ||
    normText.includes('بنكي') ||
    normText.includes('bank') ||
    normText.includes('حساب بنكي') ||
    normText.includes('من البنك') ||
    normText.includes('صرفت من البنك')
  ) {
    const bankAcc = accounts.find((a) => a.type === 'bank' || normalizeArabic(a.nameAr).includes('بنك') || a.name.toLowerCase().includes('bank'));
    if (bankAcc) return bankAcc;
  }

  // 3. Card / Visa / فيزا
  if (
    normText.includes('فيزا') ||
    normText.includes('كارت') ||
    normText.includes('بطاقه') ||
    normText.includes('visa') ||
    normText.includes('card') ||
    normText.includes('من الفيزا') ||
    normText.includes('صرفت من الفيزا')
  ) {
    const cardAcc = accounts.find((a) => a.type === 'card' || normalizeArabic(a.nameAr).includes('فيزا') || a.name.toLowerCase().includes('card') || a.name.toLowerCase().includes('visa'));
    if (cardAcc) return cardAcc;
  }

  // 4. USD / Savings / دولار
  if (
    normText.includes('دولار') ||
    normText.includes('usd') ||
    normText.includes('مدخرات') ||
    normText.includes('توفير') ||
    normText.includes('savings')
  ) {
    const usdAcc = accounts.find((a) => a.currency === 'USD' || a.type === 'savings' || normalizeArabic(a.nameAr).includes('دولار'));
    if (usdAcc) return usdAcc;
  }

  // 5. Electronic Wallets / Vodafone Cash / InstaPay / محفظة / محافظ إلكترونية
  if (
    normText.includes('محفظه') ||
    normText.includes('محافظ') ||
    normText.includes('الكترونيه') ||
    normText.includes('فودافون') ||
    normText.includes('فودافون كاش') ||
    normText.includes('اورانج') ||
    normText.includes('اتصالات كاش') ||
    normText.includes('انستاباي') ||
    normText.includes('انستا باي') ||
    normText.includes('انستا') ||
    normText.includes('تيلدا') ||
    normText.includes('wallet') ||
    normText.includes('wallets')
  ) {
    const walletAcc = accounts.find(
      (a) =>
        a.type === 'wallet' ||
        normalizeArabic(a.nameAr).includes('محفظ') ||
        normalizeArabic(a.nameAr).includes('محافظ') ||
        a.name.toLowerCase().includes('wallet')
    );
    if (walletAcc) return walletAcc;
  }

  // 6. Generic match by account names
  for (const acc of accounts) {
    const normName = normalizeArabic(acc.name);
    const normNameAr = normalizeArabic(acc.nameAr);

    if (normText.includes(normName) || normText.includes(normNameAr)) {
      return acc;
    }

    const words = normNameAr.split(/\s+/).filter((w) => w.length > 2);
    for (const w of words) {
      if (normText.includes(w)) {
        return acc;
      }
    }
  }

  return null;
}

/**
 * Extracts new description/note when user asks to edit the notes/description field
 */
export function matchDescriptionEdit(text: string): string | null {
  if (!text) return null;

  // Pattern: "غير/عدل خانة الملاحظات/الوصف إلى ..."
  const match = text.match(
    /(?:غير|عدل|خلي|اكتب في|بدل)?\s*(?:خانة\s*)?(?:الملاحظات|الملاحظه|الوصف|البيان|نوتس|notes)\s*(?:إلى|الى|هو|هي|:)?\s*["']?([^"']+)["']?/i
  );

  if (match && match[1]) {
    const clean = match[1].trim();
    if (clean.length > 0) return clean;
  }

  return null;
}

/**
 * Extracts new amount when user asks to edit amount
 */
export function matchAmountEdit(text: string): number | null {
  if (!text) return null;

  // Convert Arabic numerals (٠-٩) to English (0-9)
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  let cleanText = text;
  arabicNumerals.forEach((d, i) => {
    cleanText = cleanText.replace(new RegExp(d, 'g'), String(i));
  });

  // Pattern: "المبلغ 500" or "خلي المبلغ 500" or "غير المبلغ إلى 500"
  const match = cleanText.match(
    /(?:المبلغ|السعر|القيمة|المصروف|amount)\s*(?:إلى|الى|هو|هي|=|:)?\s*(\d+(?:\.\d+)?)/i
  );
  if (match && match[1]) {
    const val = parseFloat(match[1]);
    if (!isNaN(val) && val > 0) return val;
  }

  // Pattern: "خليها 500 جنيه"
  const match2 = cleanText.match(/(?:خليها|عدلها|اجعلها)\s*(\d+(?:\.\d+)?)\s*(?:جنيه|egp|ريال|دولار|\$)/i);
  if (match2 && match2[1]) {
    const val = parseFloat(match2[1]);
    if (!isNaN(val) && val > 0) return val;
  }

  return null;
}

/**
 * Extracts new transaction type when user asks to change type
 * Resiliently handles directional expressions ("من مصروف لدخل"), negations ("دخل مش صرف"),
 * conversions ("حول لدخل"), and direct statements ("النوع دخل", "خليها دخل").
 */
export function matchTransactionType(text: string): 'expense' | 'income' | 'transfer' | null {
  if (!text) return null;
  const norm = normalizeArabic(text);

  // 1. "من [نوع] ل/إلى [نوع]" (e.g., "من مصروف لدخل", "من دخل لمصروف", "من مصروف لتحويل")
  // The TARGET is the second one!
  const fromToMatch = norm.match(/من\s*(مصروف|صرف|دخل|ايراد|تحويل)\s*(?:ل|الي|الى)?\s*(مصروف|صرف|دخل|ايراد|تحويل)/);
  if (fromToMatch && fromToMatch[2]) {
    const target = fromToMatch[2];
    if (target === 'دخل' || target === 'ايراد') return 'income';
    if (target === 'مصروف' || target === 'صرف') return 'expense';
    if (target === 'تحويل') return 'transfer';
  }

  // 2. "بدل [other] خليها [target]" or "[target] بدل [other]"
  if (
    norm.match(/بدل\s*(?:صرف|مصروف)\s*(?:خليها|اجعلها|اعملها)?\s*(?:دخل|ايراد)/) ||
    norm.match(/(?:دخل|ايراد)\s*بدل\s*(?:صرف|مصروف)/)
  ) {
    return 'income';
  }
  if (
    norm.match(/بدل\s*(?:دخل|ايراد)\s*(?:خليها|اجعلها|اعملها)?\s*(?:صرف|مصروف)/) ||
    norm.match(/(?:صرف|مصروف)\s*بدل\s*(?:دخل|ايراد)/)
  ) {
    return 'expense';
  }
  if (
    norm.match(/بدل\s*(?:صرف|مصروف|دخل|ايراد)\s*(?:خليها|اجعلها|اعملها)?\s*(?:تحويل)/) ||
    norm.match(/(?:تحويل)\s*بدل\s*(?:صرف|مصروف|دخل|ايراد)/)
  ) {
    return 'transfer';
  }

  // 3. Negation patterns: "[target] مش [other]"
  if (norm.match(/(?:دخل|ايراد)\s*مش\s*(?:صرف|مصروف|تحويل)/)) {
    return 'income';
  }
  if (norm.match(/(?:صرف|مصروف)\s*مش\s*(?:دخل|ايراد|تحويل)/)) {
    return 'expense';
  }
  if (norm.match(/(?:تحويل)\s*مش\s*(?:صرف|مصروف|دخل|ايراد)/)) {
    return 'transfer';
  }

  // 4. "مش [other] خليها [target]"
  if (norm.match(/مش\s*(?:صرف|مصروف)\s*(?:خليها|بل|لكن|بل هي)?\s*(?:دخل|ايراد)/)) {
    return 'income';
  }
  if (norm.match(/مش\s*(?:دخل|ايراد)\s*(?:خليها|بل|لكن|بل هي)?\s*(?:صرف|مصروف)/)) {
    return 'expense';
  }

  // 5. "ل/إلى [نوع]" with conversion verbs (e.g., "حول لدخل", "غير لدخل", "حولها لدخل", "حول العملية لدخل")
  const toTypeMatch = norm.match(/(?:حول|غير|اجعل|خلي|نقل)?\s*(?:العمليه\s*)?(?:(?:\s+|^)ل|الي|الى)\s*(دخل|ايراد|مصروف|صرف|تحويل)/);
  if (toTypeMatch && toTypeMatch[1]) {
    const target = toTypeMatch[1];
    if (target === 'دخل' || target === 'ايراد') return 'income';
    if (target === 'مصروف' || target === 'صرف') return 'expense';
    if (target === 'تحويل') return 'transfer';
  }

  // 6. Explicit statements: "النوع دخل", "نوع العملية دخل", "خليها دخل", "اجعلها دخل"
  if (
    norm.match(/(?:نوع\s*العمليه|النوع|خليها|اجعلها|اعملها|خلي\s*العمليه|سجلها)\s*(?:هو|هي|=|:)?\s*(?:دخل|ايراد)/) ||
    norm.includes('العمليه دخل') ||
    norm.includes('عمليه دخل')
  ) {
    return 'income';
  }
  if (
    norm.match(/(?:نوع\s*العمليه|النوع|خليها|اجعلها|اعملها|خلي\s*العمليه|سجلها)\s*(?:هو|هي|=|:)?\s*(?:صرف|مصروف)/) ||
    norm.includes('العمليه صرف') ||
    norm.includes('العمليه مصروف')
  ) {
    return 'expense';
  }
  if (
    norm.match(/(?:نوع\s*العمليه|النوع|خليها|اجعلها|اعملها|خلي\s*العمليه|سجلها)\s*(?:هو|هي|=|:)?\s*(?:تحويل)/) ||
    norm.includes('العمليه تحويل')
  ) {
    return 'transfer';
  }

  // 7. General fallback if only one type is mentioned
  const hasExpense =
    (norm.includes('صرف') || norm.includes('مصروف') || norm.includes('expense')) &&
    !norm.includes('مش صرف') &&
    !norm.includes('مش مصروف');
  const hasIncome =
    (norm.includes('دخل') || norm.includes('ايراد') || norm.includes('income')) &&
    !norm.includes('مش دخل') &&
    !norm.includes('مش ايراد');
  const hasTransfer = norm.includes('تحويل') || norm.includes('نقل') || norm.includes('transfer');

  if (hasIncome && !hasExpense && !hasTransfer) return 'income';
  if (hasExpense && !hasIncome && !hasTransfer) return 'expense';
  if (hasTransfer && !hasIncome && !hasExpense) return 'transfer';

  return null;
}

/**
 * Detects Source Account and Destination Account from text for transfer operations
 * (e.g. "تحويل من الكاش للبنك", "تحويل للبنك", "حول من البنك للفيزا", "تحويل لحساب البنك", "معلش خليه تحويل للبنك")
 */
export function matchTransferAccountsFromText<T extends MatchableAccount>(
  text: string,
  accounts: T[],
  currentAccountId?: string | null
): { fromAccount: T | null; toAccount: T | null } {
  if (!text || !accounts || accounts.length === 0) {
    return { fromAccount: null, toAccount: null };
  }

  const norm = normalizeArabic(text);

  let fromAccount: T | null = null;
  let toAccount: T | null = null;

  // Destination account: prefixed by ل/الي/الى or لحساب/الي حساب
  const toRegex = /(?:(?:^|\s)(?:الي|الى|ل)(?:حساب)?)\s*([^\s,.]+)/i;
  const toMatch = norm.match(toRegex);
  if (toMatch && toMatch[1]) {
    toAccount = matchAccountFromText(toMatch[1], accounts);
  }

  // Source account: prefixed by من or من حساب
  const fromRegex = /(?:(?:^|\s)من(?:حساب)?)\s*([^\s,.]+)/i;
  const fromMatch = norm.match(fromRegex);
  if (fromMatch && fromMatch[1]) {
    fromAccount = matchAccountFromText(fromMatch[1], accounts);
  }

  // If only one account matched without explicit prefix
  if (!toAccount && !fromAccount) {
    const single = matchAccountFromText(text, accounts);
    if (single) {
      if (currentAccountId && single.id !== currentAccountId) {
        toAccount = single;
      } else {
        fromAccount = single;
      }
    }
  }

  return { fromAccount, toAccount };
}

