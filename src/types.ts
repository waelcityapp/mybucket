export type CurrencyCode = 'EGP' | 'USD' | 'SAR' | 'AED' | 'EUR';

export type AccountType = 'cash' | 'bank' | 'card' | 'savings' | 'wallet';

export interface FinancialAccount {
  id: string;
  name: string;
  nameAr: string;
  type: AccountType;
  balance: number;
  currency: CurrencyCode;
  color?: string;
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
  accountId: string; // source account for expense/income/transfer
  toAccountId?: string; // destination account for transfer
  categoryId?: string;
  description: string;
  date: string; // YYYY-MM-DD
  time?: string; // HH:mm (e.g. 15:30)
  dateTime?: string; // ISO 8601 string timezone-safe (e.g. 2026-09-05T15:30:00.000Z)
  createdAt: string;
}

export type ActiveTab = 'home' | 'transactions' | 'accounts' | 'categories' | 'settings';
export type Language = 'ar' | 'en';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}
