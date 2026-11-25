import { createHash } from 'node:crypto';
import { siteVisitDay } from '../src/utils/siteVisitDay.js';
import { getAdminFirestore } from './firebaseAdmin.js';
import { SubscriptionError } from './subscriptionService.js';

const activityReportingStart = '2026-11-25';
const browserIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

function dailyBrowsers(date: string, db: FirebaseFirestore.Firestore) {
  return db.collection('siteVisitDays').doc(date).collection('browsers');
}

export async function recordSiteVisit(
  origin: unknown, host: unknown, browserId: unknown, db?: FirebaseFirestore.Firestore, demoUsed = false,
) {
  const localHost = typeof host === 'string' && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host);
  if (typeof host !== 'string' || !origin || (origin !== `https://${host}` && !(localHost && origin === `http://${host}`))) {
    throw new SubscriptionError(403, 'invalid_origin', 'Invalid visit origin.');
  }
  if (typeof browserId !== 'string' || !browserIdPattern.test(browserId)) {
    throw new SubscriptionError(400, 'invalid_browser_id', 'Invalid visit browser ID.');
  }

  const date = siteVisitDay();
  const key = createHash('sha256').update(`${date}:${browserId}`).digest('hex');
  const browser = dailyBrowsers(date, db ?? getAdminFirestore()).doc(key);
  if (demoUsed) {
    await browser.set({ counted: true, demoUsed: true }, { merge: true });
    return { date };
  }
  try {
    await browser.create({ counted: true });
  } catch (error) {
    // Firestore already created this browser's record today, possibly in another tab.
    if ((error as { code?: number }).code !== 6) throw error;
  }
  return { date };
}

function expenseActivity(db: FirebaseFirestore.Firestore) {
  return db.collection('siteExpenseActivity');
}

function expenseAccount(uid: string, db: FirebaseFirestore.Firestore) {
  return expenseActivity(db).doc(createHash('sha256').update(uid).digest('hex'));
}

function dailyActiveAccount(uid: string, day: string, db: FirebaseFirestore.Firestore) {
  // Reuse existing daily markers so today's counted expense activity stays included.
  return db.collection('siteVisitDays').doc(day).collection('expenseAccounts').doc(expenseAccount(uid, db).id);
}

export function markDailyActiveAccount(
  tx: FirebaseFirestore.Transaction, uid: string, day: string, db: FirebaseFirestore.Firestore,
) {
  tx.set(dailyActiveAccount(uid, day, db), { saved: true });
}

export async function recordInteractiveActivity(uid: string, db = getAdminFirestore()) {
  const date = siteVisitDay();
  try {
    await dailyActiveAccount(uid, date, db).create({ saved: true });
  } catch (error) {
    if ((error as { code?: number }).code !== 6) throw error;
  }
  return { date };
}

export async function markFirstExpense(
  tx: FirebaseFirestore.Transaction, user: FirebaseFirestore.DocumentReference, day: string, db: FirebaseFirestore.Firestore,
) {
  const activity = expenseAccount(user.id, db);
  if (!(await tx.get(activity)).exists) {
    const pastExpenses = await tx.get(user.collection('transactions').where('type', '==', 'expense').select().limit(1));
    tx.create(activity, pastExpenses.empty ? { firstExpenseDay: day } : { legacy: true });
  }
}

export async function recordExpenseReturn(uid: string, db = getAdminFirestore(), now = new Date()) {
  const date = siteVisitDay(now);
  const ref = expenseAccount(uid, db);
  const activity = await ref.get();
  const firstDay = activity.get('firstExpenseDay');
  if (typeof firstDay === 'string' && firstDay < date && !activity.get('returnedFromDay')) {
    await ref.update({ returnedFromDay: firstDay });
    return { date, finished: true };
  }
  return { date, finished: Boolean(activity.get('returnedFromDay')) || activity.get('legacy') === true };
}

export async function readSiteVisits(date: unknown, db?: FirebaseFirestore.Firestore) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date > siteVisitDay()) {
    throw new SubscriptionError(400, 'invalid_visit_date', 'Invalid visit date.');
  }
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new SubscriptionError(400, 'invalid_visit_date', 'Invalid visit date.');
  }
  const firestore = db ?? getAdminFirestore();
  const browsers = dailyBrowsers(date, firestore);
  const firstExpenses = expenseActivity(firestore).where('firstExpenseDay', '==', date);
  const [visitors, demoUsers, started, returned, active] = await Promise.all([
    browsers.count().get(), browsers.where('demoUsed', '==', true).count().get(),
    firstExpenses.count().get(), expenseActivity(firestore).where('returnedFromDay', '==', date).count().get(),
    date >= activityReportingStart
      ? firestore.collection('siteVisitDays').doc(date).collection('expenseAccounts').count().get()
      : null,
  ]);
  return { date, visitors: visitors.data().count, demoUsers: demoUsers.data().count,
    activeAccounts: active?.data().count ?? null, activityReportingStart,
    firstExpenseAccounts: started.data().count, returningExpenseAccounts: returned.data().count };
}
