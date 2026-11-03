import assert from 'node:assert/strict';
import { test } from 'node:test';
import { interpretLocalFinancialRequest } from './localFinancialInterpreter';
import type { AIInterpretationRequest } from './types';

const accounts = [
  { id: 'cash', name: 'Cash', nameAr: 'كاش', type: 'cash', currency: 'EGP' },
  { id: 'bank', name: 'Bank', nameAr: 'حساب البنك', type: 'bank', currency: 'EGP' },
  { id: 'wallet', name: 'Wallet', nameAr: 'محفظة إلكترونية', type: 'wallet', currency: 'EGP' },
];
const request = (text: string): AIInterpretationRequest => ({
  text, accounts, categories: [],
  currentDateTime: '2026-11-03T12:00:00',
  userTimezone: 'Africa/Cairo', lang: 'ar',
});

test('incoming InstaPay payment from an outside person is not an internal transfer', () => {
  const result = interpretLocalFinancialRequest(request('انا تحويلي 500 جنيه اشتراك رحلة السخنة على الانستاباي من محمد'));
  assert.equal(result.intent, 'CREATE_TRANSACTION');
  assert.equal(result.transaction?.type, 'income');
  assert.equal(result.transaction?.amount, 500);
  assert.equal(result.transaction?.accountId, null);
  assert.equal(result.transaction?.toAccountId, null);
  assert.ok(result.transaction?.missingFields.includes('accountId'));
});

test('explicit bank account is respected even with InstaPay mentioned', () => {
  const result = interpretLocalFinancialRequest(request('تحويل 500 جنيه من محمد على حساب البنك عن طريق انستاباي'));
  assert.equal(result.transaction?.type, 'income');
  assert.equal(result.transaction?.accountId, 'bank');
});

test('transfer between own accounts stays transfer', () => {
  const result = interpretLocalFinancialRequest(request('حولت 500 جنيه من الكاش للبنك'));
  assert.equal(result.transaction?.type, 'transfer');
});

test('outgoing transfer to a person must not become income', () => {
  const result = interpretLocalFinancialRequest(request('حولت 500 جنيه لمحمد على انستاباي'));
  assert.notEqual(result.transaction?.type, 'income');
});

test('Egyptian phrase محمد بعت لي is money received, not an expense', () => {
  const result = interpretLocalFinancialRequest(request('محمد بعت لي 200 جنيه اشتراك رحلة السخنة'));
  assert.equal(result.intent, 'CREATE_TRANSACTION');
  assert.equal(result.transaction?.type, 'income');
  assert.equal(result.transaction?.amount, 200);
  assert.equal(result.transaction?.accountId, null);
  assert.ok(result.transaction?.missingFields.includes('accountId'));
});

test('joined Egyptian phrase محمد بعتلي is also income', () => {
  const result = interpretLocalFinancialRequest(request('محمد بعتلي 200 جنيه على انستاباي'));
  assert.equal(result.transaction?.type, 'income');
  assert.equal(result.transaction?.amount, 200);
});

test('outgoing sent-to-Mohamed must not become income', () => {
  const result = interpretLocalFinancialRequest(request('أنا بعت 200 جنيه لمحمد'));
  assert.notEqual(result.transaction?.type, 'income');
});
