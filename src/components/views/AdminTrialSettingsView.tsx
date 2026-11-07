import { useEffect, useState } from 'react';
import { auth } from '../../lib/firebase';
import type { Language } from '../../types';

type Settings = { proDays: number; basicDays: number; updatedAt: string | null };
type Change = { id: string; timestamp: string; previous: { proDays: number; basicDays: number }; next: { proDays: number; basicDays: number } };
async function gateway(action: string, payload: Record<string, unknown> = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in');
  const response = await fetch('/api/gateway', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await user.getIdToken() },
    body: JSON.stringify({ action, payload }),
  });
  const json = await response.json();
  if (!response.ok || json.ok !== true) throw new Error(json.message || json.error || 'Request failed');
  return json.data as unknown;
}
export function AdminTrialSettingsView({ lang }: { lang: Language }) {
  const ar = lang === 'ar';
  const [value, setValue] = useState<Settings | null>(null);
  const [pro, setPro] = useState('15');
  const [basic, setBasic] = useState('75');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<Change[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [archivePendingId, setArchivePendingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const archiveHistoryEntry = async (id: string) => {
    if (archivingId || archivePendingId !== id) return;
    setArchivingId(id);
    setHistoryError('');
    try {
      await gateway('admin.subscriptionTrials.archiveHistory', { id });
      setHistory(items => items.filter(item => item.id !== id));
      setArchivePendingId(null);
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : String(err));
    } finally { setArchivingId(null); }
  };
  const loadHistory = async () => {
    setHistoryLoading(true); setHistoryError('');
    try {
      const data = await gateway('admin.subscriptionTrials.history');
      if (!Array.isArray(data)) throw new Error('Unexpected change history response');
      setHistory(data as Change[]);
      setArchivePendingId(null);
    } catch (err) { setHistoryError(err instanceof Error ? err.message : String(err)); }
    finally { setHistoryLoading(false); }
  };
  const toggleHistory = () => {
    if (!historyOpen) void loadHistory();
    setHistoryOpen(open => !open);
  };
  const renderDate = (date: string) => new Date(date).toLocaleString(ar ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });

  useEffect(() => {
    let active = true;
    gateway('admin.subscriptionTrials.get').then(data => {
      if (!active) return;
      const settings = data as Settings;
      setValue(settings); setPro(String(settings.proDays)); setBasic(String(settings.basicDays)); setError('');
    }).catch(err => { if (active) setError(err instanceof Error ? err.message : String(err)); });
    return () => { active = false; };
  }, []);

  const proposedPro = Number(pro), proposedBasic = Number(basic);
  const valid = pro.trim() !== '' && basic.trim() !== '' &&
    Number.isInteger(proposedPro) && Number.isInteger(proposedBasic) &&
    proposedPro >= 1 && proposedPro <= 365 && proposedBasic >= proposedPro && proposedBasic <= 365;
  const changed = value && (value.proDays !== proposedPro || value.basicDays !== proposedBasic);
  const save = async () => {
    if (!valid || !confirm || !changed || busy) return;
    setBusy(true); setError(''); setSuccess('');
    try {
      const saved = await gateway('admin.subscriptionTrials.save', { proDays: proposedPro, basicDays: proposedBasic }) as Settings;
      setValue(saved); setConfirm(false);
      if (historyOpen) void loadHistory();
      window.dispatchEvent(new Event('mybucket:trial-settings-changed'));
      setSuccess(ar ? 'تم حفظ المدد في Firebase وتطبيقها على جميع الحسابات عند تحديث حالتها.' : 'Durations saved to Firebase for all accounts.');
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setBusy(false); }
  };
  return <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 space-y-4">
    <h3 className="font-extrabold text-slate-900">{ar ? 'إدارة مدد التجربة' : 'Manage trial durations'}</h3>
    <p className="text-sm text-slate-600">{ar ? 'تتحكم هنا في مدد جميع الحسابات، القديمة والجديدة. يبدأ الحساب من تاريخ التسجيل الأصلي، ولا تُمس البيانات المالية.' : 'Changes apply globally to old and new accounts using their original registration dates; financial data is preserved.'}</p>
    {!value && !error && <p className="text-sm text-slate-500">{ar ? 'جارٍ تحميل إعدادات Firebase...' : 'Loading Firebase settings...'}</p>}
    <div className="grid grid-cols-2 gap-3">
      <label className="text-xs font-bold text-slate-700">{ar ? 'تجربة Pro بالأيام' : 'Pro trial (days)'}<input type="number" min="1" max="365" step="1" value={pro} onChange={e=>{setPro(e.target.value);setConfirm(false);setSuccess('');}} className="mt-2 block w-full border rounded-xl px-3 py-2 text-base" /></label>
      <label className="text-xs font-bold text-slate-700">{ar ? 'فترة Basic بالأيام' : 'Basic period (days)'}<input type="number" min="1" max="365" step="1" value={basic} onChange={e=>{setBasic(e.target.value);setConfirm(false);setSuccess('');}} className="mt-2 block w-full border rounded-xl px-3 py-2 text-base" /></label>
    </div>
    <p className="text-xs text-amber-900 rounded-xl border border-amber-200 bg-amber-50 p-3">{ar ? 'تنبيه: تقليل المدة قد ينهي التجربة لبعض المستخدمين فورًا. التغيير لا يعيد تشغيل العدادات.' : 'Warning: reducing days may immediately expire some users. The clock never restarts.'}</p>
    <label className="flex items-start gap-2 text-sm text-slate-700"><input type="checkbox" checked={confirm} onChange={e=>setConfirm(e.target.checked)} />{ar ? 'أؤكد تطبيق المدد الجديدة على جميع الحسابات' : 'Apply the new durations to all accounts'}</label>
    {!valid && <p className="text-xs text-rose-600">{ar ? 'المدد يجب أن تكون أعدادًا صحيحة من 1 إلى 365، ومدة Basic لا تقل عن Pro.' : 'Enter whole days 1–365; Basic must not be shorter than Pro.'}</p>}
    {error && <p role="alert" className="text-sm text-rose-700 break-words">{error}</p>}
    {success && <p role="status" className="text-sm text-emerald-700">{success}</p>}
    <button type="button" disabled={!value || !changed || !valid || !confirm || busy} onClick={save} className="rounded-xl px-5 py-2.5 bg-emerald-700 text-white font-bold text-sm disabled:opacity-40">{busy ? (ar ? 'جارٍ الحفظ...' : 'Saving...') : (ar ? 'حفظ وتطبيق على الجميع' : 'Save for all users')}</button>
    {value?.updatedAt && <button type="button" onClick={toggleHistory} aria-expanded={historyOpen} className="text-xs text-emerald-800 underline underline-offset-2 hover:text-emerald-950 text-start">{ar ? 'آخر تعديل: ' : 'Last update: '}{renderDate(value.updatedAt)} — {ar ? 'عرض ما تغيّر' : 'View changes'}</button>}
    <div className="border-t border-slate-100 pt-3 space-y-3">
      <button type="button" onClick={toggleHistory} aria-expanded={historyOpen} className="text-sm font-bold text-emerald-800 hover:text-emerald-950 underline underline-offset-2">{historyOpen ? (ar ? 'إخفاء سجل التعديلات' : 'Hide change history') : (ar ? 'عرض سجل التعديلات' : 'View change history')}</button>
      {historyOpen && <div className="space-y-3" aria-label={ar ? 'سجل تعديلات الاشتراكات' : 'Subscription changes history'}>
        {historyLoading && <p role="status" className="text-xs text-slate-500">{ar ? 'جارٍ تحميل السجل...' : 'Loading history...'}</p>}
        {historyError && <div role="alert" className="text-xs text-rose-700">{historyError} <button type="button" onClick={() => void loadHistory()} className="underline font-semibold">{ar ? 'إعادة المحاولة' : 'Retry'}</button></div>}
        {!historyLoading && !historyError && history.length === 0 && <p className="text-xs text-slate-500">{ar ? 'لا توجد تعديلات مسجلة حتى الآن.' : 'No saved changes yet.'}</p>}
        {!historyLoading && !historyError && history.length > 0 && <>
          <p className="text-xs text-slate-500">{ar ? 'أحدث 50 تعديلًا؛ يمكن إخفاء المدخلات القديمة من العرض مع الاحتفاظ بها في سجل التدقيق.' : 'Latest 50 changes. Hide older entries from this view while retaining their audit records.'}</p>
          {history.map(change => {
            const proChanged = change.previous.proDays !== change.next.proDays;
            const basicChanged = change.previous.basicDays !== change.next.basicDays;
            return <div key={change.id} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <p className="text-xs font-extrabold text-slate-800">{renderDate(change.timestamp)}</p>
                <button type="button" disabled={Boolean(archivingId)} onClick={() => setArchivePendingId(id => id === change.id ? null : change.id)} className="text-xs font-bold text-rose-700 underline underline-offset-2 disabled:opacity-50">{ar ? 'إزالة من السجل' : 'Hide entry'}</button>
              </div>
              {archivePendingId === change.id && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 space-y-2">
                <p className="text-xs text-amber-950">{ar ? 'هل تريد إخفاء هذا التعديل من القائمة؟ سيتم الاحتفاظ به في Firebase للتدقيق، ولن تتغير مدد الاشتراكات الحالية.' : 'Hide this entry from the list? Its audit record remains in Firebase; current plan durations will not change.'}</p>
                <div className="flex gap-2">
                  <button type="button" disabled={Boolean(archivingId)} onClick={() => void archiveHistoryEntry(change.id)} className="rounded-lg bg-rose-700 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">{archivingId === change.id ? (ar ? 'جارٍ الإخفاء...' : 'Hiding...') : (ar ? 'تأكيد الإخفاء' : 'Confirm hide')}</button>
                  <button type="button" disabled={Boolean(archivingId)} onClick={() => setArchivePendingId(null)} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700">{ar ? 'إلغاء' : 'Cancel'}</button>
                </div>
              </div>}
              {proChanged && <p className="text-sm text-slate-700">Pro: <span className="text-xs">{ar ? 'من' : 'from'}</span> <span className="font-bold">{change.previous.proDays}</span> <span className="text-xs">{ar ? 'إلى' : 'to'}</span> <span className="font-extrabold text-emerald-800">{change.next.proDays}</span> <span className="text-xs">{ar ? 'يومًا' : 'days'}</span></p>}
              {basicChanged && <p className="text-sm text-slate-700">Basic: <span className="text-xs">{ar ? 'من' : 'from'}</span> <span className="font-bold">{change.previous.basicDays}</span> <span className="text-xs">{ar ? 'إلى' : 'to'}</span> <span className="font-extrabold text-emerald-800">{change.next.basicDays}</span> <span className="text-xs">{ar ? 'يومًا' : 'days'}</span></p>}
              {!proChanged && !basicChanged && <p className="text-xs text-slate-500">{ar ? 'حفظ بدون تغيير في المدد' : 'Saved without a duration change'}</p>}
            </div>;
          })}
        </>}
      </div>}
    </div>
  </section>;
}
