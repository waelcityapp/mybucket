import { FinancialAccount, Category, Transaction } from '../types';

export const INITIAL_ACCOUNTS: FinancialAccount[] = [
  {
    id: 'acc_cash',
    name: 'Cash',
    nameAr: 'كاش',
    type: 'cash',
    balance: 0,
    currency: 'EGP',
    color: '#10b981', // emerald
  },
  {
    id: 'acc_bank',
    name: 'Bank Account',
    nameAr: 'حساب بنكي',
    type: 'bank',
    balance: 0,
    currency: 'EGP',
    color: '#3b82f6', // blue
  },
  {
    id: 'acc_card',
    name: 'Visa Card',
    nameAr: 'فيزا',
    type: 'card',
    balance: 0,
    currency: 'EGP',
    color: '#8b5cf6', // purple
  },
  {
    id: 'acc_wallet',
    name: 'E-Wallets',
    nameAr: 'محافظ إلكترونية',
    type: 'wallet',
    balance: 0,
    currency: 'EGP',
    color: '#06b6d4', // cyan
  },
  {
    id: 'acc_other',
    name: 'Other Methods',
    nameAr: 'وسائل دفع واستلام أخرى',
    type: 'other',
    balance: 0,
    currency: 'EGP',
    color: '#f59e0b', // amber
  },
  {
    id: 'acc_extra',
    name: 'Other Accounts',
    nameAr: 'حسابات أخرى',
    type: 'custom',
    balance: 0,
    currency: 'EGP',
    color: '#6366f1', // indigo
  },
];

export const INITIAL_CATEGORIES: Category[] = [
  {
    id: 'cat_food',
    name: 'Food & Drinks',
    nameAr: 'طعام ومشروبات',
    icon: 'Coffee',
    type: 'expense',
    color: '#f97316',
  },
  {
    id: 'cat_groceries',
    name: 'Groceries',
    nameAr: 'بقالة وسوبرماركت',
    icon: 'ShoppingCart',
    type: 'expense',
    color: '#06b6d4',
  },
  {
    id: 'cat_transport',
    name: 'Transport',
    nameAr: 'مواصلات وبنزين',
    icon: 'Car',
    type: 'expense',
    color: '#6366f1',
  },
  {
    id: 'cat_bills',
    name: 'Bills & Utilities',
    nameAr: 'فواتير والتزامات',
    icon: 'Receipt',
    type: 'expense',
    color: '#ef4444',
  },
  {
    id: 'cat_shopping',
    name: 'Shopping',
    nameAr: 'تسوق وملابس',
    icon: 'ShoppingBag',
    type: 'expense',
    color: '#ec4899',
  },
  {
    id: 'cat_health',
    name: 'Health & Pharmacy',
    nameAr: 'صحة وعلاج',
    icon: 'HeartPulse',
    type: 'expense',
    color: '#14b8a6',
  },
  {
    id: 'cat_salary',
    name: 'Salary',
    nameAr: 'راتب شهري',
    icon: 'Briefcase',
    type: 'income',
    color: '#10b981',
  },
  {
    id: 'cat_freelance',
    name: 'Freelance & Business',
    nameAr: 'عمل حر وأرباح',
    icon: 'Coins',
    type: 'income',
    color: '#8b5cf6',
  },
  {
    id: 'cat_investments',
    name: 'Investments',
    nameAr: 'عوائد استثمار',
    icon: 'TrendingUp',
    type: 'income',
    color: '#3b82f6',
  },
  {
    id: 'cat_other',
    name: 'Other',
    nameAr: 'أخرى',
    icon: 'MoreHorizontal',
    type: 'expense',
    color: '#64748b',
  },
];

const today = new Date().toISOString().split('T')[0];

export const INITIAL_TRANSACTIONS: Transaction[] = [];
