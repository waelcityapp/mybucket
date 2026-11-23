import { auth } from '../lib/firebase';
import { siteVisitDay } from '../utils/siteVisitDay';

const browserKey = 'mybucket.siteVisits.browser';
const countedDayKey = 'mybucket.siteVisits.day';

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
      let browserId = localStorage.getItem(browserKey);
      if (!browserId) {
        browserId = crypto.randomUUID();
        localStorage.setItem(browserKey, browserId);
      }
      const { date } = await request<{ date: string }>('siteVisits.record', { browserId });
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

export async function fetchSiteVisits(date: string) {
  const user = auth.currentUser;
  if (!user) throw new Error('authentication_required');
  return request<{ date: string; visitors: number }>('admin.siteVisits.get', { date }, await user.getIdToken());
}
