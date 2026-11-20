import test from 'node:test';
import assert from 'node:assert/strict';
import { selectTransactionsForDeletion } from '../src/utils/transactionDeletion.ts';
import { movementDeltas } from '../src/utils/accountLinking.ts';

test('transaction filters include both date boundaries and preserve other types', () => {
  const items = [
    { id: 'a', type: 'income', date: '2026-11-01' },
    { id: 'b', type: 'expense', date: '2026-11-05' },
    { id: 'c', type: 'income', date: '2026-11-30' },
    { id: 'd', type: 'transfer', date: '2026-12-01' },
  ];
  assert.deepEqual(selectTransactionsForDeletion(items, 'income', '2026-11-01', '2026-11-30').map(x => x.id), ['a', 'c']);
  assert.deepEqual(selectTransactionsForDeletion(items, 'all', '', '').map(x => x.id), ['a', 'b', 'c', 'd']);
  assert.deepEqual(selectTransactionsForDeletion(items, 'transfer', '', '2026-11-30'), []);
});

test('reversing a transfer adjusts both captured balance accounts', () => {
  const movement = { type: 'transfer', amount: 75, accountId: 'card', balanceAccountId: 'bank', toAccountId: 'wallet', toBalanceAccountId: 'savings' };
  assert.deepEqual([...movementDeltas(movement, -1)], [['bank', 75], ['savings', -75]]);
});
