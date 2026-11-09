import { useEffect, useState } from 'react';
import { lockRequest, type LockStatus } from '../AppLock';

type Props = {
  lang: 'ar' | 'en';
  status: LockStatus | null;
  onChange: (next: LockStatus) => void;
};

export function AppLockSettings({ lang, status, onChange }: Props) {
  const ar = lang === 'ar';
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [timeout, setTimeoutMinutes] = useState(1);
  const [editingPin, setEditingPin] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setTimeoutMinutes(status?.inactivityMinutes || 1);
    setEditingPin(false);
  }, [status?.hasPin]);

  const validPin = (value: string) => /^[0-9]{6}$/.test(value);
  const digits = (value: string) => value.replace(/[^0-9]/g, '').slice(0, 6);

  async function toggle(enabled: boolean) {
    if (!status || busy) return;
    setBusy(true);
    setMessage('');
    try {
      const result = await lockRequest('toggle', { enabled });
      onChange({ ...status, enabled: !!result.enabled, hasPin: !!result.hasPin });
      setMessage(enabled
        ? (ar ? 'تم تفعيل قفل التطبيق' : 'App Lock enabled')
        : (ar ? 'تم تعطيل قفل التطبيق، والرقم السري محفوظ' : 'App Lock disabled; your PIN is retained'));
    } catch (error) {
      setMessage((ar ? 'تعذر تغيير الحالة: ' : 'Unable to change lock: ') + (error instanceof Error ? error.message : 'unknown_error'));
    } finally {
      setBusy(false);
    }
  }

  async function savePin() {
    if (!status || busy) return;
    if (!validPin(newPin) || newPin !== confirmPin || (editingPin && !validPin(currentPin))) {
      setMessage(ar ? 'تأكد من الأرقام الستة وتطابق التأكيد' : 'Check your six-digit PIN and confirmation');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      if (editingPin) {
        await lockRequest('change', { pin: currentPin, newPin });
        onChange({ ...status });
      } else {
        await lockRequest('enable', { pin: newPin, inactivityMinutes: timeout });
        onChange({ enabled: true, hasPin: true, inactivityMinutes: timeout });
      }
      setEditingPin(false);
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
      setMessage(ar ? 'تم حفظ الرقم السري' : 'PIN saved');
    } catch (error) {
      setMessage((ar ? 'تعذر حفظ الرقم: ' : 'Could not save PIN: ') + (error instanceof Error ? error.message : 'unknown_error'));
    } finally {
      setBusy(false);
    }
  }

  async function updateTimeout(value: number) {
    if (!status || busy) return;
    setBusy(true);
    setMessage('');
    try {
      await lockRequest('timeout', { pin: currentPin, inactivityMinutes: value });
      setTimeoutMinutes(value);
      onChange({ ...status, inactivityMinutes: value });
      setMessage(ar ? 'تم تحديث مدة عدم الاستخدام' : 'Inactivity time updated');
    } catch (error) {
      setMessage((ar ? 'تعذر تحديث المدة: ' : 'Could not update duration: ') + (error instanceof Error ? error.message : 'unknown_error'));
    } finally {
      setBusy(false);
    }
  }

  if (!status) return <p className="text-xs text-slate-500">{ar ? 'جاري قراءة حالة القفل...' : 'Loading lock settings...'}</p>;

  return <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-4">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="font-bold text-sm">🔒 {ar ? 'قفل التطبيق' : 'App Lock'}</h2>
        <p className="text-xs text-slate-500 mt-1">{status.enabled
          ? (ar ? 'القفل مفعّل' : 'Lock enabled')
          : (ar ? 'القفل غير مفعّل' : 'Lock disabled')}</p>
      </div>
      {status.hasPin && <button
        type="button"
        role="switch"
        aria-checked={status.enabled}
        aria-label={ar ? 'تفعيل أو تعطيل قفل التطبيق' : 'Toggle app lock'}
        disabled={busy}
        onClick={() => void toggle(!status.enabled)}
        className={`relative h-7 w-12 rounded-full transition-colors disabled:opacity-50 ${status.enabled ? 'bg-emerald-600' : 'bg-slate-300'}`}
      ><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition-all ${status.enabled ? 'right-1' : 'left-1'}`} /></button>}
    </div>

    {!status.hasPin && <p className="text-xs text-slate-500">{ar ? 'أنشئ رقمًا سريًا من 6 أرقام لتفعيل القفل لأول مرة.' : 'Set a six-digit PIN to activate the lock for the first time.'}</p>}

    {(!status.hasPin || editingPin) && <div className="space-y-3">
      {editingPin && <input type="password" inputMode="numeric" maxLength={6} autoComplete="off" aria-label={ar ? 'الرقم الحالي' : 'Current PIN'} placeholder={ar ? 'الرقم السري الحالي' : 'Current PIN'} value={currentPin} onChange={e => setCurrentPin(digits(e.target.value))} className="w-full rounded-xl border p-3" />}
      <input type="password" inputMode="numeric" maxLength={6} autoComplete="off" aria-label={ar ? 'الرقم الجديد' : 'New PIN'} placeholder={ar ? 'رقم سري جديد (6 أرقام)' : 'New six-digit PIN'} value={newPin} onChange={e => setNewPin(digits(e.target.value))} className="w-full rounded-xl border p-3" />
      <input type="password" inputMode="numeric" maxLength={6} autoComplete="off" aria-label={ar ? 'تأكيد الرقم' : 'Confirm PIN'} placeholder={ar ? 'تأكيد الرقم السري' : 'Confirm PIN'} value={confirmPin} onChange={e => setConfirmPin(digits(e.target.value))} className="w-full rounded-xl border p-3" />
      <div className="flex gap-2">
        <button type="button" disabled={busy} onClick={() => void savePin()} className="bg-emerald-600 text-white rounded-xl px-4 py-2 text-xs font-bold disabled:opacity-50">{ar ? 'حفظ' : 'Save'}</button>
        {editingPin && <button type="button" disabled={busy} onClick={() => { setEditingPin(false); setCurrentPin(''); setNewPin(''); setConfirmPin(''); }} className="border rounded-xl px-4 py-2 text-xs">{ar ? 'إلغاء' : 'Cancel'}</button>}
      </div>
    </div>}

    {status.hasPin && <button type="button" disabled={busy} onClick={() => { setEditingPin(!editingPin); setMessage(''); }} className="text-emerald-700 text-xs font-semibold underline">{ar ? 'تغيير الرقم السري' : 'Change PIN'}</button>}

    {status.hasPin && <div className="text-xs space-y-2">
      <label className="flex items-center gap-2">{ar ? 'القفل بعد عدم الاستخدام' : 'Lock after inactivity'}
        <select value={timeout} onChange={e => setTimeoutMinutes(Number(e.target.value))} className="border rounded-lg p-2">{[1, 2, 3].map(n => <option key={n} value={n}>{n} {ar ? 'دقيقة' : 'min'}</option>)}</select>
      </label>
      {timeout !== status.inactivityMinutes && <div>
        <input type="password" inputMode="numeric" maxLength={6} autoComplete="off" aria-label={ar ? 'رقم سري لتغيير المدة' : 'PIN to change duration'} placeholder={ar ? 'الرقم السري الحالي لتأكيد المدة' : 'Current PIN to change duration'} value={currentPin} onChange={e => setCurrentPin(digits(e.target.value))} className="w-full rounded-xl border p-2 mb-2" />
        <button type="button" disabled={busy || !validPin(currentPin)} onClick={() => void updateTimeout(timeout)} className="bg-emerald-600 text-white rounded-lg px-3 py-2 disabled:opacity-50">{ar ? 'حفظ المدة' : 'Save duration'}</button>
      </div>}
    </div>}

    {message && <p role="status" className="text-xs text-slate-600">{message}</p>}
    <p className="text-xs text-amber-700">{ar ? 'تجربة مؤقتة: استعادة الرقم السري غير متاحة الآن. احتفظ بالرقم جيدًا.' : 'Temporary test: PIN recovery is not yet available.'}</p>
  </section>;
}
