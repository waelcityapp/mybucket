import type { ActiveTab } from '../types';

const historyTabs: ActiveTab[] = ['home', 'transactions', 'search', 'accounts', 'categories', 'settings', 'admin', 'guide', 'currency-converter'];

export function tabFromHistory(location: Location, state: unknown): ActiveTab {
  const path = location.pathname;
  if (path === '/admin' || path.startsWith('/admin/')) return path === '/admin/unlock' ? 'admin-pin' : 'admin';
  if (path === '/trial') return 'trial-details';
  if (path === '/subscription' || path === '/try/subscription') return 'subscription';
  if (path.startsWith('/reminders/')) return 'reminders';
  if (path === '/accounts' || path === '/accounts/new' || /^\/accounts\/[^/]+\/edit$/.test(path)) return 'accounts';
  if (path === '/categories' || path.startsWith('/categories/')) return 'categories';
  if (path === '/guide') return 'guide';
  if (path === '/currency-converter') return 'currency-converter';
  if (path === '/settings/ads' || path === '/settings/favorites' || path === '/settings/delete-transactions') return 'settings';
  if (path === '/offers' || path.startsWith('/offers/category/') || path.startsWith('/offers/ad/') || path === '/offers/new' || path === '/offers/new/payment' || path === '/offers/new/featured' || path === '/offers/new/pricing') return 'offers';
  const tab = state && typeof state === 'object' && 'myBucketTab' in state ? (state as { myBucketTab: unknown }).myBucketTab : undefined;
  return typeof tab === 'string' && historyTabs.includes(tab as ActiveTab) ? tab as ActiveTab : 'home';
}

export function recordTabNavigation(history: History, location: Location, current: ActiveTab, next: ActiveTab): boolean {
  const path = next === 'currency-converter' ? '/currency-converter' : '/';
  if (next === current && location.pathname === path) return false;
  history.pushState({ myBucketTab: next }, '', path);
  return true;
}

/** Keep native link behavior for new tabs, keyboard modifiers and already-handled events. */
export function followInternalLink(event: {
  button: number; defaultPrevented: boolean; metaKey: boolean; ctrlKey: boolean; shiftKey: boolean; altKey: boolean;
  currentTarget: { pathname: string; search: string };
  preventDefault: () => void;
}, navigate: (path: string) => void) {
  if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  navigate(event.currentTarget.pathname + event.currentTarget.search);
}
