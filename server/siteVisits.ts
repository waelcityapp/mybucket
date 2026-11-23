import { createHash } from 'node:crypto';
import { siteVisitDay } from '../src/utils/siteVisitDay.js';
import { getAdminFirestore } from './firebaseAdmin.js';
import { SubscriptionError } from './subscriptionService.js';

const browserIdPattern = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;

function dailyBrowsers(date: string, db: FirebaseFirestore.Firestore) {
  return db.collection('siteVisitDays').doc(date).collection('browsers');
}

export async function recordSiteVisit(
  origin: unknown, host: unknown, browserId: unknown, db?: FirebaseFirestore.Firestore,
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
  try {
    await dailyBrowsers(date, db ?? getAdminFirestore()).doc(key).create({ counted: true });
  } catch (error) {
    // Firestore already created this browser's record today, possibly in another tab.
    if ((error as { code?: number }).code !== 6) throw error;
  }
  return { date };
}

export async function readSiteVisits(date: unknown, db?: FirebaseFirestore.Firestore) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date > siteVisitDay()) {
    throw new SubscriptionError(400, 'invalid_visit_date', 'Invalid visit date.');
  }
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw new SubscriptionError(400, 'invalid_visit_date', 'Invalid visit date.');
  }
  const snapshot = await dailyBrowsers(date, db ?? getAdminFirestore()).count().get();
  return { date, visitors: snapshot.data().count };
}
