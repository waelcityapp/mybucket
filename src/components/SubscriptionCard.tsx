import React, { useEffect, useState } from 'react';
import { Clock, Zap } from 'lucide-react';
import { UserSubscription } from '../types/prototypeSubscription';
import { calculateRemainingPaidDays, calculateRemainingTrialDays } from '../utils/subscriptionUtils';
import { Language } from '../types';
import { activeGrant } from '../config/grantPolicy';
import { stageFor } from '../config/subscriptionPolicy';

type Bucket = { used: number; limit: number; remaining: number };
type SavedBucket = { used: number; limit: number | null; remaining: number | null };
type UsageStatus = { day: string; plan: 'basic' | 'pro' | 'expired'; savedEntries?: Partial<Record<'basic' | 'pro', SavedBucket>>; aiAttempts?: Bucket };

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

  const paidDays = calculateRemainingPaidDays(subscription);
  const remainingDays = calculateRemainingTrialDays(subscription);
  const stage = stageFor(subscription);
  const grant = stage === 'pro-trial' || stage === 'basic-free' ? activeGrant(subscription.grant) : null;
  const grantDays = grant ? Math.max(0, Math.ceil((Date.parse(grant.endsAt) - Date.now()) / 86400000)) : null;
  const days = grantDays ?? (paidDays > 0 ? paidDays : remainingDays);
  const durationLabel = grant
    ? (isAr ? 'الأيام المتبقية للمنحة' : 'Grant days remaining')
    : paidDays > 0
      ? (isAr ? 'الأيام المتبقية للاشتراك' : 'Subscription days remaining')
      : (isAr ? 'الأيام المتبقية للتجربة' : 'Trial days remaining');


  const savedToday = usage?.savedEntries?.pro ?? usage?.savedEntries?.basic;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <Zap className="w-4 h-4 text-amber-500" />
          <span>{isAr ? 'خطة الاشتراك وفترة التجربة' : 'Subscription & Trial Plan'}</span>
        </div>
        <span
          className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
            grant || paidDays > 0
              ? 'bg-emerald-100 text-emerald-800'
              : remainingDays > 0
              ? 'bg-amber-100 text-amber-900'
              : 'bg-rose-100 text-rose-800'
          }`}
        >
          {grant
            ? (isAr ? `منحة ${grant.plan === 'pro' ? 'Pro' : 'Basic'} مجانية` : `Free ${grant.plan} grant`)
            : paidDays > 0
            ? (isAr ? `اشتراك ${subscription.paidPlan === 'basic' ? 'Basic' : 'Pro'} نشط` : `Active ${subscription.paidPlan === 'basic' ? 'Basic' : 'Pro'} subscription`)
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
            <span>{durationLabel}</span>
          </span>
          <span className="font-bold text-slate-900">
            {new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-GB').format(days)} {isAr ? 'يوماً' : 'days'}
          </span>
        </div>

        <div className="space-y-2 border-t border-slate-200/60 pt-2 text-xs">
          {usageLoading && <p role="status">{isAr ? 'جارٍ تحميل استخدام اليوم...' : 'Loading today’s usage...'}</p>}
          {usageError && <p role="alert">{isAr ? 'تعذر تحميل حدود الاستخدام.' : 'Could not load usage limits.'} <button type="button" onClick={() => setUsageRetry(n => n + 1)} className="font-bold text-emerald-700 underline">{isAr ? 'إعادة المحاولة' : 'Try again'}</button></p>}
          {usage && <>
            <p className="font-bold text-slate-800">{usage.plan === 'expired' ? (isAr ? 'انتهت صلاحية الاستخدام' : 'Access expired') : (isAr ? `الخطة الحالية: ${usage.plan === 'pro' ? 'Pro' : 'Basic'}` : `Current plan: ${usage.plan === 'pro' ? 'Pro' : 'Basic'}`)}</p>
            {savedToday && <section className="space-y-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-emerald-950">
              <h3 className="font-extrabold">{isAr ? 'العمليات المحفوظة اليوم' : 'Transactions saved today'}</h3>
              <p>{isAr ? 'يشمل الحفظ اليدوي والحفظ بعد التحليل.' : 'Includes manual saves and saves after analysis.'}</p>
              <p className="font-bold">
                {savedToday.limit === null
                  ? (isAr ? `${savedToday.used} عملية محفوظة` : `${savedToday.used} saved`)
                  : (isAr ? `حفظت ${savedToday.used} من ${savedToday.limit} · المتبقي ${savedToday.remaining}`
                    : `Saved ${savedToday.used} of ${savedToday.limit} · ${savedToday.remaining} left`)}
              </p>
            </section>}
            {usage.aiAttempts && <section className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
              <h3 className="font-extrabold">{isAr ? 'محاولات الذكاء الاصطناعي اليوم' : 'AI attempts today'}</h3>
              <p>{isAr ? 'حصة واحدة للعمليات والاستعلامات. تُحسب المحاولة عند بدء التحليل.' : 'One allowance for transactions and queries. Attempts count when analysis starts.'}</p>
              <p className="font-bold">{isAr ? `استخدمت ${usage.aiAttempts.used} من ${usage.aiAttempts.limit} · المتبقي ${usage.aiAttempts.remaining}` : `Used ${usage.aiAttempts.used} of ${usage.aiAttempts.limit} · ${usage.aiAttempts.remaining} left`}</p>
            </section>}
            {usage.plan !== 'expired' && <p className="text-[10px] text-slate-500">{isAr ? 'العدادات تتجدد يوميًا بتوقيت القاهرة.' : 'Counters reset daily in Cairo time.'}</p>}
          </>}
        </div>

      </div>


    </div>
  );
};
