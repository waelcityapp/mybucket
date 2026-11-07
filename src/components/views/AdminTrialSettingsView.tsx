import { useEffect, useState } from 'react';
import { auth } from '../../lib/firebase';
import type { Language } from '../../types';

type Settings = { proDays: number; basicDays: number; updatedAt: string | null };
async function gateway(action: string, payload: Record<string, unknown> = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Please sign in');
  const response = await fetch('/api/gateway', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await user.getIdToken() },
    body: JSON.stringify({ action, payload }),
  });
  const json = await response.json();
  if (!response.ok || json.ok !== true) throw new Error(json.message || json.error || 'Request failed');
  return json.data as Settings;
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

  useEffect(() => {
    let active = true;
    gateway('admin.subscriptionTrials.get').then(data => {
      if (!active) return;
      setValue(data); setPro(String(data.proDays)); setBasic(String(data.basicDays)); setError('');
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
      const saved = await gateway('admin.subscriptionTrials.save', { proDays: proposedPro, basicDays: proposedBasic });
      setValue(saved); setConfirm(false);
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
    {value?.updatedAt && <p className="text-xs text-slate-500">{ar ? 'آخر تعديل: ' : 'Last update: '}{new Date(value.updatedAt).toLocaleString(ar ? 'ar-EG' : 'en-GB')}</p>}
  </section>;
}
