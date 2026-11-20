import test from 'node:test';
import assert from 'node:assert/strict';
import { stageFor, addDays, getTrialDurations, setTrialDurations, PRO_TRIAL_DAYS, BASIC_FREE_DAYS, PRO_PRICE_EGP, PRO_MARKETER_PRICE_EGP, BASIC_PRICE_EGP } from '../src/config/subscriptionPolicy.ts';

const start = '2026-11-01T00:00:00.000Z';
const moment = (days) => Date.parse(start) + days * 86400000;
const trial = { trialStartedAt: start, isPaid: false };

test('Basic applies from signup until the configured expiry', () => {
  assert.equal(PRO_TRIAL_DAYS, 15);
  assert.equal(BASIC_FREE_DAYS, 75);
  assert.equal(stageFor(trial, moment(0)), 'basic-free');
  assert.equal(stageFor(trial, moment(14)), 'basic-free');
  assert.equal(stageFor(trial, moment(15)), 'basic-free');
  assert.equal(stageFor(trial, moment(59)), 'basic-free');
  assert.equal(stageFor(trial, moment(60)), 'basic-free');
  assert.equal(stageFor(trial, moment(74)), 'basic-free');
  assert.equal(stageFor(trial, moment(75)), 'expired');
});

test('introductory periods are independent of discount codes', () => {
  assert.equal(PRO_PRICE_EGP, 180);
  assert.equal(PRO_MARKETER_PRICE_EGP, 120);
  assert.equal(BASIC_PRICE_EGP, 100);
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


test('only an active Pro grant gives a non-paying account Pro access', () => {
  const grant = { plan: 'pro', startsAt: addDays(start, 2), endsAt: addDays(start, 5) };
  assert.equal(stageFor({ ...trial, grant }, moment(1)), 'basic-free');
  assert.equal(stageFor({ ...trial, grant }, moment(2)), 'pro-trial');
  assert.equal(stageFor({ ...trial, grant }, moment(5)), 'basic-free');
});


test('a paid Basic account stays Basic and retains an active Pro grant', () => {
  const basic = { ...trial, isPaid: true, paidPlan: 'basic', paidExpiresAt: addDays(start, 90) };
  assert.equal(stageFor(basic, moment(80)), 'paid-basic');
  const grant = { plan: 'pro', startsAt: addDays(start, 80), endsAt: addDays(start, 85) };
  assert.equal(stageFor({ ...basic, grant }, moment(81)), 'pro-trial');
  assert.equal(stageFor({ ...basic, grant }, moment(85)), 'paid-basic');
});

test('a paid membership displays its actual remaining term independent of the trial', async () => {
  const { calculateRemainingPaidDays, calculateRemainingTrialDays } = await import('../src/utils/subscriptionUtils.ts');
  const sub = { isPaid: true, trialExpiresAt: addDays(start, 75), paidExpiresAt: addDays(start, 40) };
  assert.equal(calculateRemainingPaidDays(sub, moment(11)), 29);
  assert.equal(calculateRemainingTrialDays(sub, moment(11)), 64);
  assert.equal(calculateRemainingPaidDays(sub, moment(40)), 0);
  assert.equal(calculateRemainingPaidDays({ ...sub, paidExpiresAt: 'invalid' }, moment(11)), 0);
});
