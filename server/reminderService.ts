import { randomUUID } from 'node:crypto';
import { getAdminFirestore } from './firebaseAdmin.js';
import { SubscriptionError } from './subscriptionService.js';

export type ReminderKind = 'obligation' | 'receivable';
type Reminder = { id: string; kind: ReminderKind; title: string; amount: number; currency: string; dueDate: string; note: string; done: boolean; leadDays: number; tone: number; createdAt: number; updatedAt: number };

function fail(code: string, statusCode = 400): never { throw new SubscriptionError(statusCode, code, code); }
function safeKind(value: unknown): ReminderKind { if (value === 'obligation' || value === 'receivable') return value; return fail('invalid_reminder_kind'); }
const currencies = new Set(['EGP', 'USD', 'EUR', 'SAR', 'AED', 'GBP', 'KWD', 'QAR']);
function validateDate(value: unknown): string {
  const date = String(value ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date + 'T00:00:00Z')) || new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date) fail('invalid_due_date');
  return date;
}
function normalized(payload: Record<string, unknown>) {
  const title = String(payload.title ?? '').trim().slice(0, 120);
  const amount = Number(payload.amount);
  const currency = String(payload.currency ?? 'EGP');
  const note = String(payload.note ?? '').trim().slice(0, 500);
  if (!title) fail('reminder_title_required');
  if (!Number.isFinite(amount) || amount < 0 || amount > 1_000_000_000_000) fail('invalid_reminder_amount');
  if (!currencies.has(currency)) fail('invalid_reminder_currency');
  // Optional for existing records created before reminder alarms were introduced.
  const leadDays = payload.leadDays === undefined ? 7 : Number(payload.leadDays);
  const tone = payload.tone === undefined ? 1 : Number(payload.tone);
  if (!Number.isInteger(leadDays) || leadDays < 0 || leadDays > 365) fail('invalid_reminder_days');
  if (!Number.isInteger(tone) || tone < 1 || tone > 4) fail('invalid_reminder_tone');
  return { title, amount, currency, note, dueDate: validateDate(payload.dueDate), leadDays, tone };
}
export async function reminderAction(uid: string, action: string, payload: Record<string, unknown>) {
  const ref = getAdminFirestore().collection('users').doc(uid).collection('reminders');
  if (action === 'reminders.list') {
    const result = await ref.limit(250).get();
    const reminders = result.docs.map(doc => ({ ...doc.data(), id: doc.id } as Reminder));
    return { reminders: reminders.sort((a, b) => a.dueDate.localeCompare(b.dueDate) || a.createdAt - b.createdAt) };
  }
  if (action === 'reminders.create') {
    const kind = safeKind(payload.kind);
    const fields = normalized(payload);
    const doc = ref.doc(randomUUID());
    const now = Date.now();
    const item: Reminder = { id: doc.id, kind, ...fields, done: false, createdAt: now, updatedAt: now };
    await doc.set(item);
    return { reminder: item };
  }
  const id = String(payload.id ?? '');
  if (!/^[a-f0-9-]{36}$/.test(id)) fail('invalid_reminder_id');
  const doc = ref.doc(id);
  const snapshot = await doc.get();
  if (!snapshot.exists) fail('reminder_not_found', 404);
  if (action === 'reminders.update') {
    const fields = normalized(payload);
    const existingKind = safeKind(snapshot.data()?.kind);
    const kind = payload.kind === undefined ? existingKind : safeKind(payload.kind);
    const done = typeof payload.done === 'boolean' ? payload.done : !!snapshot.data()?.done;
    await doc.update({ ...fields, kind, done, updatedAt: Date.now() });
    return { id, updated: true };
  }
  if (action === 'reminders.toggle') {
    if (typeof payload.done !== 'boolean') fail('invalid_reminder_state');
    await doc.update({ done: payload.done, updatedAt: Date.now() });
    return { id, done: payload.done };
  }
  if (action === 'reminders.delete') {
    await doc.delete();
    return { id, deleted: true };
  }
  fail('reminder_action_not_found', 404);
}
