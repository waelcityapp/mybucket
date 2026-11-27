import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ExpenseBreakdown, groupExpensesByCurrency } from '../src/components/ExpenseBreakdown.tsx';

test('reports rank expenses per currency and keep the transactions behind each bar', () => {
  const expenses = [
    { id: 'food-1', type: 'expense', currency: 'EGP', categoryId: 'food', amount: 40 },
    { id: 'food-2', type: 'expense', currency: 'EGP', categoryId: 'food', amount: 60 },
    { id: 'transport', type: 'expense', currency: 'EGP', categoryId: 'transport', amount: 20 },
    { id: 'no-category', type: 'expense', currency: 'EGP', amount: 10 },
    { id: 'usd', type: 'expense', currency: 'USD', categoryId: 'food', amount: 500 },
    { id: 'zero', type: 'expense', currency: 'EGP', categoryId: 'other', amount: 0 },
    { id: 'income', type: 'income', currency: 'EGP', categoryId: 'food', amount: 500 },
    { id: 'transfer', type: 'transfer', currency: 'EGP', categoryId: 'transport', amount: 100 },
  ];
  const totals = groupExpensesByCurrency(expenses);
  assert.deepEqual(totals.get('EGP').map(group => [group.categoryId, group.amount]), [
    ['food', 100], ['transport', 20], [undefined, 10],
  ]);
  assert.deepEqual(totals.get('EGP')[0].transactions.map(tx => tx.id), ['food-1', 'food-2']);
  assert.deepEqual(totals.get('USD').map(group => group.amount), [500]);
  assert.equal(groupExpensesByCurrency(expenses.filter(tx => tx.id === 'zero')).size, 0);
});

test('category analysis starts closed in Arabic and English', () => {
  for (const [lang, label] of [['ar', 'تحليل المصروفات حسب البند'], ['en', 'Spending by category']]) {
    const markup = renderToStaticMarkup(createElement(ExpenseBreakdown, {
      lang,
      categories: [],
      transactions: [{ id: 'expense', type: 'expense', currency: 'EGP', amount: 100 }],
    }));
    assert.ok(markup.includes(label));
    assert.match(markup, /aria-expanded="false"/);
    assert.doesNotMatch(markup, /100 EGP|Highest spending|الأعلى صرفًا/);
  }
});
