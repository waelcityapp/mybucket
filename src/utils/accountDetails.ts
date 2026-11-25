import type { FinancialAccount, Transaction } from '../types';

export function isProtectedCashAccount(account: Pick<FinancialAccount, 'id' | 'type'>) {
  return account.type === 'cash' || account.id === 'setup_cash' || account.id === 'acc_cash';
}

export function referencesAccount(transaction: Transaction, id: string) {
  return [transaction.accountId, transaction.toAccountId, transaction.balanceAccountId, transaction.toBalanceAccountId].includes(id);
}

export type BankLinkChoice = { mode: 'add' | 'already-included'; bankBalance: number };

export function canLinkIndependentMethod(account: Pick<FinancialAccount, 'linkedBankId'>) {
  return !account.linkedBankId;
}

export function isIndependentMethodLink(previous: FinancialAccount, next: FinancialAccount) {
  return canLinkIndependentMethod(previous) && Boolean(next.linkedBankId) &&
    next.currency === previous.currency && ['card', 'wallet'].includes(next.type);
}

export function bankBalanceAfterLink(independentBalance: number, bankBalance: number, choice?: BankLinkChoice) {
  if (!Number.isFinite(independentBalance) || independentBalance < 0 || !Number.isFinite(bankBalance)) {
    throw new Error('link-balance-unavailable');
  }
  if (choice && bankBalance !== choice.bankBalance) throw new Error('bank-balance-changed');
  if (independentBalance > 0 && !choice) throw new Error('link-balance-choice-required');
  if (choice?.mode !== 'add') return bankBalance;
  return bankBalance + independentBalance;
}
