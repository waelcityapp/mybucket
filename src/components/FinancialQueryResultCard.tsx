import { useEffect, useId, useRef, useState } from 'react';
import { ChartNoAxesColumnIncreasing, X, Wallet, ArrowRight, Calendar } from 'lucide-react';
import { DeterministicQueryResult } from '../services/ai/types';
import { Language } from '../types';

interface FinancialQueryResultCardProps {
  result: DeterministicQueryResult;
  lang: Language;
  onClose: () => void;
  onViewTransactions?: () => void;
}

export function FinancialQueryResultCard({
  result,
  lang,
  onClose,
  onViewTransactions,
}: FinancialQueryResultCardProps) {
  const heading = useRef<HTMLHeadingElement>(null);
  const breakdownId = useId();
  const [expandedResult, setExpandedResult] = useState<DeterministicQueryResult | null>(null);
  const expanded = expandedResult === result;
  const breakdown = result.breakdown ?? [];
  const visibleItems = expanded ? breakdown : breakdown.slice(0, 4);
  const hiddenCount = breakdown.length - 4;

  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    heading.current?.scrollIntoView({ block: 'start' });
  }, [result]);

  const isAr = lang === 'ar';

  return (
    <div className="bg-white text-slate-900 rounded-3xl p-5 shadow-xs border-2 border-emerald-500/20 animate-in fade-in zoom-in-95 duration-200 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
            <ChartNoAxesColumnIncreasing className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <h2 ref={heading} tabIndex={-1} className="scroll-mt-24 text-sm font-bold text-emerald-700">
              {isAr ? 'إجابة الاستفسار المالي' : 'Financial Answer'}
            </h2>
            <p className="text-xs text-slate-600 line-clamp-1 italic font-medium">
              "{result.question}"
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          title={isAr ? 'إغلاق' : 'Close'}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Calculated Value Display */}
      <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200/80 flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-600 font-semibold">
            <Calendar className="w-3.5 h-3.5 text-emerald-600" />
            <span>{result.periodText}</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-slate-900 flex items-baseline gap-1.5">
            <span>{result.amount !== null ? result.amount.toLocaleString() : '—'}</span>
            <span className="text-sm sm:text-base font-bold text-emerald-700">
              {isAr ? 'ج.م' : result.currency}
            </span>
          </div>
        </div>

        <div className="w-12 h-12 rounded-2xl bg-white border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-2xs">
          <Wallet className="w-6 h-6" />
        </div>
      </div>

      {/* Contextual Details */}
      <p className="text-xs sm:text-sm text-slate-700 font-medium leading-relaxed">
        {result.details}
      </p>

      {/* Breakdown by Category if available */}
      {breakdown.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-slate-100">
          <div className="text-[11px] font-bold text-slate-500 uppercase">
            {isAr ? 'التوزيع حسب التصنيف:' : 'Category Breakdown:'}
          </div>
          <div id={breakdownId} className="space-y-1.5">
            {visibleItems.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-xs py-1.5 px-3 rounded-xl bg-slate-50 border border-slate-200/70"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color || '#10B981' }}
                  />
                  <span className="font-semibold text-slate-800">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-black text-slate-900">
                    {item.amount.toLocaleString()} {isAr ? 'ج.م' : result.currency}
                  </span>
                  {item.percentage !== undefined && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-white border border-slate-200 text-slate-600 font-bold">
                      {item.percentage}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          {hiddenCount > 0 && (
            <button type="button" aria-expanded={expanded} aria-controls={breakdownId}
              onClick={() => setExpandedResult(expanded ? null : result)}
              className="min-h-10 px-2 text-sm font-bold text-emerald-700 hover:underline">
              {expanded ? (isAr ? 'عرض أقل' : 'Show fewer')
                : (isAr ? `عرض باقي التصنيفات (${hiddenCount})` : `Show remaining categories (${hiddenCount})`)}
            </button>
          )}
        </div>
      )}

      {/* Footer / Action */}
      {onViewTransactions && result.transactionCount && result.transactionCount > 0 && (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onViewTransactions}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>{isAr ? 'عرض المعاملات المرتبطة' : 'View related transactions'}</span>
            <ArrowRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
          </button>
        </div>
      )}
    </div>
  );
}
