import { useCallback, useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import { ChevronLeft, X, Plus, Trash2, Pencil, CheckCircle2 } from 'lucide-react';
import type { Language } from '../types';

export type ReminderKind = 'obligation' | 'receivable';
type Reminder = { id: string; kind: ReminderKind; title: string; amount: number; currency: string; dueDate: string; note: string; done: boolean };
type Fields = { title: string; amount: string; currency: string; dueDate: string; note: string };
const blank = (): Fields => ({ title: '', amount: '', currency: 'EGP', dueDate: new Date().toLocaleDateString('en-CA'), note: '' });
const currencies = ['EGP', 'USD', 'EUR', 'SAR', 'AED', 'GBP', 'KWD', 'QAR'];

async function request(action: string, payload: Record<string, unknown> = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('login_required');
  const response = await fetch('/api/gateway', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await user.getIdToken() }, body: JSON.stringify({ action: 'reminders.' + action, payload }) });
  const json = await response.json();
  if (!response.ok || !json.ok) throw new Error(json.error || 'reminder_request_failed');
  return json.data;
}

export function ReminderCards({ lang, userId }: { lang: Language; userId: string }) {
  const ar = lang === 'ar';
  const [items, setItems] = useState<Reminder[]>([]);
  const [selected, setSelected] = useState<ReminderKind | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [fields, setFields] = useState<Fields>(blank);
  const [showEditor, setShowEditor] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    setLoading(true);
    try { const data = await request('list'); if (auth.currentUser?.uid === userId) { setItems(Array.isArray(data.reminders) ? data.reminders : []); setError(''); } }
    catch { setError(ar ? 'تعذر تحميل التذكيرات' : 'Could not load reminders'); }
    finally { setLoading(false); }
  }, [userId, ar]);
  useEffect(() => { setItems([]); void refresh(); }, [refresh]);

  const heading = (kind: ReminderKind) => kind === 'obligation' ? (ar ? 'تذكير بالالتزامات' : 'Obligation Reminders') : (ar ? 'تذكير بمستحقات لي' : 'Money Owed to Me');
  function open(kind: ReminderKind) { setSelected(kind); setEditingId(null); setFields(blank()); setShowEditor(false); setError(''); }
  function edit(item: Reminder) { setEditingId(item.id); setFields({ title: item.title, amount: String(item.amount), currency: item.currency, dueDate: item.dueDate, note: item.note }); setShowEditor(true); setError(''); }
  async function save() {
    if (!selected || !fields.title.trim() || !fields.dueDate || fields.amount === '' || !Number.isFinite(Number(fields.amount)) || Number(fields.amount) < 0) {
      setError(ar ? 'أدخل اسم البند والمبلغ والتاريخ بشكل صحيح' : 'Enter a valid item, amount and date'); return;
    }
    setBusy(true); setError('');
    try {
      await request(editingId ? 'update' : 'create', { ...(editingId ? { id: editingId } : {}), kind: selected, title: fields.title, amount: Number(fields.amount), currency: fields.currency, dueDate: fields.dueDate, note: fields.note });
      await refresh(); setShowEditor(false); setEditingId(null); setFields(blank());
    } catch (e) { setError((ar ? 'تعذر الحفظ: ' : 'Save failed: ') + (e instanceof Error ? e.message : 'error')); }
    finally { setBusy(false); }
  }
  async function toggle(item: Reminder) {
    setBusy(true); setError('');
    try { await request('toggle', { id: item.id, done: !item.done }); await refresh(); }
    catch { setError(ar ? 'تعذر تحديث حالة البند' : 'Failed to update item'); }
    finally { setBusy(false); }
  }
  async function remove(item: Reminder) {
    if (!window.confirm(ar ? 'هل تريد حذف هذا البند؟' : 'Delete this item?')) return;
    setBusy(true); setError('');
    try { await request('delete', { id: item.id }); await refresh(); }
    catch { setError(ar ? 'تعذر حذف البند' : 'Failed to delete item'); }
    finally { setBusy(false); }
  }
  const today = new Date().toLocaleDateString('en-CA');
  return <div className="space-y-2.5">
    {(['obligation', 'receivable'] as const).map(kind => {
      const count = items.filter(item => item.kind === kind && !item.done).length;
      const overdue = items.filter(item => item.kind === kind && !item.done && item.dueDate < today).length;
      return <button key={kind} type="button" onClick={() => open(kind)} className="w-full bg-white hover:bg-slate-50/90 border border-slate-200/90 hover:border-slate-300 rounded-2xl p-2.5 sm:p-3 flex items-center justify-between shadow-2xs transition-all cursor-pointer active:scale-[0.99]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className={`w-8 h-8 rounded-xl border flex items-center justify-center text-base shrink-0 ${kind === 'obligation' ? 'bg-amber-50 border-amber-100' : 'bg-sky-50 border-sky-100'}`}>{kind === 'obligation' ? '📅' : '💰'}</div>
          <div className="text-start min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs sm:text-sm font-black text-slate-900">{heading(kind)}</span>
              <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">{ar ? 'إنشاء البنود' : 'Create items'}</span>
            </div>
            <p className="text-[10px] sm:text-[11px] text-slate-400 font-medium">{kind === 'obligation' ? (ar ? 'إضافة التزاماتك ومواعيد استحقاقها ومتابعتها' : 'Track upcoming payments and due dates') : (ar ? 'تسجيل مستحقاتك لدى الآخرين ومواعيد تحصيلها' : 'Track amounts owed to you and collection dates')}</p>
            {!loading && count > 0 && <p className="text-[10px] text-slate-500 mt-0.5">{count} {ar ? 'بند مفتوح' : 'open'}{overdue > 0 && <span className="text-red-600 font-bold"> · {overdue} {ar ? 'متأخر' : 'overdue'}</span>}</p>}
          </div>
        </div>
        <div className="flex items-center gap-1 text-slate-400 shrink-0"><span className="text-xs font-bold text-slate-600 hidden sm:inline">{ar ? 'عرض القائمة' : 'View list'}</span><ChevronLeft className={`w-4 h-4 ${ar ? '' : 'rotate-180'}`} /></div>
      </button>;
    })}
    {selected && <div role="dialog" aria-modal="true" aria-label={heading(selected)} dir={ar ? 'rtl' : 'ltr'} className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/50 p-3" onClick={e => { if (e.target === e.currentTarget && !busy) setSelected(null); }}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-5 space-y-4">
        <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold text-slate-900">{heading(selected)}</h2><button type="button" aria-label={ar ? 'إغلاق' : 'Close'} onClick={() => setSelected(null)}><X className="w-5 h-5"/></button></div>
        {!showEditor && <button type="button" onClick={() => { setEditingId(null); setFields(blank()); setShowEditor(true); }} className="flex items-center gap-2 bg-emerald-600 text-white rounded-xl px-4 py-2 font-bold text-sm"><Plus className="w-4 h-4"/>{ar ? 'إنشاء بند جديد' : 'New item'}</button>}
        {showEditor && <form onSubmit={e => { e.preventDefault(); void save(); }} className="space-y-3 rounded-xl bg-slate-50 p-3">
          <label className="block text-xs font-semibold">{ar ? 'اسم البند' : 'Item name'}<input required maxLength={120} value={fields.title} onChange={e => setFields(s => ({ ...s, title: e.target.value }))} className="w-full mt-1 p-2.5 rounded-lg border bg-white" placeholder={selected === 'obligation' ? (ar ? 'مثال: قسط أو فاتورة' : 'Bill or installment') : (ar ? 'مثال: مبلغ عند صديق' : 'Money owed by a friend')} /></label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-semibold">{ar ? 'المبلغ' : 'Amount'}<input required inputMode="decimal" type="number" min="0" step="0.01" value={fields.amount} onChange={e => setFields(s => ({ ...s, amount: e.target.value }))} className="w-full mt-1 p-2.5 rounded-lg border bg-white" /></label>
            <label className="block text-xs font-semibold">{ar ? 'العملة' : 'Currency'}<select value={fields.currency} onChange={e => setFields(s => ({ ...s, currency: e.target.value }))} className="w-full mt-1 p-2.5 rounded-lg border bg-white">{currencies.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
          </div>
          <label className="block text-xs font-semibold">{ar ? 'تاريخ الاستحقاق' : 'Due date'}<input required type="date" value={fields.dueDate} onChange={e => setFields(s => ({ ...s, dueDate: e.target.value }))} className="w-full mt-1 p-2.5 rounded-lg border bg-white" /></label>
          <label className="block text-xs font-semibold">{ar ? 'ملاحظات (اختياري)' : 'Notes (optional)'}<textarea maxLength={500} rows={2} value={fields.note} onChange={e => setFields(s => ({ ...s, note: e.target.value }))} className="w-full mt-1 p-2.5 rounded-lg border bg-white" /></label>
          <div className="flex gap-2"><button type="submit" disabled={busy} className="bg-emerald-600 text-white rounded-lg px-4 py-2 text-sm font-bold disabled:opacity-50">{ar ? 'حفظ البند' : 'Save item'}</button><button type="button" onClick={() => setShowEditor(false)} disabled={busy} className="border rounded-lg px-4 py-2 text-sm">{ar ? 'إلغاء' : 'Cancel'}</button></div>
        </form>}
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
        {loading ? <p className="text-sm text-slate-500">{ar ? 'جاري تحميل البنود...' : 'Loading items...'}</p> : items.filter(item => item.kind === selected).length === 0 ? <p className="text-sm text-slate-500">{ar ? 'لا توجد بنود مسجلة حتى الآن.' : 'No items yet.'}</p> : <div className="space-y-2">{items.filter(item => item.kind === selected).map(item => <div key={item.id} className="border border-slate-200 rounded-xl p-3 flex items-start gap-3">
          <button type="button" aria-label={ar ? 'تغيير الحالة' : 'Toggle complete'} disabled={busy} onClick={() => void toggle(item)} className={item.done ? 'text-emerald-600' : 'text-slate-400'}><CheckCircle2 className="w-5 h-5"/></button>
          <div className="flex-1 min-w-0"><p className={`font-semibold text-sm break-words ${item.done ? 'line-through text-slate-400' : 'text-slate-900'}`}>{item.title}</p><p className="text-xs text-slate-600">{item.amount.toLocaleString(ar ? 'ar-EG' : 'en-US')} {item.currency} · {item.dueDate}</p>{item.note && <p className="text-xs text-slate-400 break-words">{item.note}</p>}{!item.done && item.dueDate < today && <p className="text-xs font-bold text-red-600">{ar ? 'متأخر عن موعده' : 'Overdue'}</p>}</div>
          <button type="button" aria-label={ar ? 'تعديل' : 'Edit'} disabled={busy} onClick={() => edit(item)} className="text-slate-500"><Pencil className="w-4 h-4"/></button>
          <button type="button" aria-label={ar ? 'حذف' : 'Delete'} disabled={busy} onClick={() => void remove(item)} className="text-red-500"><Trash2 className="w-4 h-4"/></button>
        </div>)}</div>}
        <p className="text-[11px] text-slate-400">{ar ? 'التذكيرات لا تسجل مصروفًا أو دخلًا تلقائيًا.' : 'Reminders do not automatically create transactions.'}</p>
      </div>
    </div>}
  </div>;
}
