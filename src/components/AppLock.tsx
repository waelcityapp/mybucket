import { useState } from 'react';
import { auth } from '../lib/firebase';

export type LockStatus = { enabled: boolean; hasPin?: boolean; inactivityMinutes: number };
export async function lockRequest(action: string, payload: Record<string, unknown> = {}): Promise<any> {
  const user = auth.currentUser;
  if (!user) throw new Error('login_required');
  const response = await fetch('/api/gateway', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await user.getIdToken() },
    body: JSON.stringify({ action: 'appLock.' + action, payload }),
  });
  const json = await response.json();
  if (!response.ok || !json.ok) throw new Error(json.error || 'request_failed');
  return json.data;
}
export function LockScreen({ onUnlock, lang }: { onUnlock: () => void; lang: 'ar' | 'en' }) {
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ar = lang === 'ar';
  async function submit() {
    setBusy(true); setError('');
    try { await lockRequest('verify', { pin }); setPin(''); onUnlock(); }
    catch (e) { setError(e instanceof Error && e.message === 'pin_temporarily_blocked' ? (ar ? 'انتظر 5 دقائق قبل المحاولة' : 'Wait 5 minutes') : (ar ? 'الرقم السري غير صحيح أو تعذر الاتصال' : 'Incorrect PIN or connection error')); setPin(''); }
    finally { setBusy(false); }
  }
  return <main dir={ar ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 flex items-center justify-center p-5">
    <section className="bg-white border border-slate-200 rounded-3xl shadow-lg w-full max-w-sm p-7 text-center space-y-5">
      <div className="text-4xl">🔒</div>
      <h1 className="text-xl font-extrabold text-slate-900">{ar ? 'قفل My Bucket' : 'My Bucket Lock'}</h1>
      <p className="text-sm text-slate-500">{ar ? 'أدخل الرقم السري المكون من 6 أرقام' : 'Enter your six-digit PIN'}</p>
      <input autoFocus inputMode="numeric" type="password" autoComplete="off" maxLength={6} value={pin} onChange={e => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0,6))} onKeyDown={e => { if (e.key === 'Enter' && pin.length === 6) void submit(); }} className="w-full text-center tracking-[0.5em] text-2xl border rounded-xl p-3" aria-label="PIN" />
      {error && <p role="alert" className="text-red-600 text-xs">{error}</p>}
      <button disabled={busy || pin.length !== 6} onClick={() => void submit()} className="w-full bg-emerald-600 text-white rounded-xl py-3 font-bold disabled:opacity-50">{ar ? 'فتح التطبيق' : 'Unlock'}</button>
      <p className="text-xs text-slate-400">{ar ? 'نسيت الرقم السري غير متاحة أثناء التجربة' : 'PIN recovery is not available during this test'}</p>
    </section>
  </main>;
}
