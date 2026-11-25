import { cairoDay, readSavedEntryCount } from './aiQuota.js';
import { randomUUID } from 'node:crypto';
import { DEFAULT_PLAN_LIMITS } from '../src/config/planLimits.js';
import { grantFromAccess } from '../src/config/grantPolicy.js';
import { stageFor } from '../src/config/subscriptionPolicy.js';
import { SUPPORTED_CURRENCIES, type FinancialAccount, type Transaction } from '../src/types.js';
import { bindMovement, movementDeltas, validateBalance } from '../src/utils/accountLinking.js';
import { getAdminFirestore } from './firebaseAdmin.js';
import { PUBLISHED_PLAN_LIMITS_PATH, publishedPlanLimits } from './planLimits.js';
import { isoDate } from './recurrence.js';
import { getOrCreateSubscription, SubscriptionError } from './subscriptionService.js';
import { markDailyActiveAccount, markFirstExpense } from './siteVisits.js';
import { readTrialSettings } from './trialSettings.js';

const validId = (value: unknown): value is string => typeof value === 'string' && /^[\w-]{1,128}$/.test(value);
const fail = (code: string, status = 400): never => { throw new SubscriptionError(status, code, code); };

export async function issueAiEntryTicket(uid: string, day: string) {
  const ticket = randomUUID();
  await getAdminFirestore().doc(`users/${uid}/entryTickets/${ticket}`).create({ day });
  return ticket;
}

function parseTransaction(payload: unknown): Transaction {
  if (!payload || typeof payload !== 'object') return fail('invalid_transaction');
  const item = payload as Transaction;
  if (!validId(item.id) || !validId(item.accountId) ||
      !['income', 'expense', 'transfer'].includes(item.type) ||
      !Number.isFinite(item.amount) || item.amount <= 0 ||
      !SUPPORTED_CURRENCIES.includes(item.currency) ||
      typeof item.date !== 'string' || !isoDate(item.date) ||
      typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt)) ||
      typeof item.description !== 'string' || item.description.length > 150 ||
      (item.type === 'transfer' && !validId(item.toAccountId)) ||
      (item.categoryId !== undefined && !validId(item.categoryId)) ||
      (item.time !== undefined && (typeof item.time !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(item.time))) ||
      (item.dateTime !== undefined && (typeof item.dateTime !== 'string' || !Number.isFinite(Date.parse(item.dateTime))))) {
    return fail('invalid_transaction');
  }
  const { id, type, amount, accountId, currency, date, description, createdAt, time, dateTime, categoryId, toAccountId } = item;
  return {
    id, type, amount, accountId, currency, date, description, createdAt,
    ...(time === undefined ? {} : { time }),
    ...(dateTime === undefined ? {} : { dateTime }),
    ...(type !== 'transfer' && categoryId !== undefined ? { categoryId } : {}),
    ...(type === 'transfer' ? { toAccountId } : {}),
  };
}

