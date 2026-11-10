import { randomUUID } from 'node:crypto';
import { FieldPath } from 'firebase-admin/firestore';
import { getAdminFirestore } from './firebaseAdmin.js';
import { SubscriptionError } from './subscriptionService.js';
import { occurrenceDate, occurrenceId, parseOccurrenceId, isoDate, type Frequency, type OccurrenceChange, type OccurrenceOverride } from './recurrence.js';

type Kind = 'obligation' | 'receivable';
type Status = { done?: boolean; alertDisabled?: boolean; snoozedUntil?: string | null; cancelled?: boolean };
type Reminder = {
  id: string; kind: Kind; category?: string; title: string; amount: number; currency: string; dueDate: string; note: string;
  done: boolean; leadDays: number; tone: number; remindTime: string; repeat: 'daily' | 'once';
  alertDisabled: boolean; snoozedUntil: string | null; createdAt: number; updatedAt: number;
  frequency?: Frequency; installmentCount?: number | null; changes?: OccurrenceChange[];
  overrides?: Record<string, OccurrenceOverride>; states?: Record<string, Status>;
};
const validCurrencies = new Set(['EGP','USD','EUR','SAR','AED','GBP','KWD','QAR']);
const frequencies = new Set<Frequency>(['none','weekly','monthly','yearly','installments']);
const fail = (code: string, status = 400): never => { throw new SubscriptionError(status, code, code); };
function date(value: unknown): string {
  const s = String(value ?? '');
  if (!isoDate(s)) fail('invalid_due_date');
  return s;
}
function kind(value: unknown): Kind {
  if (value !== 'obligation' && value !== 'receivable') fail('invalid_reminder_kind');
  return value as Kind;
}
function frequencyOf(value: unknown): Frequency {
  if (!frequencies.has(value as Frequency)) fail('invalid_recurrence');
  return value as Frequency;
}
function fieldsOf(payload: Record<string, unknown>) {
  const title = String(payload.title ?? '').trim().slice(0,120);
  const amount = Number(payload.amount);
  const currency = String(payload.currency ?? 'EGP');
  const note = String(payload.note ?? '').trim().slice(0,500);
  const leadDays = payload.leadDays === undefined ? 7 : Number(payload.leadDays);
  const tone = payload.tone === undefined ? 1 : Number(payload.tone);
  const remindTime = payload.remindTime === undefined ? '09:00' : String(payload.remindTime);
  const repeat: 'daily' | 'once' = payload.repeat === 'once' ? 'once' : 'daily';
  if (!title) fail('reminder_title_required');
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000_000) fail('invalid_reminder_amount');
  if (!validCurrencies.has(currency)) fail('invalid_reminder_currency');
  if (!Number.isInteger(leadDays) || leadDays < 0 || leadDays > 365) fail('invalid_reminder_days');
  if (!Number.isInteger(tone) || tone < 1 || tone > 4) fail('invalid_reminder_tone');
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(remindTime)) fail('invalid_reminder_time');
  if (payload.repeat !== undefined && payload.repeat !== 'daily' && payload.repeat !== 'once') fail('invalid_reminder_repeat');
  const category = String(payload.category ?? 'other').trim().slice(0,50);
  if (!/^[a-z-]{2,50}$/.test(category)) fail('invalid_reminder_category');
  return { title, category, amount, currency, note, dueDate: date(payload.dueDate), leadDays, tone, remindTime, repeat };
}
function scheduleOf(payload: Record<string, unknown>) {
  const frequency = frequencyOf(payload.frequency ?? 'none');
  const installmentCount = frequency === 'installments' ? Number(payload.installmentCount) : null;
  if (frequency === 'installments' && (!Number.isInteger(installmentCount) || installmentCount! < 1 || installmentCount! > 240)) fail('invalid_installment_count');
  return { frequency, installmentCount };
}
function effective(master: Reminder, index: number) {
  const changes = master.changes || [];
  const segment = [...changes].filter(s => s.fromIndex <= index).sort((a,b) => b.fromIndex-a.fromIndex)[0];
  const exception = master.overrides?.[String(index)] || {};
  return {
    ...master,
    title: exception.title ?? segment?.title ?? master.title,
    amount: exception.amount ?? segment?.amount ?? master.amount,
    currency: exception.currency ?? segment?.currency ?? master.currency,
    note: exception.note ?? segment?.note ?? master.note,
    leadDays: exception.leadDays ?? segment?.leadDays ?? master.leadDays,
    tone: exception.tone ?? segment?.tone ?? master.tone,
    remindTime: exception.remindTime ?? segment?.remindTime ?? master.remindTime,
    repeat: exception.repeat ?? segment?.repeat ?? master.repeat,
    dueDate: exception.dueDate ?? occurrenceDate(master.dueDate, master.frequency || 'none', index, changes),
  };
}
function expand(master: Reminder, today: string) {
  if (!master.frequency || master.frequency === 'none') return [{ ...master, frequency: 'none' as Frequency, seriesId: master.id, occurrenceIndex: 0 }];
  const result: Array<Reminder & { seriesId: string; occurrenceIndex: number }> = [];
  const end = new Date(today + 'T12:00:00Z');
  end.setUTCDate(end.getUTCDate() + 400);
  const horizon = end.toISOString().slice(0,10);
  // A personal reminder can have a long history; keep all missed installments
  // within a bounded 400 occurrences, never silently treat them as paid.
  const limit = master.frequency === 'installments' ? Math.min(master.installmentCount ?? 1, 240) : 400;
  for (let index=0; index<limit; index++) {
    const item = effective(master,index);
    if (item.dueDate > horizon && index > 0) break;
    const state = master.states?.[String(index)] || {};
    if (state.cancelled) continue;
    const completed = !!state.done;
    const past = item.dueDate < today;
    const showHistory = past && item.dueDate >= shiftBack(today,90);
    if (past && completed && !showHistory) continue;
    if (!past && result.filter(r => r.dueDate >= today).length >= 18) break;
    result.push({ ...item, id: occurrenceId(master.id,index), seriesId: master.id,
      occurrenceIndex:index, done:completed, alertDisabled:!!state.alertDisabled,
      snoozedUntil:state.snoozedUntil ?? null });
  }
  return result;
}
function shiftBack(today: string, days: number) {
  const d = new Date(today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate()-days);
  return d.toISOString().slice(0,10);
}

