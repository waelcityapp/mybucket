import { markDailyActiveAccount } from './siteVisits.js';
import { siteVisitDay } from '../src/utils/siteVisitDay.js';
import { FieldValue } from 'firebase-admin/firestore';
import { DEFAULT_PLAN_LIMITS } from '../src/config/planLimits.js';
import { grantFromAccess } from '../src/config/grantPolicy.js';
import { stageFor } from '../src/config/subscriptionPolicy.js';
import { INITIAL_CATEGORIES } from '../src/data/initialData.js';
import { SUPPORTED_CURRENCIES, type AccountType, type FinancialAccount, type Category } from '../src/types.js';
import { validateBalance } from '../src/utils/accountLinking.js';
import { getAdminFirestore } from './firebaseAdmin.js';
import { PUBLISHED_PLAN_LIMITS_PATH, publishedPlanLimits } from './planLimits.js';
import { getOrCreateSubscription, SubscriptionError } from './subscriptionService.js';
import { readTrialSettings } from './trialSettings.js';

const accountTypes = new Set<AccountType>(['cash', 'bank', 'card', 'savings', 'wallet', 'other', 'custom', 'credit']);
const validId = (value: unknown): value is string => typeof value === 'string' && /^[\w-]{1,128}$/.test(value);
const shortString = (value: unknown, length: number): value is string => typeof value === 'string' && value.length <= length;

function invalid(): never {
  throw new SubscriptionError(400, 'invalid_financial_record', 'Invalid account or category data.');
}

function parseRecord(value: unknown, group: 'accounts' | 'categories'): FinancialAccount | Category {
  if (!value || typeof value !== 'object') return invalid();
  const item = value as Record<string, unknown>;
  if (!validId(item.id) || !shortString(item.name, 40) || !shortString(item.nameAr, 40)) return invalid();
  const common = { id: item.id, name: item.name, nameAr: item.nameAr };
  if (group === 'categories') {
    if ((item.type !== 'expense' && item.type !== 'income') || !shortString(item.icon, 64) || !shortString(item.color, 64)) return invalid();
    return { ...common, type: item.type, icon: item.icon, color: item.color };
  }

  const type = item.type as AccountType;
  const currency = item.currency as FinancialAccount['currency'];
  if (!accountTypes.has(type) || !SUPPORTED_CURRENCIES.includes(currency) || typeof item.balance !== 'number' || !Number.isFinite(item.balance)) return invalid();
  const account: FinancialAccount = { ...common, type, currency, balance: item.balance };
  if (item.color !== undefined) {
    if (!shortString(item.color, 64)) return invalid();
    account.color = item.color;
  }
  if (item.creditLimit !== undefined) {
    if (typeof item.creditLimit !== 'number' || !Number.isFinite(item.creditLimit) || item.creditLimit < 0) return invalid();
    account.creditLimit = item.creditLimit;
  }
  if (item.linkedBankId !== undefined) {
    if (!validId(item.linkedBankId) || item.linkedBankId === account.id || !['card', 'wallet'].includes(type)) return invalid();
    account.linkedBankId = item.linkedBankId;
  }
  try { validateBalance(account, account.balance); } catch { return invalid(); }
  return account;
}

export async function saveFinancialCollection(uid: string, action: string, payload: Record<string, unknown>) {
  const group = action === 'financial.accounts.save' ? 'accounts' : 'categories';
  const initialize = action === 'financial.categories.initialize';
  const source = initialize ? INITIAL_CATEGORIES : payload.items;
  if (!Array.isArray(source) || source.length > 450) return invalid();
  const items = source.map(value => parseRecord(value, group));
  if (new Set(items.map(item => item.id)).size !== items.length) return invalid();
  if (!items.length) return { saved: 0 };

  const db = getAdminFirestore();
  const user = db.collection('users').doc(uid);
  const records = user.collection(group);
  const trials = await readTrialSettings();
  await getOrCreateSubscription(uid, trials, true);
  return db.runTransaction(async tx => {
    const [policy, subscription, access, existing] = await Promise.all([
      tx.get(db.doc(PUBLISHED_PLAN_LIMITS_PATH)),
      tx.get(user.collection('billing').doc('subscription')),
      tx.get(user.collection('billing').doc('access')),
      tx.get(records),
    ]);
    const billing = subscription.data();
    if (!billing || !access.exists) throw new SubscriptionError(503, 'access_record_missing', 'Unable to verify account access.');
    const stage = stageFor({
      trialStartedAt: billing.trialStartedAt,
      isPaid: billing.isPaid === true,
      paidPlan: billing.paidPlan,
      paidExpiresAt: billing.paidExpiresAt,
      grant: grantFromAccess(access.data() ?? null),
    }, Date.now(), trials);
    if (stage === 'expired') throw new SubscriptionError(403, 'subscription_expired', 'Financial writes require an active subscription.');
    const pro = stage === 'paid' || stage === 'pro-trial';
    const limits = publishedPlanLimits(policy) ?? DEFAULT_PLAN_LIMITS;
    const prior = new Map(existing.docs.map(record => [record.id, record.data()]));
    if (initialize && prior.size) return { saved: 0 };

    const counts = (record: { type?: unknown }) => group === 'accounts' || record.type === 'expense';
    let count = existing.docs.filter(record => record.get('archived') !== true && counts({ type: record.get('type') })).length;
    const max = group === 'accounts'
      ? (pro ? limits.proAccounts : limits.basicAccounts)
      : (pro ? limits.proCategories : limits.basicCategories);
    const writes = [];
    for (const item of items) {
      const stored = prior.get(item.id);
      if (group === 'accounts' && stored?.archived === true) return invalid();
      if (stored && group === 'categories' && stored.type !== item.type) return invalid();
      if (!stored && counts(item)) {
        if (initialize && count >= max) continue;
        if (count >= max || (group === 'categories' && !pro && !initialize)) {
          const code = group === 'accounts' ? 'plan_accounts_limit' : 'plan_categories_limit';
          throw new SubscriptionError(409, code, 'This change exceeds the plan allowance.');
        }
        count++;
      }

      if ('linkedBankId' in item && item.linkedBankId) {
        const bank = prior.get(item.linkedBankId);
        if (!bank || bank.archived === true || bank.type !== 'bank' || bank.currency !== item.currency || item.balance !== 0) return invalid();
      }
      writes.push(item);
    }
    if (group === 'accounts' && writes.some(item => !prior.has(item.id))) {
      markDailyActiveAccount(tx, uid, siteVisitDay(), db);
    }
    for (const item of writes) {
      const detachBank = group === 'accounts' && prior.get(item.id)?.linkedBankId && !('linkedBankId' in item);
      tx.set(records.doc(item.id), { ...item, userId: uid, ...(detachBank ? { linkedBankId: FieldValue.delete() } : {}) }, { merge: true });
    }
    return { saved: writes.length };
  });
}
