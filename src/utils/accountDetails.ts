import type { FinancialAccount, Transaction } from '../types';

export function isProtectedCashAccount(account: Pick<FinancialAccount, 'id' | 'type'>) {
  return account.type === 'cash' || account.id === 'setup_cash' || account.id === 'acc_cash';
}

export function referencesAccount(transaction: Transaction, id: string) {
  return [transaction.accountId, transaction.toAccountId, transaction.balanceAccountId, transaction.toBalanceAccountId].includes(id);
}
