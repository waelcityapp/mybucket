import type { ActiveTab } from '../types';

const historyTabs: ActiveTab[] = ['home', 'transactions', 'search', 'accounts', 'categories', 'settings', 'admin'];

export function tabFromHistory(location: Location, state: unknown): ActiveTab {
  const path = location.pathname;
  if (path === '/trial') return 'trial-details';
  if (path === '/subscription') return 'subscription';
  if (path === '/accounts' || path === '/accounts/new') return 'accounts';
  if (path === '/guide') return 'guide';
  if (path === '/offers' || path.startsWith('/offers/category/')) return 'offers';
  const tab = state && typeof state === 'object' && 'myBucketTab' in state ? (state as { myBucketTab: unknown }).myBucketTab : undefined;
  return typeof tab === 'string' && historyTabs.includes(tab as ActiveTab) ? tab as ActiveTab : 'home';
}

export function recordTabNavigation(history: History, location: Location, current: ActiveTab, next: ActiveTab): boolean {
  if (next === current && location.pathname === '/') return false;
  history.pushState({ myBucketTab: next }, '', '/');
  return true;
}
