export const SUPPORTED_CURRENCIES = ["EGP","SAR","AED","KWD","QAR","BHD","OMR","JOD","MAD","TND","USD","EUR","GBP","CHF","CAD","AUD","JPY","CNY","TRY"] as const;
export type CurrencyCode = typeof SUPPORTED_CURRENCIES[number];
export const CURRENCY_NAMES: Record<CurrencyCode, { ar: string; en: string }> = {
  EGP: { ar: 'الجنيه المصري', en: 'Egyptian pound' },
  SAR: { ar: 'الريال السعودي', en: 'Saudi riyal' },
  AED: { ar: 'الدرهم الإماراتي', en: 'UAE dirham' },
  KWD: { ar: 'الدينار الكويتي', en: 'Kuwaiti dinar' },
  QAR: { ar: 'الريال القطري', en: 'Qatari riyal' },
  BHD: { ar: 'الدينار البحريني', en: 'Bahraini dinar' },
  OMR: { ar: 'الريال العماني', en: 'Omani rial' },
  JOD: { ar: 'الدينار الأردني', en: 'Jordanian dinar' },
  MAD: { ar: 'الدرهم المغربي', en: 'Moroccan dirham' },
  TND: { ar: 'الدينار التونسي', en: 'Tunisian dinar' },
  USD: { ar: 'الدولار الأمريكي', en: 'US dollar' },
  EUR: { ar: 'اليورو', en: 'Euro' },
  GBP: { ar: 'الجنيه الإسترليني', en: 'British pound' },
  CHF: { ar: 'الفرنك السويسري', en: 'Swiss franc' },
  CAD: { ar: 'الدولار الكندي', en: 'Canadian dollar' },
  AUD: { ar: 'الدولار الأسترالي', en: 'Australian dollar' },
  JPY: { ar: 'الين الياباني', en: 'Japanese yen' },
  CNY: { ar: 'اليوان الصيني', en: 'Chinese yuan' },
  TRY: { ar: 'الليرة التركية', en: 'Turkish lira' },
};
export const currencyName = (code: string, lang: 'ar' | 'en') => CURRENCY_NAMES[code as CurrencyCode]?.[lang] || code;

export type AccountType = 'cash' | 'bank' | 'card' | 'savings' | 'wallet' | 'other' | 'custom' | 'credit';

export interface FinancialAccount {
  id: string;
  name: string;
  nameAr: string;
  type: AccountType;
  balance: number;
  currency: CurrencyCode;
  color?: string;
  linkedBankId?: string;
  creditLimit?: number;
}

export type TransactionType = 'expense' | 'income' | 'transfer';

export interface Category {
  id: string;
  name: string;
  nameAr: string;
  icon: string;
  type: 'expense' | 'income';
  color: string;
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  currency: CurrencyCode;
  accountId: string; // payment method selected by user
  balanceAccountId?: string; // actual balance affected when saved
  toBalanceAccountId?: string;
  toAccountId?: string; // destination account for transfer
  categoryId?: string;
  description: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm (e.g. 15:30)
  dateTime?: string; // ISO 8601 string timezone-safe (e.g. 2026-09-05T15:30:00.000Z)
  createdAt: string;
}

export type ActiveTab = 'home' | 'transactions' | 'search' | 'accounts' | 'categories' | 'settings' | 'admin' | 'admin-pin' | 'trial-details' | 'subscription' | 'guide' | 'offers' | 'reminders';
export type Language = 'ar' | 'en';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt?: string;
}
