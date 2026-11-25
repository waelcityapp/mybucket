import { useEffect, useState } from 'react';
import { BarChart3, RefreshCw } from 'lucide-react';
import { fetchSiteVisits, type SiteVisits } from '../services/siteVisitsClient';
import type { Language } from '../types';
import { siteVisitDay } from '../utils/siteVisitDay';

export function AdminSiteVisitsCard({ lang }: { lang: Language }) {
  const ar = lang === 'ar';
  const today = siteVisitDay();
  const [date, setDate] = useState(today);
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<SiteVisits | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let current = true;
    setResult(null);
    setFailed(false);
    fetchSiteVisits(date).then(
      visits => { if (current) setResult(visits); },
      () => { if (current) setFailed(true); },
    );
    return () => { current = false; };
  }, [date, refresh]);

  return (
    <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
      <h2 className="flex items-center gap-2 font-extrabold text-slate-900 dark:text-slate-100">
        <BarChart3 className="h-5 w-5 text-emerald-600" aria-hidden="true" />
        {ar ? 'زيارات الموقع' : 'Site visits'}
      </h2>
      <div className="flex flex-wrap items-end gap-2">
        <label className="space-y-1 text-sm text-slate-600 dark:text-slate-300">
          <span className="block">{ar ? 'التاريخ بتوقيت القاهرة' : 'Date in Cairo time'}</span>
          <input type="date" dir="ltr" value={date} max={today}
            onChange={event => { if (event.target.value) setDate(event.target.value); }}
            className="rounded-lg border border-slate-300 bg-transparent px-2 py-1.5 dark:border-slate-600 dark:[color-scheme:dark]" />
        </label>
        <button type="button" onClick={() => setRefresh(value => value + 1)}
          className="flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200">
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          {ar ? 'تحديث' : 'Refresh'}
        </button>
      </div>
      <div className="flex flex-wrap items-baseline gap-2" aria-live="polite">
        {result?.date === date ? <>
          <strong className="text-3xl font-extrabold tabular-nums text-emerald-700 dark:text-emerald-400">
            {new Intl.NumberFormat(ar ? 'ar-EG' : 'en').format(result.visitors)}
          </strong>
          <span className="text-sm text-slate-700 dark:text-slate-200">{ar ? 'معرّف متصفح زار الموقع' : 'browser IDs recorded'}</span>
        </> : <span className="text-sm text-slate-600 dark:text-slate-300">
          {failed ? (ar ? 'تعذّر تحميل العدد. جرّب التحديث.' : 'Could not load the count. Try refreshing.') : (ar ? 'جارٍ تحميل العدد…' : 'Loading visit count…')}
        </span>}
      </div>
      {result?.date === date && <dl className="grid gap-2 sm:grid-cols-2">
        {[
          [ar ? 'متصفحات أضافت عملية في التجربة' : 'Browsers that added a demo transaction', result.demoUsers],
          [ar ? 'حسابات استخدمت التطبيق في اليوم ده' : 'Accounts that used the app on this date', result.activeAccounts],
          [ar ? 'حسابات حفظت أول مصروف لها في اليوم ده' : 'Accounts that saved their first expense on this date', result.firstExpenseAccounts],
          [ar ? 'منهم رجعوا في يوم لاحق' : 'Of those accounts, returned on a later day', result.returningExpenseAccounts],
        ].map(([label, value]) => <div key={label} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800">
          <dt className="text-xs text-slate-600 dark:text-slate-300">{label}</dt>
          <dd className="text-xl font-bold tabular-nums">{value === null ? '—' : new Intl.NumberFormat(ar ? 'ar-EG' : 'en').format(Number(value))}</dd>
        </div>)}
      </dl>}
      <p className="text-sm text-slate-600 dark:text-slate-300">
        {ar ? 'إعادة تحميل الصفحة بنفس معرّف المتصفح ما بتزوّدش العدد. جهاز أو متصفح مختلف أو مسح بيانات الموقع ممكن يتحسب بمعرّف تاني. زيارات الإدارة داخلة في العدد.' : 'Reloads with the same browser ID count once per day. Other devices, browsers, or cleared site data can create new IDs. Admin visits are included.'}
      </p>
      {result?.date === date && date <= result.activityReportingStart && <p className="text-xs text-slate-500">
        {ar ? 'عداد الاستخدام يشمل الإجراءات اللي اتسجلت بعد تفعيله.' : 'Activity includes actions recorded since tracking was enabled.'}
      </p>}
    </section>
  );
}
