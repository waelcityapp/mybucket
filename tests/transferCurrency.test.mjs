import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bindMovement, movementDeltas, totalCashByCurrency } from '../src/utils/accountLinking.ts';
import { bankBalanceAfterLink, isIndependentMethodLink } from '../src/utils/accountDetails.ts';

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

test('linking a payment method changes new bookings while retaining historical transfer targets', () => {
  const accounts = [
    { id: 'wallet', type: 'wallet', currency: 'EGP', balance: 0, linkedBankId: 'bank' },
    { id: 'bank', type: 'bank', currency: 'EGP', balance: 100 },
  ];
  const history = { type: 'transfer', amount: 10, accountId: 'bank', toAccountId: 'wallet' };
  assert.throws(() => bindMovement(accounts, history), /invalid-transfer/);
  assert.equal(bindMovement(accounts, { ...history, description: 'Edited' }, history).toBalanceAccountId, 'wallet');
  assert.equal(bindMovement(accounts, history, { ...history, balanceAccountId: 'bank', toBalanceAccountId: 'wallet' }).toBalanceAccountId, 'wallet');
  assert.equal(bindMovement(accounts, { type: 'expense', amount: 10, accountId: 'wallet' }).balanceAccountId, 'bank');
});

test('the history exception is limited to first links with the same currency', () => {
  const previous = { id: 'method', type: 'other', currency: 'EGP', balance: 0 };
  const linked = { ...previous, type: 'wallet', linkedBankId: 'bank' };
  assert.equal(isIndependentMethodLink(previous, linked), true);
  assert.equal(isIndependentMethodLink({ ...previous, type: 'wallet' }, linked), true);
  assert.equal(isIndependentMethodLink(previous, { ...linked, currency: 'USD' }), false);
  assert.equal(isIndependentMethodLink(linked, { ...linked, linkedBankId: 'another' }), false);
});

test('linking a nonempty account requires an explicit balance decision using the reviewed bank balance', () => {
  assert.equal(bankBalanceAfterLink(200, 1000, { mode: 'add', bankBalance: 1000 }), 1200);
  assert.equal(bankBalanceAfterLink(200, 1000, { mode: 'already-included', bankBalance: 1000 }), 1000);
  assert.equal(bankBalanceAfterLink(0, 1000), 1000);
  assert.throws(() => bankBalanceAfterLink(200, 1000), /link-balance-choice-required/);
  assert.throws(() => bankBalanceAfterLink(200, 1100, { mode: 'add', bankBalance: 1000 }), /bank-balance-changed/);
  assert.throws(() => bankBalanceAfterLink(-200, 1000, { mode: 'add', bankBalance: 1000 }), /link-balance-unavailable/);
  const cash = { id: 'cash', type: 'cash', currency: 'EGP', balance: 200 };
  assert.equal(isIndependentMethodLink(cash, { ...cash, type: 'wallet', linkedBankId: 'bank' }), true);
});

test('archived accounts retain historical balance targets and are excluded from new bookings and totals', () => {
  const cash = { id: 'cash', type: 'cash', currency: 'EGP', balance: 100 };
  const old = { id: 'old', type: 'wallet', currency: 'EGP', balance: 200, archived: true };
  const accounts = [cash, old];
  const expense = { type: 'expense', amount: 10, accountId: 'old' };
  assert.deepEqual(totalCashByCurrency(accounts), { EGP: 100 });
  assert.throws(() => bindMovement(accounts, expense), /account-not-found/);
  assert.equal(bindMovement(accounts, expense, expense).balanceAccountId, 'old');
  assert.deepEqual([...movementDeltas(expense, -1)], [['old', 10]]);
});