/** Include every due date in the requested month, regardless of paid status or list pagination. */
export function monthlyReminderTotals(masters: Reminder[], month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) fail('invalid_summary_month');
  const totals: Record<string, { obligations: number; receivables: number }> = {};
  const monthStart = month + '-01';
  for (const master of masters) {
    if (!isoDate(master.dueDate) || (master.kind !== 'obligation' && master.kind !== 'receivable')) fail('invalid_reminder_data', 503);
    const frequency = master.frequency || 'none';
    if (!frequencies.has(frequency)) fail('invalid_reminder_data', 503);
    const candidates = new Set<number>();
    if (frequency === 'none') candidates.add(0);
    else {
      const segments = [{ fromIndex: 0, anchorDate: master.dueDate }, ...(master.changes || [])];
      for (const segment of segments) {
        if (!Number.isSafeInteger(segment.fromIndex) || segment.fromIndex < 0 || !isoDate(segment.anchorDate)) fail('invalid_reminder_data', 503);
        const [y, m] = month.split('-').map(Number), [ay, am] = segment.anchorDate.split('-').map(Number);
        const estimate = frequency === 'weekly'
          ? Math.floor((Date.parse(monthStart + 'T12:00:00Z') - Date.parse(segment.anchorDate + 'T12:00:00Z')) / (7 * 86400000))
          : frequency === 'yearly' ? y - ay : (y - ay) * 12 + m - am;
        for (let offset = -2; offset <= 7; offset++) {
          const index = segment.fromIndex + estimate + offset;
          if (Number.isSafeInteger(index) && index >= segment.fromIndex && (frequency !== 'installments' || index < (master.installmentCount ?? 0))) candidates.add(index);
        }
      }
      for (const key of Object.keys(master.overrides || {})) {
        if (/^\d+$/.test(key)) { const index = Number(key); if (Number.isSafeInteger(index) && (frequency !== 'installments' || index < (master.installmentCount ?? 0))) candidates.add(index); }
      }
    }
    for (const index of candidates) {
      if (master.states?.[String(index)]?.cancelled) continue;
      const item = frequency === 'none' ? master : effective(master, index);
      if (!isoDate(item.dueDate)) fail('invalid_reminder_data', 503);
      if (!item.dueDate.startsWith(month + '-')) continue;
      if (!validCurrencies.has(item.currency) || typeof item.amount !== 'number' || !Number.isFinite(item.amount) || item.amount < 0) fail('invalid_reminder_data', 503);
      const entry = totals[item.currency] ||= { obligations: 0, receivables: 0 };
      if (master.kind === 'obligation') entry.obligations += item.amount;
      else entry.receivables += item.amount;
    }
  }
  for (const entry of Object.values(totals)) { entry.obligations = Math.round(entry.obligations * 100) / 100; entry.receivables = Math.round(entry.receivables * 100) / 100; }
  return totals;
}

