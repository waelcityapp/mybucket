import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { summarizeWeeklySpending, WeeklySpendingTrend } from '../src/components/WeeklySpendingTrend.tsx';

test('sums weekly expenses per currency, leaving quiet weeks at zero and excluding future days', () => {
  const transactions = [
    { date: '2026-11-07', currency: 'EGP', amount: 75, type: 'expense' },
    { date: '2026-11-08', currency: 'EGP', amount: 25, type: 'expense' },
    { date: '2026-11-08', currency: 'USD', amount: 5, type: 'expense' },
    { date: '2026-11-27', currency: 'EGP', amount: 30, type: 'expense' },
    { date: '2026-11-28', currency: 'EGP', amount: 999, type: 'expense' },
    { date: '2026-10-08', currency: 'EGP', amount: 999, type: 'expense' },
    { date: '2026-11-08', currency: 'EGP', amount: 999, type: 'income' },
    { date: '2026-11-08', currency: 'EGP', amount: 999, type: 'transfer' },
  ];
  const { weeks, currencies } = summarizeWeeklySpending(transactions, 2026, 11, '2026-11-27', '2026-10-01');
  assert.deepEqual(weeks.map(week => [week.start, week.end, week.throughToday]), [
    [1, 7, false], [8, 14, false], [15, 21, false], [22, 27, true],
  ]);
  assert.deepEqual(currencies.get('EGP'), [75, 25, 0, 30]);
  assert.deepEqual(currencies.get('USD'), [0, 5, 0, 0]);
});

test('clips partial history and ends historical months on their actual last day', () => {
  const expenses = [
    { date: '2024-02-12', currency: 'EGP', amount: 999, type: 'expense' },
    { createdAt: '2024-02-29T13:20:00Z', currency: 'EGP', amount: 15, type: 'expense' },
  ];
  const { weeks, currencies } = summarizeWeeklySpending(expenses, 2024, 2, '2024-03-01', '2024-02-13');
  assert.deepEqual(weeks.map(week => [week.start, week.end, week.throughToday]), [
    [13, 14, false], [15, 21, false], [22, 28, false], [29, 29, false],
  ]);
  assert.deepEqual(currencies.get('EGP'), [0, 0, 0, 15]);
});

test('labels the current week through today even on its final day', () => {
  const { weeks } = summarizeWeeklySpending([], 2026, 11, '2026-11-28', '2026-10-01');
  assert.deepEqual(weeks.at(-1), { number: 4, start: 22, end: 28, throughToday: true });
  assert.equal(weeks[2].throughToday, false);
});

test('renders a collapsed trend control in both languages before doing any chart work', () => {
  for (const [lang, label] of [['ar', 'اتجاه المصروفات'], ['en', 'Weekly spending trend']]) {
    const markup = renderToStaticMarkup(createElement(WeeklySpendingTrend, {
      lang, year: 2026, month: 11, today: '2026-11-27', historyStart: '2026-10-01',
      loadState: 'ready', transactions: [],
    }));
    assert.ok(markup.includes(label));
    assert.match(markup, /aria-expanded="false"/);
    assert.doesNotMatch(markup, /No expenses|لا توجد عمليات صرف/);
  }
});
