import React, { useEffect, useState } from 'react';
import { Clock, Zap } from 'lucide-react';
import { UserSubscription } from '../types/prototypeSubscription';
import { calculateRemainingTrialDays } from '../utils/subscriptionUtils';
import { Language } from '../types';
import { activeGrant } from '../config/grantPolicy';
import { stageFor } from '../config/subscriptionPolicy';

type Bucket = { used: number; limit: number; remaining: number };
type UsageStatus = { day: string; plan: 'basic' | 'pro' | 'expired'; local?: { entries: Bucket; inquiries: Bucket }; gemini?: { entries: Bucket; inquiries: Bucket } };

interface SubscriptionCardProps {
  subscription: UserSubscription | null;
  lang: Language;
}

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  subscription,
  lang,
}) => {
  const [usage, setUsage] = useState<UsageStatus | null>(null);
  const [usageError, setUsageError] = useState(false);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageRetry, setUsageRetry] = useState(0);
  useEffect(() => {
    let active = true;
    let requestNumber = 0;
    const load = async () => {
      const currentRequest = ++requestNumber;
      setUsageLoading(true); setUsageError(false); setUsage(null);
      try {
        const { auth } = await import('../lib/firebase');
        const user = auth.currentUser;
        if (!user) throw new Error('authentication_required');
        const response = await fetch('/api/gateway', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ action: 'ai.quota.status', payload: {} }) });
        const body = await response.json();
        if (!response.ok || !body?.ok || !body.data) throw new Error('usage_unavailable');
        if (active && currentRequest === requestNumber) setUsage(body.data as UsageStatus);
      } catch { if (active && currentRequest === requestNumber) setUsageError(true); }
      finally { if (active && currentRequest === requestNumber) setUsageLoading(false); }
    };
    void load();
    const refreshWhenVisible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => { active = false; document.removeEventListener('visibilitychange', refreshWhenVisible); };
  }, [subscription?.tier, subscription?.grant?.plan, subscription?.grant?.endsAt, usageRetry]);

  const isAr = lang === 'ar';
  if (!subscription) return null;

  const remainingDays = calculateRemainingTrialDays(subscription);
  const grant = stageFor(subscription) !== 'paid' ? activeGrant(subscription.grant) : null;
  const grantDays = grant ? Math.max(0, Math.ceil((Date.parse(grant.endsAt) - Date.now()) / 86400000)) : null;


  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <Zap className="w-4 h-4 text-amber-500" />
          <span>{isAr ? 'خطة الاشتراك وفترة التجربة' : 'Subscription & Trial Plan'}</span>
        </div>
        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
            grant || subscription.isPaid
              ? 'bg-emerald-100 text-emerald-800'
              : remainingDays > 0
              ? 'bg-amber-100 text-amber-900'
              : 'bg-rose-100 text-rose-800'
          }`}
        >
          {grant
            ? (isAr ? `منحة ${grant.plan === 'pro' ? 'Pro' : 'Basic'} مجانية (${grantDays} يوم)` : `Free ${grant.plan} grant (${grantDays} days)`)
            : subscription.isPaid
            ? (isAr ? 'مشترك مُميز (Pro)' : 'Pro Member')
            : remainingDays > 0
            ? (isAr ? `تجربة مجانية (${remainingDays} يوم متبقي)` : `Trial (${remainingDays} days left)`)
            : (isAr ? 'انتهت التجربة' : 'Trial Expired')}
        </span>
      </div>

      {/* Trial stats / Limits banner */}
      <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-600 font-medium flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{isAr ? 'إجمالي مدة التجربة:' : 'Total Trial Duration:'}</span>
          </span>
          <span className="font-bold text-slate-900">
            {subscription.totalTrialDays} {isAr ? 'يوماً' : 'days'}
          </span>
        </div>

        <div className="space-y-2 border-t border-slate-200/60 pt-2 text-xs">
          {usageLoading && <p role="status">{isAr ? 'جارٍ تحميل استخدام اليوم...' : 'Loading today’s usage...'}</p>}
          {usageError && <p role="alert">{isAr ? 'تعذر تحميل حدود الاستخدام.' : 'Could not load usage limits.'} <button type="button" onClick={() => setUsageRetry(n => n + 1)} className="font-bold text-emerald-700 underline">{isAr ? 'إعادة المحاولة' : 'Try again'}</button></p>}
          {usage && <>
            <p className="font-bold text-slate-800">{usage.plan === 'expired' ? (isAr ? 'انتهت صلاحية الاستخدام' : 'Access expired') : (isAr ? `الخطة الحالية: ${usage.plan === 'pro' ? 'Pro' : 'Basic'}` : `Current plan: ${usage.plan === 'pro' ? 'Pro' : 'Basic'}`)}</p>
            {([['gemini', usage.gemini], ['local', usage.local]] as const).map(([engine, counts]) => counts && <div key={engine} className="rounded-lg border border-slate-200 bg-white p-2">
              <p className="font-bold text-slate-700">{engine === 'gemini' ? (isAr ? 'Gemini' : 'Gemini') : usage.plan === 'pro' ? (isAr ? 'المحلل المحلي عند عدم توفر Gemini أو انتهاء حصته' : 'Local analyzer when Gemini is unavailable or exhausted') : (isAr ? 'المحلل المحلي' : 'Local analyzer')}</p>
              <p>{isAr ? `التسجيلات: ${counts.entries.used} من ${counts.entries.limit} · المتبقي ${counts.entries.remaining}` : `Entries: ${counts.entries.used} of ${counts.entries.limit} · ${counts.entries.remaining} left`}</p>
              <p>{isAr ? `الاستعلامات: ${counts.inquiries.used} من ${counts.inquiries.limit} · المتبقي ${counts.inquiries.remaining}` : `Inquiries: ${counts.inquiries.used} of ${counts.inquiries.limit} · ${counts.inquiries.remaining} left`}</p>
            </div>)}
            {usage.plan !== 'expired' && <p className="text-[10px] text-slate-500">{isAr ? 'تُحسب المحاولة عند بدء التحليل، وتتجدد الحدود يوميًا بتوقيت القاهرة.' : 'Attempts count when analysis starts; limits reset daily in Cairo time.'}</p>}
          </>}
        </div>

        <p className="text-[10px] text-slate-500 font-medium leading-relaxed pt-0.5">
          {isAr
              ? 'الإدخال اليدوي متاح خلال صلاحية الاستخدام حتى بعد انتهاء حصة الذكاء الاصطناعي اليومية.'
              : 'Manual entry remains available while access is active after the daily AI quota.'}
        </p>
      </div>


    </div>
  );
};
