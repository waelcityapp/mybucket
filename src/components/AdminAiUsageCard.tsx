import React, { useCallback, useEffect, useState } from 'react';
import { Activity, AlertCircle, RefreshCw, ExternalLink } from 'lucide-react';
import { auth } from '../lib/firebase';
import type { Language } from '../types';

type UsageSummary = { requests?: number; inputTokens?: number; outputTokens?: number; totalTokens?: number };
type ModelUsage = UsageSummary & { model?: string };
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
