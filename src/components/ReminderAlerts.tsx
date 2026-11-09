import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, BellRing, X } from 'lucide-react';
import { auth } from '../lib/firebase';
import type { Language } from '../types';
import { cairoClock, shouldShowReminderBanner, visibleReminderAlerts, type DismissedAlerts, type ReminderAlert } from '../utils/reminderAlertPolicy';

async function request(action: string, payload: Record<string, unknown> = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('login_required');
  const res = await fetch('/api/gateway', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await user.getIdToken() }, body: JSON.stringify({ action: 'reminders.' + action, payload }) });
  const json = await res.json();
  if (!res.ok || !json.ok) throw new Error('request_failed');
  return json.data;
}
function readDismissed(uid: string): DismissedAlerts | null {
  try { const value = JSON.parse(localStorage.getItem(`mybucket_alert_dismissed_${uid}`) || 'null'); return value && typeof value.day === 'string' && Array.isArray(value.ids) ? value : null; } catch { return null; }
}

export function ReminderAlerts({ uid, lang, page, onOpen, onBack }: { uid: string; lang: Language; page?: boolean; onOpen?: () => void; onBack?: () => void }) {
  const ar = lang === 'ar';
  const [items, setItems] = useState<ReminderAlert[]>([]);
  const [dismissed, setDismissed] = useState<DismissedAlerts | null>(() => readDismissed(uid));
  const [now, setNow] = useState(() => new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setItems([]); setDismissed(readDismissed(uid)); }, [uid]);
  const reload = useCallback(async () => {
    try {
      const result = await request('list');
      if (auth.currentUser?.uid === uid) { setItems(Array.isArray(result?.reminders) ? result.reminders : []); setError(false); }
    } catch { if (auth.currentUser?.uid === uid) setError(true); }
    finally { setLoading(false); }
  }, [uid]);
  useEffect(() => {
    void reload();
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    const onVisible = () => { if (document.visibilityState === 'visible') { setNow(new Date()); void reload(); } };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [reload]);
  const alerts = visibleReminderAlerts(items, now);
  const hide = () => {
    const value = { day: cairoClock(now).day, ids: alerts.map(item => item.id) };
    setDismissed(value);
    try { localStorage.setItem(`mybucket_alert_dismissed_${uid}`, JSON.stringify(value)); } catch { /* Keep this session's dismissal. */ }
  };
  const action = async (item: ReminderAlert, mode: 'done' | 'tomorrow' | 'stop') => {
    setBusy(true); setError(false);
    try { await request(mode === 'done' ? 'toggle' : 'alert', mode === 'done' ? { id: item.id, done: true } : { id: item.id, mode }); await reload(); }
    catch { setError(true); } finally { setBusy(false); }
  };
  if (!page) {
    if (!shouldShowReminderBanner(alerts, dismissed, now)) return null;
    return <div role="status" dir={ar ? 'rtl' : 'ltr'} className="bg-red-700 text-white px-4 py-3 shadow-md"><div className="mx-auto max-w-xl flex items-center gap-2"><BellRing className="h-5 w-5 shrink-0"/><div className="flex-1 min-w-0 text-sm font-bold">{ar ? `لديك ${alerts.length} تذكير يحتاج انتباهك` : `${alerts.length} reminders need your attention`}</div><button type="button" onClick={onOpen} className="text-xs font-bold underline whitespace-nowrap">{ar ? 'عرض التذكيرات' : 'View reminders'}</button><button type="button" onClick={hide} aria-label={ar ? 'إخفاء التذكيرات اليوم' : 'Hide reminders for today'} className="rounded-lg p-1 hover:bg-red-800"><X className="h-5 w-5"/></button></div></div>;
  }
  return <main dir={ar ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 px-4 py-6"><div className="mx-auto max-w-xl space-y-4">
    <button type="button" onClick={onBack} className="inline-flex items-center gap-2 rounded-xl border bg-white px-4 py-2 text-sm font-bold"><ArrowRight className={'h-4 w-4 ' + (ar ? '' : 'rotate-180')}/>{ar ? 'رجوع' : 'Back'}</button>
    <h1 className="text-xl font-black">{ar ? 'التذكيرات التي تحتاج انتباهك' : 'Reminders needing attention'}</h1>
    {loading && <p role="status" className="text-sm text-slate-500">{ar ? 'جارٍ تحميل التذكيرات...' : 'Loading reminders...'}</p>}
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{ar ? 'تعذر تحميل التذكيرات أو تحديثها. حاول مرة أخرى.' : 'Could not load or update reminders. Try again.'} <button type="button" onClick={() => void reload()} className="font-bold underline">{ar ? 'إعادة المحاولة' : 'Retry'}</button></p>}
    {!loading && !error && alerts.length === 0 && <p className="rounded-xl border bg-white p-4 text-sm text-slate-500">{ar ? 'لا توجد تذكيرات تحتاج انتباهك الآن.' : 'No reminders need attention now.'}</p>}
    {alerts.map(item => <article key={item.id} className="space-y-3 rounded-2xl border border-red-100 bg-white p-4 shadow-sm"><div><p className="text-xs font-bold text-red-700">{item.kind === 'obligation' ? (ar ? 'التزام' : 'Commitment') : (ar ? 'مستحق لك' : 'Receivable')}</p><h2 className="font-bold">{item.title}</h2><p className="text-sm text-slate-600">{item.amount.toLocaleString(ar ? 'ar-EG' : 'en-US')} {item.currency} · {item.dueDate}</p></div><div className="flex flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void action(item, 'done')} className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">{item.kind === 'obligation' ? (ar ? 'تم السداد' : 'Paid') : (ar ? 'تم التحصيل' : 'Collected')}</button><button type="button" disabled={busy} onClick={() => void action(item, 'tomorrow')} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50">{ar ? 'ذكّرني غدًا' : 'Remind me tomorrow'}</button><button type="button" disabled={busy} onClick={() => void action(item, 'stop')} className="rounded-lg border px-3 py-2 text-xs font-bold disabled:opacity-50">{ar ? 'إيقاف التنبيه' : 'Stop alert'}</button></div></article>)}
    <p className="text-xs text-slate-500">{ar ? 'تحديث حالة التذكير لا يغيّر أرصدة حساباتك.' : 'Updating a reminder does not change account balances.'}</p>
  </div></main>;
}
