import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { compareMonths, MonthComparison } from '../src/components/MonthComparison.tsx';

test('compares the same days and calculates the largest expense increase per currency', () => {
  const transactions = [
    { date: '2026-10-01', type: 'expense', categoryId: 'rent', amount: 800, currency: 'EGP' },
    { date: '2026-11-01', type: 'expense', categoryId: 'rent', amount: 810, currency: 'EGP' },
    { date: '2026-10-15', type: 'expense', categoryId: 'food', amount: 50, currency: 'EGP' },
    { date: '2026-11-15', type: 'expense', categoryId: 'food', amount: 100, currency: 'EGP' },
    { date: '2026-10-15', type: 'income', amount: 200, currency: 'EGP' },
    { date: '2026-11-15', type: 'income', amount: 280, currency: 'EGP' },
    { date: '2026-10-16', type: 'expense', categoryId: 'food', amount: 500, currency: 'EGP' },
    { date: '2026-11-16', type: 'expense', categoryId: 'food', amount: 900, currency: 'EGP' },
    { date: '2026-11-15', type: 'transfer', amount: 300, currency: 'EGP' },
    { date: '2026-11-10', type: 'expense', categoryId: 'food', amount: 6, currency: 'USD' },
  ];
  const { dates, currencies } = compareMonths(transactions, '2026-11-15', '2026-09-01');
  assert.deepEqual(dates, {
    current: { start: '2026-11-01', end: '2026-11-15' },
    previous: { start: '2026-10-01', end: '2026-10-15' },
  });
  assert.deepEqual(currencies.get('EGP'), {
    current: { income: 280, expense: 910 },
    previous: { income: 200, expense: 850 },
    biggestIncrease: { categoryId: 'food', amount: 50 },
  });
  assert.deepEqual(currencies.get('USD'), {
    current: { income: 0, expense: 6 },
    previous: { income: 0, expense: 0 },
    biggestIncrease: { categoryId: 'food', amount: 6 },
  });
});

test('bounds both windows by available history and the shorter month', () => {
  const result = compareMonths([], '2024-03-31', '2024-02-12');
  assert.deepEqual(result.dates, {
    current: { start: '2024-03-12', end: '2024-03-29' },
    previous: { start: '2024-02-12', end: '2024-02-29' },
  });
  assert.equal(compareMonths([], '2026-03-06', '2026-02-12'), null);
  assert.equal(compareMonths([], '2026-01-03', '2025-12-01').dates.previous.end, '2025-12-03');
});

test('the comparison starts collapsed in both languages', () => {
  for (const [lang, label] of [['ar', 'مقارنة هذا الشهر بالشهر السابق'], ['en', 'Compare with last month']]) {
    const markup = renderToStaticMarkup(createElement(MonthComparison, {
      lang, today: '2026-11-15', historyStart: '2026-10-01',
      loadState: 'ready', categories: [], transactions: [],
    }));
    assert.ok(markup.includes(label));
    assert.match(markup, /aria-expanded="false"/);
    assert.doesNotMatch(markup, /<table/);
  }
});
