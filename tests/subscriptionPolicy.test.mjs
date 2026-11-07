import test from 'node:test';
import assert from 'node:assert/strict';
import { stageFor, addDays, PRO_TRIAL_DAYS, BASIC_FREE_DAYS, PRO_PRICE_EGP, PRO_MARKETER_PRICE_EGP, BASIC_PRICE_EGP } from '../src/config/subscriptionPolicy.ts';

const start = '2026-11-01T00:00:00.000Z';
const moment = (days) => Date.parse(start) + days * 86400000;
const trial = { trialStartedAt: start, isPaid: false };

test('15-day Pro trial then Basic through day 60', () => {
  assert.equal(PRO_TRIAL_DAYS, 15);
  assert.equal(BASIC_FREE_DAYS, 60);
  assert.equal(stageFor(trial, moment(0)), 'pro-trial');
  assert.equal(stageFor(trial, moment(14)), 'pro-trial');
  assert.equal(stageFor(trial, moment(15)), 'basic-free');
  assert.equal(stageFor(trial, moment(59)), 'basic-free');
  assert.equal(stageFor(trial, moment(60)), 'expired');
});

test('introductory periods are independent of discount codes', () => {
  assert.equal(PRO_PRICE_EGP, 180);
  assert.equal(PRO_MARKETER_PRICE_EGP, 120);
  assert.equal(BASIC_PRICE_EGP, null);
  assert.equal(stageFor({ ...trial, affiliateCode: 'WAEL2026' }, moment(15)), 'basic-free');
  assert.equal(addDays(start, 60), '2026-12-31T00:00:00.000Z');
});

test('paid entitlement requires an unexpired paid term', () => {
  const paid = { ...trial, isPaid: true, paidExpiresAt: addDays(start, 90) };
  assert.equal(stageFor(paid, moment(80)), 'paid');
  assert.equal(stageFor(paid, moment(90)), 'expired');
});
