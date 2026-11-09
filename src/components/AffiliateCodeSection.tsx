import React, { useState } from 'react';
import { Tag, CheckCircle2, AlertCircle, Trash2 } from 'lucide-react';
import type { UserSubscription } from '../types/prototypeSubscription';
import type { Language } from '../types';
import { calculateRemainingTrialDays, applyAffiliateCodeToExistingSubscription, removeAffiliateCodeFromSubscription } from '../utils/subscriptionUtils';
import { activeGrant } from '../config/grantPolicy';
import { stageFor } from '../config/subscriptionPolicy';

export function AffiliateCodeSection({ subscription, lang, onUpdateSubscription }: { subscription: UserSubscription; lang: Language; onUpdateSubscription: (sub: UserSubscription) => Promise<void> }) {
  const isAr = lang === 'ar';
  const [promoInput, setPromoInput] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const remainingDays = calculateRemainingTrialDays(subscription);
  const grant = stageFor(subscription) !== 'paid' ? activeGrant(subscription.grant) : null;
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

  return <>
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
  </>;
}