export async function monthlyReminderSummary(uid: string) {
  const col = getAdminFirestore().collection('users').doc(uid).collection('reminders');
  const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit' }).format(new Date());
  const masters: Reminder[] = [];
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  while (true) {
    let query: FirebaseFirestore.Query = col.orderBy(FieldPath.documentId()).limit(200);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    masters.push(...page.docs.map(doc => ({ ...doc.data(), id: doc.id } as Reminder)));
    if (page.size < 200) break;
    cursor = page.docs[page.docs.length - 1];
  }
  return { month, totals: monthlyReminderTotals(masters, month) };
}
export async function reminderAction(uid: string, action: string, payload: Record<string, unknown>) {
  const col = getAdminFirestore().collection('users').doc(uid).collection('reminders');
  if (action === 'reminders.list') {
    const now = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
    const snapshot = await col.limit(250).get();
    const reminders = snapshot.docs.flatMap(doc => expand({ ...doc.data(), id:doc.id } as Reminder, now));
    return { reminders: reminders.sort((a,b) => a.dueDate.localeCompare(b.dueDate) || a.createdAt-b.createdAt).slice(0,1000) };
  }
  if (action === 'reminders.create') {
    const doc = col.doc(randomUUID());
    const now = Date.now();
    const fields = fieldsOf(payload);
    const schedule = scheduleOf(payload);
    const item: Reminder = { id: doc.id, kind: kind(payload.kind), ...fields, ...schedule,
      done:false, alertDisabled:false, snoozedUntil:null, changes:[], overrides:{}, states:{}, createdAt:now, updatedAt:now };
    await doc.set(item);
    return { reminder: item };
  }
  const id = String(payload.id ?? '');
  const parsed = parseOccurrenceId(id);
  const masterId = parsed?.masterId ?? id;
  if (!/^[a-f0-9-]{36}$/.test(masterId)) fail('invalid_reminder_id');
  const ref = col.doc(masterId);
  return getAdminFirestore().runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists) fail('reminder_not_found',404);
    const master = { ...snapshot.data(), id: masterId } as Reminder;
    const recurring = !!master.frequency && master.frequency !== 'none';
    const index = parsed?.index ?? 0;
    if (recurring && (index < 0 || index >= (master.frequency === 'installments' ? (master.installmentCount || 0) : 400))) fail('invalid_occurrence_index');
    if (action === 'reminders.update') {
      const fields = fieldsOf(payload);
      const nextKind = payload.kind === undefined ? master.kind : kind(payload.kind);
      if (recurring) {
        const scope = payload.scope === 'future' ? 'future' : 'once';
        if (scope === 'future') {
          // A future-wide edit replaces later edits too, while retaining past history and completion states.
          const changes = (master.changes || []).filter(x => x.fromIndex < index);
          const overrides = Object.fromEntries(Object.entries(master.overrides || {}).filter(([key]) => Number(key) < index));
          changes.push({ fromIndex:index, title:fields.title, amount:fields.amount, currency:fields.currency, note:fields.note, anchorDate:fields.dueDate, leadDays:fields.leadDays, tone:fields.tone, remindTime:fields.remindTime, repeat:fields.repeat });
          changes.sort((a,b)=>a.fromIndex-b.fromIndex);
          transaction.update(ref,{changes,overrides,category:fields.category,updatedAt:Date.now()});
        } else {
          const overrides = {...master.overrides,[String(index)]:{title:fields.title,amount:fields.amount,currency:fields.currency,note:fields.note,dueDate:fields.dueDate, leadDays:fields.leadDays, tone:fields.tone, remindTime:fields.remindTime, repeat:fields.repeat}};
          transaction.update(ref,{overrides,updatedAt:Date.now()});
        }
      } else {
        const schedule = scheduleOf(payload);
        transaction.update(ref,{...fields,kind:nextKind,...schedule,done:master.done,states:schedule.frequency === 'none' ? (master.states || {}) : {'0':{done:master.done}},updatedAt:Date.now()});
      }
      return { id, updated:true };
    }
    if (action === 'reminders.toggle') {
      if (typeof payload.done !== 'boolean') fail('invalid_reminder_state');
      if (recurring) {
        const states = {...master.states,[String(index)]:{...master.states?.[String(index)],done:payload.done}};
        transaction.update(ref,{states,updatedAt:Date.now()});
      } else transaction.update(ref,{done:payload.done,updatedAt:Date.now()});
      return {id,done:payload.done};
    }
    if (action === 'reminders.alert') {
      if (payload.mode !== 'stop' && payload.mode !== 'resume' && payload.mode !== 'tomorrow') fail('invalid_alert_action');
      const today = new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Cairo'});
      const tomorrow = new Date(today + 'T12:00:00Z'); tomorrow.setUTCDate(tomorrow.getUTCDate()+1);
      const state = {alertDisabled:payload.mode === 'stop',snoozedUntil:payload.mode === 'tomorrow' ? tomorrow.toISOString().slice(0,10) : null};
      if (recurring) {
        const states = {...master.states,[String(index)]:{...master.states?.[String(index)],...state}};
        transaction.update(ref,{states,updatedAt:Date.now()});
      } else transaction.update(ref,{...state,updatedAt:Date.now()});
      return {id,...state};
    }
    if (action === 'reminders.delete') {
      if (recurring && parsed) {
        // Delete just this occurrence without changing the series: hide it as a
        // cancelled occurrence, while retaining all earlier payment history.
        const states = {...master.states,[String(index)]:{...master.states?.[String(index)],cancelled:true}};
        transaction.update(ref,{states,updatedAt:Date.now()});
        return {id,deleted:true};
      }
      transaction.delete(ref);
      return {id,deleted:true};
    }
    fail('reminder_action_not_found',404);
  });
}
