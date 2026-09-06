import React from 'react';
import { Sparkles, X, TrendingDown, TrendingUp, Wallet, ArrowRight, Calendar } from 'lucide-react';
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
  const isAr = lang === 'ar';

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white rounded-3xl p-5 shadow-lg border border-slate-700/80 animate-in fade-in zoom-in-95 duration-200 space-y-4">
      {/* Top Header with AI Badge & Dismiss */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
              {isAr ? 'إجابة المساعد المالي الذكي' : 'My Bucket AI Answer'}
            </span>
            <p className="text-xs text-slate-300 line-clamp-1 italic font-medium">
              "{result.question}"
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-full bg-slate-800/80 hover:bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-300 hover:text-white transition-colors cursor-pointer"
          title={isAr ? 'إغلاق' : 'Close'}
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Main Calculated Value Display */}
      <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-xs flex items-center justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
            <span>{result.periodText}</span>
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white tracking-tight flex items-baseline gap-1.5">
            <span>{result.amount !== null ? result.amount.toLocaleString() : '—'}</span>
            <span className="text-sm sm:text-base font-semibold text-emerald-400">
              {isAr ? 'ج.م' : result.currency}
            </span>
          </div>
        </div>

        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
          <Wallet className="w-6 h-6" />
        </div>
      </div>

      {/* Contextual Details */}
      <p className="text-xs sm:text-sm text-slate-300 font-medium leading-relaxed">
        {result.details}
      </p>

      {/* Breakdown by Category if available */}
      {result.breakdown && result.breakdown.length > 0 && (
        <div className="space-y-2 pt-1 border-t border-slate-700/60">
          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
            {isAr ? 'التوزيع حسب التصنيف:' : 'Category Breakdown:'}
          </div>
          <div className="space-y-1.5">
            {result.breakdown.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-xs py-1 px-2.5 rounded-xl bg-slate-800/60 border border-slate-700/40"
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: item.color || '#10B981' }}
                  />
                  <span className="font-semibold text-slate-200">{item.label}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white">
                    {item.amount.toLocaleString()} {isAr ? 'ج.م' : result.currency}
                  </span>
                  {item.percentage !== undefined && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-700 text-slate-300 font-medium">
                      {item.percentage}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer / Action */}
      {onViewTransactions && result.transactionCount && result.transactionCount > 0 && (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onViewTransactions}
            className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <span>{isAr ? 'عرض المعاملات المرتبطة' : 'View related transactions'}</span>
            <ArrowRight className={`w-3.5 h-3.5 ${isAr ? 'rotate-180' : ''}`} />
          </button>
        </div>
      )}
    </div>
  );
}
