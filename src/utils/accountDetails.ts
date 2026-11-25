import type { FinancialAccount, Transaction } from '../types';

export function isProtectedCashAccount(account: Pick<FinancialAccount, 'id' | 'type'>) {
  return account.type === 'cash' || account.id === 'setup_cash' || account.id === 'acc_cash';
}

export function referencesAccount(transaction: Transaction, id: string) {
  return [transaction.accountId, transaction.toAccountId, transaction.balanceAccountId, transaction.toBalanceAccountId].includes(id);
}

export function canLinkIndependentMethod(account: Pick<FinancialAccount, 'type' | 'linkedBankId'>) {
  return !account.linkedBankId && ['card', 'wallet', 'other'].includes(account.type);
}

export function isIndependentMethodLink(previous: FinancialAccount, next: FinancialAccount) {
  return canLinkIndependentMethod(previous) && Boolean(next.linkedBankId) &&
    next.currency === previous.currency &&
    (previous.type === 'other' ? next.type === 'wallet' : next.type === previous.type);
}
