import React, { useEffect, useState } from 'react';
import { Tag, Sparkles, CheckCircle2, AlertCircle, Clock, Zap, Trash2 } from 'lucide-react';
import { UserSubscription } from '../types/prototypeSubscription';
import { calculateRemainingTrialDays, applyAffiliateCodeToExistingSubscription, removeAffiliateCodeFromSubscription } from '../utils/subscriptionUtils';
import { Language } from '../types';
import { activeGrant } from '../config/grantPolicy';
import { stageFor } from '../config/subscriptionPolicy';

type Bucket = { used: number; limit: number; remaining: number };
type UsageStatus = { day: string; plan: 'basic' | 'pro' | 'expired'; local?: { entries: Bucket; inquiries: Bucket }; gemini?: { entries: Bucket; inquiries: Bucket } };

interface SubscriptionCardProps {
  subscription: UserSubscription | null;
  lang: Language;
  onUpdateSubscription: (sub: UserSubscription) => Promise<void>;
}

export const SubscriptionCard: React.FC<SubscriptionCardProps> = ({
  subscription,
  lang,
  onUpdateSubscription,
}) => {
  const [promoInput, setPromoInput] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [usage, setUsage] = useState<UsageStatus | null>(null);
  const [usageError, setUsageError] = useState(false);
  const [usageLoading, setUsageLoading] = useState(true);
  const [usageRetry, setUsageRetry] = useState(0);
  useEffect(() => {
    let active = true;
    const load = async () => {
      setUsageLoading(true); setUsageError(false); setUsage(null);
      try {
        const { auth } = await import('../lib/firebase');
        const user = auth.currentUser;
        if (!user) throw new Error('authentication_required');
        const response = await fetch('/api/gateway', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` }, body: JSON.stringify({ action: 'ai.quota.status', payload: {} }) });
        const body = await response.json();
        if (!response.ok || !body?.ok || !body.data) throw new Error('usage_unavailable');
        if (active) setUsage(body.data as UsageStatus);
      } catch { if (active) setUsageError(true); }
      finally { if (active) setUsageLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [subscription?.tier, subscription?.grant?.plan, subscription?.grant?.endsAt, usageRetry]);

  const isAr = lang === 'ar';
  if (!subscription) return null;

  const remainingDays = calculateRemainingTrialDays(subscription);
  const grant = stageFor(subscription) !== 'paid' ? activeGrant(subscription.grant) : null;
  const grantDays = grant ? Math.max(0, Math.ceil((Date.parse(grant.endsAt) - Date.now()) / 86400000)) : null;

  const handleApplyPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);
    if (!promoInput.trim()) return;

    const res = applyAffiliateCodeToExistingSubscription(subscription, promoInput);
    if (res.success && res.updatedSubscription) {
      try {
        await onUpdateSubscription(res.updatedSubscription);
        setFeedback({ type: 'success', message: res.message });
        setPromoInput('');
      } catch (error) {
        setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'تعذر حفظ الكود' });
      }
    } else {
      setFeedback({ type: 'error', message: res.message });
    }
  };

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
            <button type="button" onClick={() => setUsageRetry(n => n + 1)} className="font-bold text-emerald-700 underline">{isAr ? 'تحديث الاستخدام' : 'Refresh usage'}</button>
          </>}
        </div>

        <p className="text-[10px] text-slate-500 font-medium leading-relaxed pt-0.5">
          {isAr
              ? 'الإدخال اليدوي متاح خلال صلاحية الاستخدام حتى بعد انتهاء حصة الذكاء الاصطناعي اليومية.'
              : 'Manual entry remains available while access is active after the daily AI quota.'}
        </p>
      </div>

      {/* Affiliate Code Section */}
      {subscription.hasAppliedAffiliateCode ? (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center justify-between gap-2 text-xs text-emerald-900 font-bold">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <div>
              <span>
                {isAr
                  ? `كود المسوّق النشط: (${subscription.affiliateCode})`
                  : `Active Partner Code: (${subscription.affiliateCode})`}
              </span>
              <span className="block text-[10px] text-emerald-700 font-medium mt-0.5">
                {isAr
                  ? 'مُطبّق خصم الاشتراك (4 ج/يوم بدل 6 ج = 120 ج/شهرياً).'
                  : 'Discount active (120 EGP/mo instead of 180 EGP).'}
              </span>
            </div>
          </div>
          <button
            id="btn-remove-affiliate-code"
            type="button"
            title={isAr ? 'حذف كود المسوق والعودة للوضع الأساسي' : 'Remove marketer code'}
            onClick={async () => {
              try {
              const reverted = removeAffiliateCodeFromSubscription(subscription);
              await onUpdateSubscription(reverted);
              setFeedback({
                type: 'success',
                message: isAr ? 'تم حذف كود المسوق وإعادة الحساب للتجربة الأساسية.' : 'Marketer code removed.',
              });
              } catch (error) {
                setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'تعذر حذف الكود' });
              }
            }}
            className="flex items-center gap-1 text-[11px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 border border-rose-200/80 px-2.5 py-1.5 rounded-lg cursor-pointer transition shrink-0"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{isAr ? 'إلغاء الكود' : 'Remove'}</span>
          </button>
        </div>
      ) : remainingDays === 0 && !subscription.isPaid && !grant ? (
        <p className="rounded-xl bg-amber-50 p-3 text-xs leading-6 text-amber-900">{isAr ? 'انتهت التجربة المجانية. لا يمنح كود المسوّق تجربة جديدة؛ خصم الاشتراك قيد التجهيز.' : 'The free trial has ended. A marketer code cannot start another trial; subscription discounts are being prepared.'}</p>
      ) : (
        <form onSubmit={handleApplyPromo} className="space-y-2 pt-1">
          <label htmlFor="affiliate-redeem-input" className="block text-xs font-black text-slate-800 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-amber-600" />
            <span>{isAr ? 'هل حصلت على كود مسوّق لاحقاً؟' : 'Have a marketer code?'}</span>
          </label>
          <div className="flex gap-2">
            <input
              id="affiliate-redeem-input"
              type="text"
              placeholder={isAr ? 'أدخل الكود (مثال: WAEL2026)' : 'Enter Code (e.g. WAEL2026)'}
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value)}
              className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono font-bold uppercase text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-500/40"
            />
            <button
              id="btn-apply-promo-code"
              type="submit"
              disabled={!promoInput.trim()}
              className="bg-amber-600 hover:bg-amber-700 disabled:opacity-40 text-white font-black px-4 py-2 rounded-xl text-xs transition cursor-pointer shadow-xs"
            >
              {isAr ? 'تفعيل' : 'Redeem'}
            </button>
          </div>
          <p className="text-[10px] text-slate-500 leading-relaxed">
            {isAr
              ? 'كود المسوّق يمنح خصمًا على الاشتراك الشهري، ولا يغيّر مدة التجربة.'
              : 'A marketer code provides a monthly subscription discount and does not change the trial duration.'}
          </p>

          {feedback && (
            <div
              className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                feedback.type === 'success'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              )}
              <span>{feedback.message}</span>
            </div>
          )}
        </form>
      )}
    </div>
  );
};
