/** Account linking calculations; all values are internal application records. */
export type AccountKind = 'cash' | 'bank' | 'card' | 'wallet' | 'other' | 'custom' | 'savings' | 'credit';
export interface LinkedAccount {
  id: string;
  type: AccountKind;
  currency: string;
  balance: number;
  linkedBankId?: string;
  creditLimit?: number;
}
export interface ResolvedAccount { method: LinkedAccount; account: LinkedAccount }
export type MovementType = 'expense' | 'income' | 'transfer';
export interface Movement {
  type: MovementType;
  amount: number;
  accountId: string;
  toAccountId?: string;
  balanceAccountId?: string;
  toBalanceAccountId?: string;
}

/** A linked payment method is a view of one bank balance, not another asset. */
export function resolveAccount(accounts: LinkedAccount[], id: string): ResolvedAccount {
  const method = accounts.find(account => account.id === id);
  if (!method) throw new Error('account-not-found');
  if (!method.linkedBankId) return { method, account: method };
  if (method.type !== 'card' && method.type !== 'wallet') throw new Error('invalid-link');
  const bank = accounts.find(account => account.id === method.linkedBankId);
  if (!bank || bank.type !== 'bank' || bank.linkedBankId || bank.currency !== method.currency) throw new Error('invalid-link');
  return { method, account: bank };
}

/** Resolve and freeze actual balance account identifiers when creating a movement. */
export function bindMovement(accounts: LinkedAccount[], movement: Movement): Movement {
  if (!['expense', 'income', 'transfer'].includes(movement.type) || !movement.accountId || !Number.isFinite(movement.amount) || movement.amount <= 0) throw new Error('invalid-amount');
  const from = resolveAccount(accounts, movement.accountId);
  const to = movement.type === 'transfer' && movement.toAccountId ? resolveAccount(accounts, movement.toAccountId) : null;
  if (movement.type === 'transfer' && !to) throw new Error('missing-destination');
  if (to && (from.account.id === to.account.id || from.account.currency !== to.account.currency)) throw new Error('invalid-transfer');
  return { ...movement, balanceAccountId: from.account.id, ...(to ? { toBalanceAccountId: to.account.id } : {}) };
}

/** Positive deltas add to an account, negative deltas subtract from it. */
export function movementDeltas(movement: Movement, factor = 1): Map<string, number> {
  if (!['expense', 'income', 'transfer'].includes(movement.type) || !movement.accountId || !Number.isFinite(movement.amount) || movement.amount <= 0) throw new Error('invalid-amount');
  const from = movement.balanceAccountId || movement.accountId;
  const deltas = new Map<string, number>([[from, factor * (movement.type === 'income' ? movement.amount : -movement.amount)]]);
  if (movement.type === 'transfer') {
    const to = movement.toBalanceAccountId || movement.toAccountId;
    if (!to || to === from) throw new Error('invalid-transfer');
    deltas.set(to, factor * movement.amount);
  }
  return deltas;
}

export function validateBalance(account: LinkedAccount, balance: number): void {
  if (!Number.isFinite(balance)) throw new Error('invalid-balance');
  if (account.type === 'credit') {
    if (!Number.isFinite(account.creditLimit) || account.creditLimit! <= 0) throw new Error('invalid-credit-limit');
    if (balance < -account.creditLimit!) throw new Error('credit-limit-exceeded');
    if (balance > 0) throw new Error('credit-overpayment');
  } else if (balance < 0) throw new Error('insufficient-balance');
}

export function totalCashByCurrency(accounts: LinkedAccount[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const account of accounts) {
    if (account.linkedBankId || account.type === 'credit') continue;
    if (!Number.isFinite(account.balance)) throw new Error('invalid-balance');
    result[account.currency] = (result[account.currency] || 0) + account.balance;
  }
  return result;
}
