import { FinancialAccount, Category, TransactionType, CurrencyCode, Transaction } from '../../types';

export type AIIntent = 'CREATE_TRANSACTION' | 'FINANCIAL_QUERY' | 'CORRECT_PROPOSAL' | 'UNKNOWN';

export interface AITransactionProposal {
  type: TransactionType | null;
  amount: number | null;
  currency: CurrencyCode | string | null;
  accountId: string | null;
  toAccountId?: string | null;
  categoryId?: string | null;
  description: string | null;
  date: string | null; // YYYY-MM-DD
  time: string | null; // HH:mm
  missingFields: string[]; // e.g. ['accountId'] if account was not mentioned
  confidence?: number;
}

export type FinancialQueryMetric =
  | 'total_spent'
  | 'total_income'
  | 'category_spent'
  | 'account_balance'
  | 'net_savings'
  | 'transaction_count'
  | 'recent_list'
  | 'unknown';

export type FinancialQueryPeriod =
  | 'today'
  | 'yesterday'
  | 'this_week'
  | 'last_week'
  | 'this_month'
  | 'last_month'
  | 'all_time'
  | 'custom';

export interface AIFinancialQuery {
  metric: FinancialQueryMetric;
  period: FinancialQueryPeriod;
  startDate?: string | null;
  endDate?: string | null;
  categoryId?: string | null;
  categoryName?: string | null;
  accountId?: string | null;
  accountName?: string | null;
  transactionType?: TransactionType | null;
}

export interface AICorrection {
  fieldToUpdate: string | null;
  newValue: string | number | null;
}

export interface AIInterpretationResult {
  intent: AIIntent;
  confidence: number;
  transaction: AITransactionProposal | null;
  query: AIFinancialQuery | null;
  correction: AICorrection | null;
  clarificationNeeded: string | null;
  rawInterpretationSummary: string | null;
}

export interface AIInterpretationRequest {
  text: string;
  accounts: Array<{
    id: string;
    name: string;
    nameAr: string;
    type: string;
    currency: string;
  }>;
  categories: Array<{
    id: string;
    name: string;
    nameAr: string;
    type: string;
  }>;
  currentDateTime: string; // ISO string in local time
  userTimezone: string;
  lang: 'ar' | 'en';
  currentProposal?: Partial<Transaction> | null;
}

export interface DeterministicBreakdownItem {
  id: string;
  label: string;
  amount: number;
  percentage?: number;
  icon?: string;
  color?: string;
}

export interface DeterministicQueryResult {
  question: string;
  headline: string;
  amount: number | null;
  currency: string;
  details: string;
  periodText: string;
  transactionCount?: number;
  breakdown?: DeterministicBreakdownItem[];
  matchingTransactions?: Transaction[];
}

/**
 * Provider-independent interface for AI interpretation.
 * Gemini is the current provider, but this interface allows swapping to another provider.
 */
export interface AIInterpretationProvider {
  interpret(request: AIInterpretationRequest): Promise<AIInterpretationResult>;
}
