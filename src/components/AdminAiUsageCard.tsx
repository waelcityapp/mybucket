import React, { useCallback, useEffect, useState } from 'react';
import { Activity, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { auth } from '../lib/firebase';
import type { Language } from '../types';

type UsageSummary = { requests?: number; inputTokens?: number; outputTokens?: number; totalTokens?: number };
type ModelUsage = UsageSummary & { model?: string };
type DiagnosticData = {
  success: boolean;
  model: string;
  reply?: string;
  totalTokens?: number | null;
  trackingRecorded?: boolean;
  httpStatus?: number | null;
  googleStatus?: string | null;
  reason?: string;
};
type UsageData = { month: string; trackingStarted: boolean; summary: UsageSummary | null; models: ModelUsage[]; source: string; note: string };

export interface AdminAiUsageCardProps {
  lang?: Language;
  className?: string;
  onModelChange?: (modelId: string) => void;
}

export const AdminAiUsageCard: React.FC<AdminAiUsageCardProps> = ({ lang = 'ar', className = '' }) => {
  const ar = lang === 'ar';
  const [data, setData] = useState<UsageData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [diagnosing, setDiagnosing] = useState(false);
  const [diagnostic, setDiagnostic] = useState<DiagnosticData | null>(null);
  const [diagnosticError, setDiagnosticError] = useState<string | null>(null);

  const testConnection = async () => {
    if (diagnosing) return;
    setDiagnosing(true);
    setDiagnostic(null);
    setDiagnosticError(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error(ar ? 'يجب تسجيل الدخول أولًا' : 'Sign in required');
      const token = await user.getIdToken();
      const response = await fetch('/api/gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'admin.aiDiagnose', payload: {} }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || result.error || 'Connectivity test unavailable');
      setDiagnostic(result.data as DiagnosticData);
      if (result.data?.success && result.data?.trackingRecorded) void refresh();
    } catch (err) {
      setDiagnosticError(err instanceof Error ? err.message : String(err));
    } finally {
      setDiagnosing(false);
    }
  };

  const diagnosisMessage = (reason?: string) => {
    const arMessages: Record<string, string> = {
      missing_key: 'مفتاح Gemini غير متاح لخادم Vercel.',
      invalid_key: 'مفتاح Gemini غير صالح أو مرفوض.',
      billing_or_eligibility: 'قد تكون هناك متطلبات فوترة أو أهلية استخدام للمشروع لدى Google.',
      invalid_request: 'Google رفضت صيغة الطلب البسيط.',
      permission: 'Google رفضت صلاحيات الوصول للمشروع أو المفتاح.',
      quota: 'وصل المشروع إلى حد الاستخدام أو الحصة المتاحة.',
      model_unavailable: 'النموذج غير متاح لهذا المشروع أو المفتاح.',
      timeout: 'انتهت مهلة الاتصال بجوجل.',
      unknown: 'فشل الطلب؛ السبب التفصيلي غير متاح بأمان.',
    };
    const enMessages: Record<string, string> = {
      missing_key: 'Gemini API key is missing on the server.',
      invalid_key: 'Gemini API key was rejected.',
      billing_or_eligibility: 'Google billing or project eligibility may be required.',
      invalid_request: 'Google rejected the minimal request.',
      permission: 'Google rejected project or API key permissions.',
      quota: 'Project quota or rate limit was reached.',
      model_unavailable: 'This model is unavailable for the project.',
      timeout: 'Connection timed out.',
      unknown: 'The request failed; detailed cause is not safely available.',
    };
    return (ar ? arMessages : enMessages)[reason || 'unknown'] || (ar ? arMessages.unknown : enMessages.unknown);
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const user = auth.currentUser;
      if (!user) throw new Error(ar ? 'يجب تسجيل الدخول أولًا' : 'Sign in required');
      const token = await user.getIdToken();
      const response = await fetch('/api/gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'admin.aiUsage', payload: {} }),
      });
      const result = await response.json();
      if (!response.ok || !result.ok) throw new Error(result.message || result.error || 'Could not read usage');
      setData(result.data);
    } catch (err) {
      setData(null);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }, [ar]);

  useEffect(() => { void refresh(); }, [refresh]);
  const fmt = (value?: number) => typeof value === 'number' ? value.toLocaleString('en-US') : '—';

  return <section className={`rounded-2xl border border-slate-200 bg-white p-4 space-y-4 ${className}`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h2 className="font-extrabold text-slate-900">{ar ? 'استهلاك Gemini AI الفعلي' : 'Actual Gemini AI usage'}</h2>
        <p className="text-xs text-slate-500">{ar ? 'بيانات الطلبات المسجلة على الخادم، وليست تقديرات تجريبية' : 'Recorded server-side usage, not simulated figures'}</p>
      </div>
      <button type="button" disabled={loading} onClick={() => void refresh()} className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-50">
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />{ar ? 'تحديث' : 'Refresh'}
      </button>
    </div>
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-bold text-slate-900">{ar ? 'اختبار اتصال Gemini' : 'Test Gemini connection'}</p>
          <p className="text-xs text-slate-600">{ar ? 'اختبار بسيط من الخادم بدون أي معلومات مالية، للأدمن فقط.' : 'Minimal server-side test, without financial data. Admin only.'}</p>
        </div>
        <button type="button" disabled={diagnosing} onClick={() => void testConnection()}
          className="rounded-lg bg-indigo-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
          {diagnosing ? (ar ? 'جاري الاختبار...' : 'Testing...') : (ar ? 'اختبار اتصال Gemini' : 'Test Gemini connection')}
        </button>
      </div>
      {diagnosticError && <p role="alert" className="text-xs text-rose-700">{diagnosticError}</p>}
      {diagnostic && <div role="status" className={`rounded-lg border p-3 text-sm ${diagnostic.success ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : 'bg-amber-50 border-amber-200 text-amber-900'}`}>
        <p className="font-extrabold">{diagnostic.success ? (ar ? 'نجح اتصال Gemini' : 'Gemini connection succeeded') : (ar ? 'فشل اتصال Gemini' : 'Gemini connection failed')}</p>
        <p className="mt-1">{diagnostic.success ? (ar ? 'ردت Google بنجاح على الطلب التجريبي.' : 'Google answered the test request.') : diagnosisMessage(diagnostic.reason)}</p>
        <p className="mt-1 text-xs" dir="ltr">Model: {diagnostic.model} {diagnostic.httpStatus ? ` | HTTP: ${diagnostic.httpStatus}` : ''} {diagnostic.googleStatus ? ` | Google: ${diagnostic.googleStatus}` : ''}</p>
        {diagnostic.success && <p className="mt-1 text-xs">{ar ? 'التوكنات' : 'Tokens'}: {fmt(diagnostic.totalTokens ?? undefined)} · {diagnostic.trackingRecorded ? (ar ? 'تم تسجيلها في العداد' : 'Recorded in usage dashboard') : (ar ? 'تعذر تأكيد تسجيلها في العداد' : 'Usage recording could not be confirmed')}</p>}
      </div>}
    </div>
    {error && <div role="alert" className="flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-900"><AlertCircle className="h-4 w-4 shrink-0" />{ar ? 'تعذر جلب بيانات الاستهلاك الحقيقية: ' : 'Could not load actual usage: '}{error}</div>}
    {!error && !data && <p className="text-sm text-slate-500">{loading ? (ar ? 'جاري قراءة البيانات...' : 'Loading usage...') : (ar ? 'لا توجد بيانات مؤكدة' : 'No confirmed data')}</p>}
    {data && <>
      <p className="text-xs text-slate-600">{ar ? 'الشهر' : 'Month'}: <strong dir="ltr">{data.month}</strong></p>
      {!data.trackingStarted ? <p className="rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{ar ? 'لم يتم تسجيل استهلاك بعد بدء نظام القياس. الاستهلاك السابق غير متاح هنا.' : 'No usage recorded since tracking began. Historical usage is unavailable here.'}</p> :
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          [ar ? 'طلبات ناجحة' : 'Successful requests', fmt(data.summary?.requests)],
          [ar ? 'توكنات إدخال' : 'Input tokens', fmt(data.summary?.inputTokens)],
          [ar ? 'توكنات إخراج' : 'Output tokens', fmt(data.summary?.outputTokens)],
          [ar ? 'إجمالي التوكنات' : 'Total tokens', fmt(data.summary?.totalTokens)],
        ].map(([label, value]) => <div key={label} className="rounded-xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-base font-black text-slate-900" dir="ltr">{value}</p></div>)}
      </div>}
      {data.models.length > 0 && <div className="space-y-2"><h3 className="text-sm font-bold text-slate-800">{ar ? 'النماذج المستخدمة فعليًا' : 'Models actually used'}</h3>{data.models.map(m => <div key={m.model} className="flex flex-wrap justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs"><span dir="ltr">{m.model}</span><span>{fmt(m.totalTokens)} {ar ? 'توكن' : 'tokens'} · {fmt(m.requests)} {ar ? 'طلب' : 'requests'}</span></div>)}</div>}
      <p className="text-xs leading-6 text-slate-500">{ar ? 'القياس يبدأ من تفعيل التسجيل على الخادم. لا يشمل الطلبات السابقة أو الطلبات الفاشلة. التكلفة والفاتورة الفعلية تُراجع من Google Cloud.' : 'Tracking begins when server telemetry is deployed. Earlier and failed requests are not included. Check Google Cloud for actual billing.'}</p>
    </>}
    <a href="https://console.cloud.google.com/billing" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-sm font-bold text-indigo-700 underline"><Activity className="h-4 w-4" />{ar ? 'الفواتير الفعلية في Google Cloud' : 'Actual Google Cloud billing'}<ExternalLink className="h-3.5 w-3.5" /></a>
  </section>;
};
