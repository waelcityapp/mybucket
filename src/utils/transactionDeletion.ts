import type { Transaction, TransactionType } from '../types';

export function selectTransactionsForDeletion(transactions: Transaction[], kind: 'all' | TransactionType, from: string, to: string) {
  return transactions.filter(tx =>
    (kind === 'all' || tx.type === kind) && (!from || tx.date >= from) && (!to || tx.date <= to)
  );
}
