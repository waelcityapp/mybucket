import test from 'node:test';
import assert from 'node:assert/strict';
import { stageFor, addDays, getTrialDurations, setTrialDurations, PRO_TRIAL_DAYS, BASIC_FREE_DAYS, PRO_PRICE_EGP, PRO_MARKETER_PRICE_EGP, BASIC_PRICE_EGP } from '../src/config/subscriptionPolicy.ts';

const start = '2026-11-01T00:00:00.000Z';
const moment = (days) => Date.parse(start) + days * 86400000;
const trial = { trialStartedAt: start, isPaid: false, selectedPlan: 'pro' };

test('15-day Pro trial then Basic through day 75', () => {
  assert.equal(PRO_TRIAL_DAYS, 15);
  assert.equal(BASIC_FREE_DAYS, 75);
  assert.equal(stageFor(trial, moment(0)), 'pro-trial');
  assert.equal(stageFor(trial, moment(14)), 'pro-trial');
  assert.equal(stageFor({ ...trial, selectedPlan: 'basic' }, moment(14)), 'pro-trial', 'changing the selected plan does not change trial dates');
  assert.equal(stageFor(trial, moment(15)), 'basic-free');
  assert.equal(stageFor(trial, moment(59)), 'basic-free');
  assert.equal(stageFor(trial, moment(60)), 'basic-free');
  assert.equal(stageFor(trial, moment(74)), 'basic-free');
  assert.equal(stageFor(trial, moment(75)), 'expired');
});

test('introductory periods are independent of discount codes', () => {
  assert.equal(PRO_PRICE_EGP, 180);
  assert.equal(PRO_MARKETER_PRICE_EGP, 120);
  assert.equal(BASIC_PRICE_EGP, null);
  assert.equal(stageFor({ ...trial, affiliateCode: 'WAEL2026' }, moment(15)), 'basic-free');
  assert.equal(addDays(start, 75), '2027-01-15T00:00:00.000Z');
});

test('paid entitlement requires an unexpired paid term', () => {
  const paid = { ...trial, isPaid: true, paidExpiresAt: addDays(start, 90) };
  assert.equal(stageFor(paid, moment(80)), 'paid');
  assert.equal(stageFor(paid, moment(90)), 'expired');
});

test('global admin policy applies to past accounts without resetting their start date', () => {
  setTrialDurations({ proDays: 1, basicDays: 30 });
  assert.deepEqual(getTrialDurations(), { proDays: 1, basicDays: 30 });
  assert.equal(stageFor(trial, moment(2)), 'basic-free');
  assert.equal(stageFor(trial, moment(31)), 'expired');
  setTrialDurations({ proDays: PRO_TRIAL_DAYS, basicDays: BASIC_FREE_DAYS });
});
