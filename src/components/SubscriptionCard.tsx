import React, { useState } from 'react';
import { Tag, Sparkles, CheckCircle2, AlertCircle, Clock, Zap, Trash2 } from 'lucide-react';
import { UserSubscription } from '../types/prototypeSubscription';
import { calculateRemainingTrialDays, applyAffiliateCodeToExistingSubscription, removeAffiliateCodeFromSubscription } from '../utils/subscriptionUtils';
import { Language } from '../types';

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

  const isAr = lang === 'ar';
  if (!subscription) return null;

  const remainingDays = calculateRemainingTrialDays(subscription);

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
            subscription.isPaid
              ? 'bg-emerald-100 text-emerald-800'
              : remainingDays > 0
              ? 'bg-amber-100 text-amber-900'
              : 'bg-rose-100 text-rose-800'
          }`}
        >
          {subscription.isPaid
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
            {subscription.hasAppliedAffiliateCode && (
              <span className="mr-1 text-[10px] text-emerald-600 font-black">
                ({isAr ? 'مع كود المسوّق' : 'with promo code'})
              </span>
            )}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-200/60 text-[11px]">
          <div className="bg-white p-2 rounded-lg border border-slate-200">
            <span className="block text-slate-500 text-[10px]">{isAr ? 'تسجيلات AI اليومية' : 'Daily AI Entries'}</span>
            <span className="font-black text-slate-800">15 {isAr ? 'عملية / يوم' : 'ops / day'}</span>
          </div>
          <div className="bg-white p-2 rounded-lg border border-slate-200">
            <span className="block text-slate-500 text-[10px]">{isAr ? 'استعلامات AI وسقف البحث' : 'AI Queries & History'}</span>
            <span className="font-black text-slate-800">5 {isAr ? 'استعلامات (35 يوم)' : 'queries (35 days)'}</span>
          </div>
        </div>

        <p className="text-[10px] text-slate-500 font-medium leading-relaxed pt-0.5">
          {isAr
            ? '💡 الإدخال والاستعلام اليدوي غير محدود ومتاح دائماً حتى بعد انتهاء حصة الذكاء الاصطناعي اليومية.'
            : '💡 Manual entry & searches remain 100% unlimited even after daily AI quotas.'}
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
              ? 'تفعيل الكود يرفع مدة التجربة إلى 35 يوماً (مع خصم الأيام التي قضيتها بالفعل دون تصفيرها)، ويضمن سعر 4 ج/يوم عند التجديد.'
              : 'Deducts used days from 35 total trial days and grants renewal discount.'}
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
