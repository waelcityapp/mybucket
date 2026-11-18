import { auth } from '../lib/firebase';

export async function offerAdsRequest<T>(action: string, payload: Record<string, unknown> = {}, authenticated = false): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authenticated) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('authentication_required');
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch('/api/gateway', {
    method: 'POST', headers, body: JSON.stringify({ action, payload }),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error || 'ad_request_failed');
  return result.data as T;
}
