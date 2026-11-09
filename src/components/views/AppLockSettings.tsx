import { useEffect, useState } from 'react';
import { lockRequest, type LockStatus } from '../AppLock';

export function AppLockSettings({ lang, status, onChange }: { lang: 'ar' | 'en'; status: LockStatus | null; onChange: (next: LockStatus) => void }) {
  const [pin, setPin] = useState('');
  const [nextPin, setNextPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [timeout, setTimeoutMinutes] = useState(1);
  const [mode, setMode] = useState<'enable'|'disable'|'change'>('enable');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const ar = lang === 'ar';
  useEffect(() => { setTimeoutMinutes(status?.inactivityMinutes || 1); setMode(status?.enabled ? 'change' : 'enable'); }, [status?.enabled, status?.inactivityMinutes]);
  const six = (value: string) => /^[0-9]{6}$/.test(value);
  async function save() {
    if (mode === 'enable' && (!six(nextPin) || nextPin !== confirm)) { setMessage(ar ? 'تأكد من الرقم السري وتطابق التأكيد' : 'PIN confirmation does not match'); return; }
    if (mode === 'change' && (!six(pin) || !six(nextPin) || nextPin !== confirm)) { setMessage(ar ? 'تأكد من الأرقام وتطابق التأكيد' : 'Check the PINs'); return; }
    if (mode === 'disable' && !six(pin)) { setMessage(ar ? 'أدخل الرقم السري الحالي' : 'Enter current PIN'); return; }
    setBusy(true); setMessage('');
    try {
      await lockRequest(mode, mode === 'enable' ? { pin: nextPin, inactivityMinutes: timeout } : mode === 'change' ? { pin, newPin: nextPin } : { pin });
      onChange({ enabled: mode === 'disable' ? false : true, inactivityMinutes: mode === 'enable' ? timeout : status?.inactivityMinutes || 1 });
      setPin(''); setNextPin(''); setConfirm('');
      setMessage(ar ? 'تم حفظ إعدادات القفل' : 'Lock settings saved');
    } catch { setMessage(ar ? 'تعذر الحفظ. تحقق من الرقم السري والاتصال' : 'Could not save. Check PIN and connection'); }
    finally { setBusy(false); }
  }
  if (!status) return <p className="text-xs text-slate-500">{ar ? 'جاري قراءة حالة القفل...' : 'Loading lock settings...'}</p>;
  return <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
    <h2 className="font-bold text-sm">🔒 {ar ? 'قفل التطبيق' : 'App Lock'}</h2>
    <p className="text-xs text-slate-500">{status.enabled ? (ar ? 'القفل مفعل' : 'Lock enabled') : (ar ? 'القفل غير مفعل' : 'Lock disabled')}</p>
    {status.enabled && <div className="flex gap-2">
      <button className="text-xs border rounded-lg px-3 py-2" onClick={() => setMode('change')}>{ar ? 'تغيير الرقم' : 'Change PIN'}</button>
      <button className="text-xs border rounded-lg px-3 py-2" onClick={() => setMode('disable')}>{ar ? 'إلغاء القفل' : 'Disable'}</button>
    </div>}
    {mode !== 'enable' && status.enabled && <input aria-label="Current PIN" type="password" inputMode="numeric" maxLength={6} placeholder={ar ? 'الرقم الحالي' : 'Current PIN'} value={pin} onChange={e => setPin(e.target.value.replace(/[^0-9]/g, '').slice(0,6))} className="border rounded-xl p-2 w-full" />}
    {(mode === 'enable' || mode === 'change') && <>
      <input aria-label="New PIN" type="password" inputMode="numeric" maxLength={6} placeholder={ar ? 'الرقم الجديد (6 أرقام)' : 'New six-digit PIN'} value={nextPin} onChange={e => setNextPin(e.target.value.replace(/[^0-9]/g, '').slice(0,6))} className="border rounded-xl p-2 w-full" />
      <input aria-label="Confirm PIN" type="password" inputMode="numeric" maxLength={6} placeholder={ar ? 'تأكيد الرقم' : 'Confirm PIN'} value={confirm} onChange={e => setConfirm(e.target.value.replace(/[^0-9]/g, '').slice(0,6))} className="border rounded-xl p-2 w-full" />
    </>}
    {mode === 'enable' && <label className="text-xs flex items-center gap-2">{ar ? 'القفل بعد عدم الاستخدام' : 'Lock after inactivity'}<select value={timeout} onChange={e => setTimeoutMinutes(Number(e.target.value))} className="border rounded-lg p-2">{[1,2,3].map(n => <option key={n} value={n}>{n} {ar ? 'دقيقة' : 'min'}</option>)}</select></label>}
    {status.enabled && <label className="text-xs flex items-center gap-2">{ar ? 'مدة عدم الاستخدام' : 'Inactivity'}<select value={timeout} onChange={async e => { const n = Number(e.target.value); if (!six(pin)) { setMessage(ar ? 'أدخل الرقم الحالي أولاً' : 'Enter current PIN first'); return; } try { await lockRequest('timeout', { pin, inactivityMinutes: n }); onChange({ enabled: true, inactivityMinutes: n }); setMessage(ar ? 'تم تحديث المدة' : 'Timeout updated'); } catch { setMessage(ar ? 'تعذر تغيير المدة' : 'Could not change timeout'); } }} className="border rounded-lg p-2">{[1,2,3].map(n => <option key={n} value={n}>{n}</option>)}</select></label>}
    <button disabled={busy} onClick={() => void save()} className="bg-emerald-600 text-white rounded-xl px-4 py-2 text-xs font-bold">{mode === 'disable' ? (ar ? 'تأكيد الإلغاء' : 'Disable lock') : (ar ? 'حفظ' : 'Save')}</button>
    {message && <p role="status" className="text-xs text-slate-600">{message}</p>}
    <p className="text-xs text-amber-700">{ar ? 'تجربة مؤقتة: استعادة الرقم السري غير متاحة الآن. احتفظ بالرقم جيداً.' : 'Temporary test: PIN recovery is unavailable.'}</p>
  </section>;
}