export async function saveFinancialTransaction(uid: string, payload: Record<string, unknown>) {
  const entry = parseTransaction(payload.transaction);
  const ticketId = payload.ticket;
  if (ticketId !== undefined && !validId(ticketId)) return fail('invalid_entry_ticket');
  const db = getAdminFirestore();
  const user = db.collection('users').doc(uid);
  const entryRef = user.collection('transactions').doc(entry.id);
  const trials = await readTrialSettings();
  await getOrCreateSubscription(uid, trials, true);

  return db.runTransaction(async tx => {
    const date = new Date();
    const day = cairoDay(date);
    const usageRef = user.collection('entryUsage').doc(day);
    const ticketRef = typeof ticketId === 'string' ? user.collection('entryTickets').doc(ticketId) : null;
    const [saved, policy, billing, access, usage, ticket] = await Promise.all([
      tx.get(entryRef), tx.get(db.doc(PUBLISHED_PLAN_LIMITS_PATH)), tx.get(user.collection('billing').doc('subscription')),
      tx.get(user.collection('billing').doc('access')), tx.get(usageRef), ticketRef ? tx.get(ticketRef) : Promise.resolve(null),
    ]);
    if (saved.exists) {
      if (Object.entries(entry).every(([key, value]) => saved.get(key) === value)) return { saved: true };
      return fail('duplicate-transaction', 409);
    }
    const subscription = billing.data();
    if (!subscription || !access.exists) return fail('access_record_missing', 503);
    const phase = stageFor({
      trialStartedAt: subscription.trialStartedAt, isPaid: subscription.isPaid === true,
      paidPlan: subscription.paidPlan, paidExpiresAt: subscription.paidExpiresAt,
      grant: grantFromAccess(access.data() ?? null),
    }, date.getTime(), trials);
    if (phase === 'expired') return fail('subscription_expired', 403);
    const pro = phase === 'paid' || phase === 'pro-trial';
    const limits = publishedPlanLimits(policy);
    const effectiveLimits = limits ?? DEFAULT_PLAN_LIMITS;
    const validTicket = ticket?.exists && ticket.get('day') === day;
    const aiEntry = pro && validTicket;
    if (pro && ticketRef && !validTicket) return fail('invalid_entry_ticket', 409);
    const bucket = !pro ? 'basic' : aiEntry ? 'proAi' : 'proAdditional';
    const cap = pro ? effectiveLimits.proEntries : effectiveLimits.basicEntries;
    const used = readSavedEntryCount(usage, bucket);
    const totalUsed = pro ? readSavedEntryCount(usage, 'pro') : used;
    if (limits && totalUsed >= cap) return fail('plan_entry_limit', 429);

    const accounts = user.collection('accounts');
    const cache = new Map<string, FinancialAccount>();
    async function load(id: string) {
      const cached = cache.get(id);
      if (cached) return cached;
      const snapshot = await tx.get(accounts.doc(id));
      if (!snapshot.exists) return fail('account-not-found', 409);
      const account = { ...snapshot.data(), id } as FinancialAccount;
      cache.set(id, account);
      return account;
    }
    for (const id of [entry.accountId, entry.toAccountId]) {
      if (!id) continue;
      const method = await load(id);
      if (method.linkedBankId) await load(method.linkedBankId);
    }

    const movement = checked(() => bindMovement([...cache.values()], entry));
    const updates = [...movementDeltas(movement)].map(([id, delta]) => {
      const account = cache.get(id)!;
      if (account.currency !== entry.currency) return fail('currency-mismatch', 409);
      const balance = account.balance + delta;
      checked(() => validateBalance(account, balance));
      return { id, balance };
    });
    const firstExpenseToday = entry.type === 'expense' && usage.get('expenseActivityRecorded') !== true;
    if (firstExpenseToday) await markFirstExpense(tx, user, day, db);
    const newActivity = usage.get('activityRecorded') !== true && usage.get('expenseActivityRecorded') !== true;
    if (newActivity) markDailyActiveAccount(tx, uid, day, db);
    for (const update of updates) tx.update(accounts.doc(update.id), { balance: update.balance });
    tx.create(entryRef, {
      ...entry, userId: uid, balanceAccountId: movement.balanceAccountId,
      ...(movement.toBalanceAccountId ? { toBalanceAccountId: movement.toBalanceAccountId } : {}),
    });
    tx.set(usageRef, { [bucket]: used + 1, ...(firstExpenseToday ? { expenseActivityRecorded: true } : {}), ...(newActivity ? { activityRecorded: true } : {}) }, { merge: true });
    if (validTicket && ticketRef) tx.delete(ticketRef);
    return { saved: true };
  });
}

function checked<T>(run: () => T): T {
  try {
    return run();
  } catch (error) {
    return fail(error instanceof Error ? error.message : 'invalid_transaction', 409);
  }
}
