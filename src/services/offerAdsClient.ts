import { auth } from '../lib/firebase';

export async function offerAdsRequest<T>(action: string, payload: Record<string, unknown> = {}, authenticated = false, signal?: AbortSignal): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authenticated) {
    signal?.throwIfAborted();
    const tokenRequest = auth.currentUser?.getIdToken();
    let token: string | undefined;
    if (signal && tokenRequest) {
      let stop: () => void = () => {};
      try {
        token = await Promise.race([tokenRequest, new Promise<never>((_, reject) => {
          stop = () => reject(signal.reason);
          signal.addEventListener('abort', stop, { once: true });
        })]);
      } finally {
        signal.removeEventListener('abort', stop);
      }
    } else {
      token = await tokenRequest;
    }
    if (!token) throw new Error('authentication_required');
    headers.Authorization = `Bearer ${token}`;
  }
  const response = await fetch('/api/gateway', {
    method: 'POST', headers, signal, body: JSON.stringify({ action, payload }),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error || 'ad_request_failed');
  return result.data as T;
}
