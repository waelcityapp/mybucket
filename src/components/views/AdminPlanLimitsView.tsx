import { useEffect, useState, type FormEvent } from 'react';
import { DEFAULT_PLAN_LIMITS, fetchPublishedPlanLimits, PLAN_LIMIT_KEYS, parsePlanLimits, type PublishedPlanPresentation, type PlanLimitKey, type PlanLimitsDraft } from '../../config/planLimits';
import { PLAN_FEATURE_IDS, planLimitFeatures, type PlanFeatureCopy, type PlanFeatureId } from '../../config/planLimitFeatures';
import { auth } from '../../lib/firebase';
import type { Language } from '../../types';

type Fields = Record<PlanLimitKey, string>;
const toFields = (draft: PlanLimitsDraft) =>
  Object.fromEntries(PLAN_LIMIT_KEYS.map(key => [key, String(draft.limits[key])])) as Fields;

async function requestPlanSettings<T>(action: string, payload: Record<string, unknown> = {}): Promise<T> {
  const user = auth.currentUser;
  if (!user) throw new Error('authentication_required');
  const response = await fetch('/api/gateway', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await user.getIdToken() },
    body: JSON.stringify({ action, payload }),
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
  const [published, setPublished] = useState<PublishedPlanPresentation | null>(null);
  const [copy, setCopy] = useState<PlanFeatureCopy>({});
  const [copyLanguage, setCopyLanguage] = useState<Language>(lang);
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [status, setStatus] = useState<'load-error' | 'save-error' | 'conflict' | 'saved' | 'published' | 'publish-error' | null>(null);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    Promise.all([
      requestPlanSettings<PlanLimitsDraft>('admin.planLimitsDraft.get'),
      fetchPublishedPlanLimits(controller.signal),
    ]).then(([result, publicLimits]) => {
      if (!active) return;
      setDraft(result);
      setPublished(publicLimits);
      setFields(toFields(result));
      setCopy(result.copy);
    }).catch(() => { if (active) setStatus('load-error'); });
    return () => { active = false; controller.abort(); };
  }, [attempt]);

  const rows: Array<{ label: string; basic?: PlanLimitKey; pro: PlanLimitKey }> = [
    { label: ar ? 'حصة العمليات اليومية' : 'Daily transaction allowance', basic: 'basicEntries', pro: 'proAiEntries' },
    { label: ar ? 'الحفظ اليدوي أو بعد التحليل المحلي' : 'Saves by manual entry or local analysis', pro: 'proAdditionalEntries' },
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
  const sameCopy = (a: PlanFeatureCopy, b: PlanFeatureCopy) =>
    PLAN_FEATURE_IDS.every(id => JSON.stringify(a[id]) === JSON.stringify(b[id]));
  const changed = draft && limits && (
    PLAN_LIMIT_KEYS.some(key => draft.limits[key] !== limits[key]) || !sameCopy(draft.copy, copy)
  );
  const numberFormat = new Intl.NumberFormat(ar ? 'ar-EG' : 'en');

  async function save(event: FormEvent) {
    event.preventDefault();
    if (!draft || !limits || !changed || saving || status === 'conflict') return;
    setSaving(true);
    setStatus(null);
    try {
      const saved = await requestPlanSettings<PlanLimitsDraft>('admin.planLimitsDraft.save', { limits, copy, revision: draft.revision });
      setDraft(saved);
      setFields(toFields(saved));
      setCopy(saved.copy);
      setStatus('saved');
    } catch (error) {
      setStatus(error instanceof Error && error.message === 'plan_limits_draft_changed' ? 'conflict' : 'save-error');
    } finally {
      setSaving(false);
    }
  }

  async function publish() {
    if (!draft || !publishable || !confirmPublish) return;
    setSaving(true);
    setConfirmPublish(false);
    setStatus(null);
    try {
      const next = await requestPlanSettings<PublishedPlanPresentation>('admin.planLimitsDraft.publish', { revision: draft.revision });
      setPublished(next);
      setStatus('published');
    } catch (error) {
      setStatus(error instanceof Error && error.message === 'plan_limits_draft_changed' ? 'conflict' : 'publish-error');
    } finally {
      setSaving(false);
    }
  }

  function reload() {
    setStatus(null);
    setConfirmPublish(false);
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
          setConfirmPublish(false);
          setFields(previous => previous && { ...previous, [key]: value });
          setStatus(previous => previous === 'conflict' ? previous : null);
        }}
        className="w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2 py-2 text-center text-base dark:border-slate-700 dark:bg-slate-900" />
    );
  }

  function changeCopy(id: PlanFeatureId, order: number, field: 'title' | 'detail' | 'order', value: string) {
    setConfirmPublish(false);
    setStatus(previous => previous === 'conflict' ? previous : null);
    setCopy(previous => {
      const item = previous[id] ?? { ar: { title: '', detail: '' }, en: { title: '', detail: '' }, order };
      const next = field === 'order'
        ? { ...item, order: Number(value) }
        : { ...item, [copyLanguage]: { ...item[copyLanguage], [field]: value } };
      return { ...previous, [id]: next };
    });
  }

  const differences = rows.flatMap(({ label, basic, pro }) => (
    [['Basic', basic], ['Pro', pro]] as const
  ).flatMap(([plan, key]) => key && limits && published && limits[key] !== published.limits[key]
    ? [{ key, label, plan, before: published.limits[key], after: limits[key] }]
    : []));

  const publishable = Boolean(draft && limits && published && !changed && (!published.active || differences.length || !sameCopy(copy, published.copy)) && !saving && status !== 'conflict');

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
              <th scope="row" className="p-2 text-start font-semibold">{label}{pro === 'proAiEntries' && <span className="block text-xs font-normal">{ar ? 'Basic عمليات محفوظة · Pro محاولات الذكاء الاصطناعي' : 'Basic saved transactions · Pro AI attempts'}</span>}</th>
              <td className="p-2 text-center">{basic ? input(basic, label + ' — Basic') : (ar ? 'غير متاح' : 'Unavailable')}</td>
              <td className="p-2">{input(pro, label + ' — Pro')}</td>
            </tr>
          ))}
        </tbody>
      </table>}
      {differences.length > 0 && <section className="space-y-2 rounded-xl bg-slate-100 p-3 text-sm dark:bg-slate-900">
        <h3 className="font-bold">{ar ? 'الفروق عن الحدود المنشورة' : 'Changes from published limits'}</h3>
        <ul className="space-y-1">
          {differences.map(({ key, label, plan, before, after }) => (
            <li key={key}>{label} · <bdi>{plan}</bdi> · {ar ? `من ${numberFormat.format(before)} إلى ${numberFormat.format(after)}` : `${numberFormat.format(before)} to ${numberFormat.format(after)}`}</li>
          ))}
        </ul>
      </section>}
      {fields && <details className="space-y-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <summary className="min-h-8 cursor-pointer text-sm font-bold">{ar ? 'نصوص صفحة الاشتراكات' : 'Subscription page copy'}</summary>
        <label className="block text-sm">{ar ? 'لغة النص' : 'Content language'}
          <select className="ms-2 rounded-lg border p-2 dark:bg-slate-900" value={copyLanguage}
            onChange={event => setCopyLanguage(event.currentTarget.value === 'ar' ? 'ar' : 'en')}>
            <option value="ar">العربية</option><option value="en">English</option>
          </select>
        </label>
        {planLimitFeatures(copyLanguage, DEFAULT_PLAN_LIMITS).map(({ id, label }, index) => (
          <fieldset key={id} className="grid gap-2 rounded-lg border p-3 text-sm sm:grid-cols-2" disabled={saving}>
            <legend className="font-bold">{label}</legend>
            <label>{ar ? 'عنوان الميزة' : 'Feature title'}
              <input className="mt-1 w-full rounded-lg border p-2 dark:bg-slate-900" maxLength={80}
                dir={copyLanguage === 'ar' ? 'rtl' : 'ltr'} placeholder={label}
                value={copy[id]?.[copyLanguage].title ?? ''}
                onChange={event => changeCopy(id, index + 1, 'title', event.currentTarget.value)} />
            </label>
            <label>{ar ? 'ترتيب الظهور' : 'Display order'}
              <select className="mt-1 w-full rounded-lg border p-2 dark:bg-slate-900"
                value={copy[id]?.order ?? index + 1}
                onChange={event => changeCopy(id, index + 1, 'order', event.currentTarget.value)}>
                {PLAN_FEATURE_IDS.map((feature, position) => <option key={feature} value={position + 1}>{position + 1}</option>)}
              </select>
            </label>
            <label className="sm:col-span-2">{ar ? 'وصف إضافي' : 'Additional description'}
              <textarea className="mt-1 w-full rounded-lg border p-2 dark:bg-slate-900" maxLength={240}
                dir={copyLanguage === 'ar' ? 'rtl' : 'ltr'} value={copy[id]?.[copyLanguage].detail ?? ''}
                onChange={event => changeCopy(id, index + 1, 'detail', event.currentTarget.value)} />
            </label>
          </fieldset>
        ))}
      </details>}
      {limits && <details className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
        <summary className="min-h-8 cursor-pointer text-sm font-bold">{ar ? 'معاينة عرض الحدود للمستخدم' : 'Preview customer-facing limits'}</summary>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {(['basic', 'pro'] as const).map(plan => (
            <section key={plan} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <h3 className="font-bold">{plan === 'basic' ? 'Basic' : 'Pro'}</h3>
              <dl className="mt-2 space-y-2 text-sm">
                {planLimitFeatures(lang, limits, copy).map(feature => (
                  <div key={feature.id}>
                    <dt className="font-semibold">{feature.label}</dt>
                    <dd>{feature[plan]}</dd>
                    {feature.detail && <dd>{feature.detail}</dd>}
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </details>}
      {!fields && !status && <p role="status">{ar ? 'جارٍ تحميل المسودة…' : 'Loading draft…'}</p>}
      {status === 'saved' && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300">{ar ? 'تم حفظ المسودة.' : 'Draft saved.'}</p>}
      {status === 'save-error' && <p role="alert" className="text-sm">{ar ? 'تعذر حفظ المسودة. حاول مرة أخرى.' : 'Could not save the draft. Try again.'}</p>}
      {(status === 'load-error' || status === 'conflict') && <div role="alert" className="space-y-1 text-sm">
        <p>{status === 'conflict'
          ? (ar ? 'اتحفظت نسخة أحدث من المسودة. إعادة التحميل تستبدل تعديلات الصفحة بالنسخة المحفوظة.' : 'A newer draft was saved. Reloading replaces the edits on this page with the saved draft.')
          : (ar ? 'تعذر تحميل المسودة.' : 'Could not load the draft.')}</p>
        <button type="button" onClick={reload} className="min-h-11 font-bold underline">{ar ? 'إعادة التحميل' : 'Reload draft'}</button>
      </div>}
      {status === 'published' && <p role="status">{ar ? 'تم نشر الحدود.' : 'Plan limits published.'}</p>}
      {status === 'publish-error' && <p role="alert">{ar ? 'تعذّر نشر الحدود.' : 'Could not publish plan limits.'}</p>}
      {publishable && <div className="space-y-2 text-sm">
        <label className="flex items-start gap-2">
          <input type="checkbox" checked={confirmPublish} onChange={event => setConfirmPublish(event.currentTarget.checked)} />
          {ar ? 'أؤكد نشر الحدود المحفوظة للمستخدمين.' : 'Confirm publishing the saved limits to customers.'}
        </label>
        <button type="button" onClick={publish} disabled={!confirmPublish}
          className="min-h-11 rounded-xl bg-emerald-700 px-4 py-2 font-bold text-white disabled:opacity-50">
          {ar ? 'نشر الحدود' : 'Publish limits'}
        </button>
      </div>}
      {fields && <button type="submit" disabled={!changed || saving || status === 'conflict'}
        className="min-h-11 rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
        {saving ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : (ar ? 'حفظ المسودة' : 'Save draft')}
      </button>}
    </form>
  );
}
