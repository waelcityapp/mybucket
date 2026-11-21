import { useEffect, useState, type FormEvent } from 'react';
import { DEFAULT_PLAN_LIMITS, PLAN_LIMIT_KEYS, parsePlanLimits, type PlanLimitKey, type PlanLimitsDraft } from '../../config/planLimits';
import { auth } from '../../lib/firebase';
import type { Language } from '../../types';

type Fields = Record<PlanLimitKey, string>;
const toFields = (draft: PlanLimitsDraft) =>
  Object.fromEntries(PLAN_LIMIT_KEYS.map(key => [key, String(draft.limits[key])])) as Fields;

async function requestDraft(draft?: PlanLimitsDraft): Promise<PlanLimitsDraft> {
  const user = auth.currentUser;
  if (!user) throw new Error('authentication_required');
  const response = await fetch('/api/gateway', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await user.getIdToken() },
    body: JSON.stringify({ action: draft ? 'admin.planLimitsDraft.save' : 'admin.planLimitsDraft.get', payload: draft ?? {} }),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) throw new Error(result.error);
  return result.data;
}

export function AdminPlanLimitsView({ lang }: { lang: Language }) {
  const ar = lang === 'ar';
  const [draft, setDraft] = useState<PlanLimitsDraft | null>(null);
  const [fields, setFields] = useState<Fields | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'load-error' | 'save-error' | 'conflict' | 'saved' | null>(null);

  useEffect(() => {
    let active = true;
    requestDraft().then(result => {
      if (!active) return;
      setDraft(result);
      setFields(toFields(result));
    }).catch(() => { if (active) setStatus('load-error'); });
    return () => { active = false; };
  }, [attempt]);

  const rows: Array<{ label: string; basic?: PlanLimitKey; pro: PlanLimitKey }> = [
    { label: ar ? 'حفظ العمليات يوميًا' : 'Daily saved transactions', basic: 'basicEntries', pro: 'proAiEntries' },
    { label: ar ? 'عمليات إضافية بعد حصة الذكاء الاصطناعي' : 'Additional entries after the AI allowance', pro: 'proAdditionalEntries' },
    { label: ar ? 'الاستعلامات يوميًا' : 'Daily inquiries', basic: 'basicInquiries', pro: 'proInquiries' },
    { label: ar ? 'الحسابات' : 'Accounts', basic: 'basicAccounts', pro: 'proAccounts' },
    { label: ar ? 'بنود الصرف' : 'Expense categories', basic: 'basicCategories', pro: 'proCategories' },
    { label: ar ? 'البنود المفتوحة في كل قسم' : 'Open items per section', basic: 'basicOpenItems', pro: 'proOpenItems' },
    { label: ar ? 'التذكيرات النشطة في القسمين معًا' : 'Active reminders across both sections', basic: 'basicReminders', pro: 'proReminders' },
    { label: ar ? 'التصدير يوميًا لكل الصيغ' : 'Daily exports across formats', pro: 'proExports' },
  ];

  const limits = fields && parsePlanLimits(Object.fromEntries(PLAN_LIMIT_KEYS.map(key => [
    key, /^\d+$/.test(fields[key]) ? Number(fields[key]) : NaN,
  ])));
  const changed = draft && limits && PLAN_LIMIT_KEYS.some(key => draft.limits[key] !== limits[key]);
  const numberFormat = new Intl.NumberFormat(ar ? 'ar-EG' : 'en');

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || !limits || !changed || saving || status === 'conflict') return;
    setSaving(true);
    setStatus(null);
    try {
      const saved = await requestDraft({ limits, revision: draft.revision });
      setDraft(saved);
      setFields(toFields(saved));
      setStatus('saved');
    } catch (error) {
      setStatus(error instanceof Error && error.message === 'plan_limits_draft_changed' ? 'conflict' : 'save-error');
    } finally {
      setSaving(false);
    }
  }

  function reload() {
    setStatus(null);
    setFields(null);
    setDraft(null);
    setAttempt(value => value + 1);
  }

  function input(key: PlanLimitKey, label: string) {
    return (
      <input type="number" min="0" step="1" required inputMode="numeric" dir="ltr"
        aria-label={label} value={fields?.[key] ?? ''} disabled={saving}
        onChange={event => {
          const value = event.currentTarget.value;
          setFields(previous => previous && { ...previous, [key]: value });
          setStatus(previous => previous === 'conflict' ? previous : null);
        }}
        className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2 py-2 text-center text-base dark:border-slate-700 dark:bg-slate-900" />
    );
  }

  const differences = rows.flatMap(({ label, basic, pro }) => (
    [['Basic', basic], ['Pro', pro]] as const
  ).flatMap(([plan, key]) => key && limits && limits[key] !== DEFAULT_PLAN_LIMITS[key]
    ? [{ key, label, plan, before: DEFAULT_PLAN_LIMITS[key], after: limits[key] }]
    : []));

  return (
    <form onSubmit={save} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 sm:p-6">
      <h2 className="font-extrabold">{ar ? <>حدود <bdi>Basic وPro</bdi></> : 'Basic and Pro limits'}</h2>
      <p className="text-sm">{ar ? 'احفظ التعديلات كمسودة لمراجعتها. حدود المستخدمين لا تتغير عند الحفظ.' : 'Save your changes as a draft for review. Saving leaves user limits unchanged.'}</p>
      {fields && <table className="w-full table-fixed text-sm">
        <thead className="bg-emerald-50 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100">
          <tr>
            <th scope="col" className="w-1/2 p-2 text-start">{ar ? 'الميزة' : 'Feature'}</th>
            <th scope="col" className="p-2">Basic</th>
            <th scope="col" className="p-2">Pro</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
          {rows.map(({ label, basic, pro }) => (
            <tr key={pro}>
              <th scope="row" className="p-2 text-start font-semibold">{label}{pro === 'proAiEntries' && <span className="block text-xs font-normal">{ar ? 'Basic إجمالًا · Pro بالذكاء الاصطناعي' : 'Basic total · Pro AI-assisted'}</span>}</th>
              <td className="p-2 text-center">{basic ? input(basic, label + ' — Basic') : (ar ? 'غير متاح' : 'Unavailable')}</td>
              <td className="p-2">{input(pro, label + ' — Pro')}</td>
            </tr>
          ))}
        </tbody>
      </table>}
      {differences.length > 0 && <section className="space-y-2 rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-900">
        <h3 className="font-bold">{ar ? 'الفروق عن الحدود المتفق عليها' : 'Changes from the agreed limits'}</h3>
        <ul className="space-y-1">
          {differences.map(({ key, label, plan, before, after }) => (
            <li key={key}>{label} · <bdi>{plan}</bdi> · {ar ? `من ${numberFormat.format(before)} إلى ${numberFormat.format(after)}` : `${numberFormat.format(before)} to ${numberFormat.format(after)}`}</li>
          ))}
        </ul>
      </section>}
      {!fields && !status && <p role="status">{ar ? 'جارٍ تحميل المسودة…' : 'Loading draft…'}</p>}
      {status === 'saved' && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{ar ? 'تم حفظ المسودة.' : 'Draft saved.'}</p>}
      {status === 'save-error' && <p role="alert" className="text-sm">{ar ? 'تعذر حفظ المسودة. حاول مرة أخرى.' : 'Could not save the draft. Try again.'}</p>}
      {(status === 'load-error' || status === 'conflict') && <div role="alert" className="space-y-1 text-sm">
        <p>{status === 'conflict'
          ? (ar ? 'اتحفظت نسخة أحدث من المسودة. إعادة التحميل تستبدل تعديلات الصفحة بالنسخة المحفوظة.' : 'A newer draft was saved. Reloading replaces the edits on this page with the saved draft.')
          : (ar ? 'تعذر تحميل المسودة.' : 'Could not load the draft.')}</p>
        <button type="button" onClick={reload} className="min-h-11 font-bold underline">{ar ? 'إعادة التحميل' : 'Reload draft'}</button>
      </div>}
      {fields && <button type="submit" disabled={!changed || saving || status === 'conflict'}
        className="min-h-11 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
        {saving ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : (ar ? 'حفظ المسودة' : 'Save draft')}
      </button>}
    </form>
  );
}
