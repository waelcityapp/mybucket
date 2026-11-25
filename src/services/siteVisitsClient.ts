import { auth } from '../lib/firebase';
import { siteVisitDay } from '../utils/siteVisitDay';

const browserKey = 'mybucket.siteVisits.browser';
const countedDayKey = 'mybucket.siteVisits.day';
const demoDayKey = 'mybucket.siteVisits.demoDay';

function getBrowserId() {
  const existing = localStorage.getItem(browserKey);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(browserKey, id);
  return id;
}

async function request<T>(action: string, payload: object, token?: string): Promise<T> {
  const response = await fetch('/api/gateway', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ action, payload }),
  });
  if (!response.ok) throw new Error('site_visit_request_failed');
  const result = await response.json();
  if (!result.ok) throw new Error('site_visit_request_failed');
  return result.data;
}

export function startSiteVisitTracking() {
  let pending = false;

  async function recordVisibleVisit() {
    if (pending || document.visibilityState !== 'visible' || !navigator.onLine) return;
    pending = true;
    try {
      if (localStorage.getItem(countedDayKey) === siteVisitDay()) return;
      const { date } = await request<{ date: string }>('siteVisits.record', { browserId: getBrowserId() });
      localStorage.setItem(countedDayKey, date);
    } catch {
      // Tracking is best effort. Retry when the page is shown or reconnects.
    } finally {
      pending = false;
    }
  }

  document.addEventListener('visibilitychange', recordVisibleVisit);
  window.addEventListener('pageshow', recordVisibleVisit);
  window.addEventListener('online', recordVisibleVisit);
  void recordVisibleVisit();
}

let demoPending = false;

export async function recordDemoTransaction() {
  if (demoPending) return;
  demoPending = true;
  try {
    if (localStorage.getItem(demoDayKey) === siteVisitDay()) return;
    const { date } = await request<{ date: string }>('siteVisits.record', { browserId: getBrowserId(), demoUsed: true });
    localStorage.setItem(demoDayKey, date);
    localStorage.setItem(countedDayKey, date);
  } catch {
    // A later demo save can retry; analytics does not block the trial.
  } finally {
    demoPending = false;
  }
}

export function startExpenseReturnTracking(uid: string) {
  const key = `mybucket.siteVisits.expenseReturn.${uid}`;
  let pending = false;
  let stopped = false;
  async function trackVisibleReturn() {
    const user = auth.currentUser;
    if (stopped || pending || user?.uid !== uid || document.visibilityState !== 'visible' || !navigator.onLine) return;
    pending = true;
    try {
      const previous = localStorage.getItem(key);
      if (previous === 'finished' || previous === siteVisitDay()) return;
      const token = await user.getIdToken();
      if (stopped || auth.currentUser?.uid !== uid) return;
      const { date, finished } = await request<{ date: string; finished: boolean }>('siteVisits.return', {}, token);
      localStorage.setItem(key, finished ? 'finished' : date);
    } catch {
      // Retry on a future visible session without affecting the app.
    } finally {
      pending = false;
    }
  }
  document.addEventListener('visibilitychange', trackVisibleReturn);
  window.addEventListener('pageshow', trackVisibleReturn);
  window.addEventListener('online', trackVisibleReturn);
  void trackVisibleReturn();
  return () => {
    stopped = true;
    document.removeEventListener('visibilitychange', trackVisibleReturn);
    window.removeEventListener('pageshow', trackVisibleReturn);
    window.removeEventListener('online', trackVisibleReturn);
  };
}

export type SiteVisits = {
  date: string;
  visitors: number;
  demoUsers: number;
  dailyExpenseAccounts: number | null;
  expenseReportingStart: string;
  firstExpenseAccounts: number;
  returningExpenseAccounts: number;
};

export async function fetchSiteVisits(date: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('authentication_required');
  return request<SiteVisits>('admin.siteVisits.get', { date }, await user.getIdToken());
}
