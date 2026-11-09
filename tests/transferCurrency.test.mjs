import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bindMovement } from '../src/utils/accountLinking.ts';

test('transfers require distinct balance accounts with the same currency', () => {
  const accounts = [
    { id: 'egp', type: 'cash', currency: 'EGP', balance: 100 },
    { id: 'egpBank', type: 'bank', currency: 'EGP', balance: 20 },
    { id: 'usd', type: 'bank', currency: 'USD', balance: 20 },
    { id: 'card', type: 'card', currency: 'EGP', balance: 0, linkedBankId: 'egpBank' },
  ];
  const transfer = { type: 'transfer', amount: 10, accountId: 'egp' };
  assert.equal(bindMovement(accounts, { ...transfer, toAccountId: 'egpBank' }).toBalanceAccountId, 'egpBank');
  assert.throws(() => bindMovement(accounts, { ...transfer, toAccountId: 'usd' }), /currency-mismatch/);
  assert.throws(() => bindMovement(accounts, { ...transfer, accountId: 'egpBank', toAccountId: 'card' }), /invalid-transfer/);
});
