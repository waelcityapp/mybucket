import { randomUUID } from 'node:crypto';
import { getAdminFirestore } from './firebaseAdmin.js';
import { SubscriptionError } from './subscriptionService.js';
import { occurrenceDate, occurrenceId, parseOccurrenceId, isoDate, type Frequency, type OccurrenceChange, type OccurrenceOverride } from './recurrence.js';

type Kind = 'obligation' | 'receivable';
type Status = { done?: boolean; alertDisabled?: boolean; snoozedUntil?: string | null; cancelled?: boolean };
type Reminder = {
  id: string; kind: Kind; title: string; amount: number; currency: string; dueDate: string; note: string;
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
  return { title, amount, currency, note, dueDate: date(payload.dueDate), leadDays, tone, remindTime, repeat };
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
export async function reminderAction(uid: string, action: string, payload: Record<string, unknown>) {
  const col = getAdminFirestore().collection('users').doc(uid).collection('reminders');
  if (action === 'reminders.list') {
    const now = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' });
    const snapshot = await col.limit(250).get();
    const reminders = snapshot.docs.flatMap(doc => expand({ ...doc.data(), id:doc.id } as Reminder, now));
    return { reminders: reminders.sort((a,b) => a.dueDate.localeCompare(b.dueDate) || a.createdAt-b.createdAt).slice(0,500) };
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
          const changes = (master.changes || []).filter(x => x.fromIndex !== index);
          changes.push({ fromIndex:index, title:fields.title, amount:fields.amount, currency:fields.currency, note:fields.note, anchorDate:fields.dueDate, leadDays:fields.leadDays, tone:fields.tone, remindTime:fields.remindTime, repeat:fields.repeat });
          changes.sort((a,b)=>a.fromIndex-b.fromIndex);
          transaction.update(ref,{changes,updatedAt:Date.now()});
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
