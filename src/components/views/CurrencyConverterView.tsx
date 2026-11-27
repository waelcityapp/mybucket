import { Fragment, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowLeftRight, ArrowRight, RefreshCw } from 'lucide-react';
import { auth } from '../../lib/firebase';
import { currencyName, SUPPORTED_CURRENCIES, type Language } from '../../types';

type FxRateInfo = { from: string; to: string; rate: number | null; remaining: number; limit: number; rateDate: string; stale: boolean; availableCurrencies?: string[] };
async function callCurrencyRates(action: 'fx.get' | 'fx.select', payload: Record<string, string> = {}): Promise<FxRateInfo> {
  const user = auth.currentUser;
  if (!user) throw new Error('login_required');
  const response = await fetch('/api/gateway', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await user.getIdToken() },
    body: JSON.stringify({ action, payload }),
  });
  const result = await response.json();
  if (!response.ok || !result?.ok || !result?.data) throw new Error(result?.error || 'rate_unavailable');
  return result.data as FxRateInfo;
}
async function readPublicReferenceRate(): Promise<{ rate: number; date: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 6500);
  try {
    const response = await fetch('https://api.frankfurter.dev/v2/rate/EGP/USD', { signal: controller.signal });
    if (!response.ok) throw new Error('reference_provider_http_' + response.status);
    const data: unknown = await response.json();
    if (!data || typeof data !== 'object') throw new Error('reference_provider_format');
    const record = data as { base?: string; quote?: string; rate?: number; date?: string };
    if (record.base !== 'EGP' || record.quote !== 'USD' || typeof record.rate !== 'number' || !Number.isFinite(record.rate) || record.rate <= 0) {
      throw new Error('reference_provider_invalid_rate');
    }
    return { rate: record.rate, date: typeof record.date === 'string' ? record.date : '' };
  } finally { clearTimeout(timeout); }
}
export function CurrencyConverterView({ lang, onBack }: { lang: Language; onBack: () => void }) {
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, []);
  const ar = lang === 'ar';
  const [info, setInfo] = useState<FxRateInfo | null>(null);
  const [reference, setReference] = useState<{ rate: number; date: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    setBusy(true);
    callCurrencyRates('fx.get').then(value => {
      if (alive) { setInfo(value); setReference(null); setError(''); }
    }).catch(async failure => {
      const code = failure instanceof Error ? failure.message : 'unknown_error';
      const serverIssue = ['firebase_admin_not_configured', 'firebase_project_mismatch', 'firebase_database_mismatch', 'gateway_operation_failed'].includes(code);
      try {
        const publicQuote = await readPublicReferenceRate();
        if (alive) {
          setReference(publicQuote);
          setError((serverIssue
            ? (ar ? 'اتصال الخادم يحتاج إصلاحًا؛ تغيير العملات متوقف مؤقتًا' : 'Server connection needs repair; pair selection paused')
            : (ar ? 'سعر مباشر مؤقت؛ تغيير العملات متوقف لحين اتصال الخادم' : 'Direct reference rate; pair selection paused until server reconnects')) + ' (' + code + ')');
        }
      } catch {
        if (alive) setError(serverIssue
          ? (ar ? 'تعذر الاتصال بخادم الأسعار' : 'Rate server unavailable')
          : (ar ? 'السعر غير متاح الآن' : 'Rate unavailable') + ' (' + code + ')');
      }
    }).finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [retry, ar]);
  // Keep the same server-backed currency selection and daily quota on this page.
  const changePair = async (from: string, to: string) => {
    if (!info || busy || info.remaining <= 0 || (info.from === from && info.to === to)) return;
    setBusy(true);
    try {
      const updated = await callCurrencyRates('fx.select', { from, to });
      setInfo(updated);
      setError('');
    } catch (e) {
      const limited = e instanceof Error && e.message === 'exchange_daily_limit';
      setError(limited ? (ar ? 'انتهى حد تغييرات اليوم' : 'Daily changes used up') : (ar ? 'تعذر تغيير العملة' : 'Could not change currency'));
    } finally { setBusy(false); }
  };
  const effectiveRate = info?.rate ?? reference?.rate;
  const rate = effectiveRate == null ? '—' : new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6, useGrouping: false }).format(effectiveRate);
  const selectedFrom = info?.from || 'EGP';
  const selectedTo = info?.to || 'USD';
  const canChange = !!info && !busy && info.remaining > 0;
  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button type="button" onClick={onBack}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2 text-sm font-bold text-emerald-800 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-500">
          {ar ? <ArrowRight size={16} aria-hidden="true" /> : <ArrowLeft size={16} aria-hidden="true" />}
          {ar ? 'رجوع' : 'Back'}
        </button>
        <h1 ref={heading} tabIndex={-1} className="scroll-mt-24 text-xl font-black text-slate-900">
          {ar ? 'محول العملات' : 'Currency converter'}
        </h1>
      </header>
      <section className="w-full min-w-0 overflow-hidden rounded-2xl border border-emerald-700/40 bg-gradient-to-r from-emerald-950 via-emerald-900 to-teal-800 px-3 py-3 text-white shadow-sm sm:px-4 sm:py-3.5" aria-label={ar ? 'أسعار العملات التقريبية' : 'Approximate currency rates'}>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-1.5 sm:gap-3">
          {(['from', 'to'] as const).map((side, index) => (
            <Fragment key={side}>
              {index === 1 && (
                <button type="button" disabled={!canChange || selectedFrom === selectedTo}
                  onClick={() => void changePair(selectedTo, selectedFrom)}
                  title={ar ? 'تبديل العملتين (يُحتسب من تغييرات اليوم)' : 'Swap currencies (counts as one daily change)'}
                  aria-label={ar ? 'تبديل العملة الأولى والثانية' : 'Swap first and second currencies'}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-emerald-400 bg-emerald-700 text-white shadow-sm transition-colors hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50 sm:h-10 sm:w-10">
                  <ArrowLeftRight className="h-4 w-4" />
                </button>
              )}
              <label className="flex min-w-0 flex-col gap-1">
                <span className="text-[10px] font-bold text-emerald-100 sm:text-xs">{side === 'from' ? (ar ? 'من' : 'From') : (ar ? 'إلى' : 'To')}</span>
                <select value={side === 'from' ? selectedFrom : selectedTo}
                  onChange={event => void changePair(side === 'from' ? event.target.value : selectedFrom, side === 'to' ? event.target.value : selectedTo)}
                  aria-label={side === 'from' ? (ar ? 'اختر العملة الأولى' : 'Choose first currency') : (ar ? 'اختر العملة الثانية' : 'Choose second currency')}
                  disabled={!canChange}
                  className="h-9 w-full min-w-0 rounded-xl border border-emerald-400/50 bg-emerald-950 px-1.5 text-[11px] font-bold text-white outline-none focus:border-emerald-200 focus:ring-1 focus:ring-emerald-200 disabled:opacity-70 sm:h-10 sm:px-3 sm:text-sm">
                  {SUPPORTED_CURRENCIES.filter(code => !info?.availableCurrencies || info.availableCurrencies.includes(code) || info[side] === code)
                    .map(code => <option key={code} value={code}>{code} · {currencyName(code, lang)}</option>)}
                </select>
              </label>
            </Fragment>
          ))}
        </div>
        <strong dir="ltr" className="mt-2.5 block min-w-0 break-words rounded-xl bg-emerald-700/65 px-2 py-2 text-center text-sm font-black leading-snug tracking-tight text-white tabular-nums sm:text-lg">
          {info ? '1 ' + selectedFrom + ' = ' + rate + ' ' + selectedTo : reference ? '1 EGP = ' + rate + ' USD' : busy ? '...' : '—'}
        </strong>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[10px] leading-snug text-emerald-100">
          <span>
            {ar ? 'سعر تقريبي غير ملزم' : 'Approximate rate'}
            {(info?.rateDate || reference?.date) ? ' · ' + (info?.rateDate || reference?.date) : ''}
          </span>
          {info && <span className="font-semibold">{ar ? 'تغييرات متبقية' : 'Changes left'}: {info.remaining}/{info.limit}</span>}
          {info?.stale && <span className="text-amber-200">{ar ? 'آخر سعر محفوظ' : 'Cached rate'}</span>}
        </div>
        {error && <button type="button" onClick={() => setRetry(value => value + 1)} className="mt-2 flex w-full items-center justify-center gap-1 break-words text-center text-[10px] leading-tight text-rose-100"><RefreshCw className="h-3 w-3 shrink-0"/>{error}</button>}
      </section>
    </div>
  );
}
