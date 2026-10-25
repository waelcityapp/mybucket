import React, { useState } from 'react';
import {
  Cpu,
  Sparkles,
  Zap,
  Check,
  Activity,
  BarChart3,
  Layers,
  ShieldCheck,
  ArrowUpRight,
  TrendingUp,
  RotateCcw,
} from 'lucide-react';
import { Language } from '../types';

export interface AdminAiUsageCardProps {
  lang?: Language;
  className?: string;
  onModelChange?: (modelId: string) => void;
}

interface GeminiModelOption {
  id: string;
  name: string;
  nameAr: string;
  badge: string;
  badgeAr: string;
  description: string;
  descriptionAr: string;
  latency: string;
  costPerMillion: string;
  contextWindow: string;
  isRecommended?: boolean;
}

const AVAILABLE_MODELS: GeminiModelOption[] = [
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    nameAr: 'جيميني 2.5 فلاش',
    badge: 'Recommended',
    badgeAr: 'موصى به للإنتاج',
    description: 'High-speed reasoning, optimized for Arabic financial parsing & voice queries.',
    descriptionAr: 'سرعة فائقة ودقة عالية في فهم اللهجات العربية والعمليات المالية والصوتية.',
    latency: '~280ms',
    costPerMillion: '$0.075 / 1M tokens',
    contextWindow: '1M tokens',
    isRecommended: true,
  },
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    nameAr: 'جيميني 3.8 فلاش',
    badge: 'Next-Gen',
    badgeAr: 'الجيل الأحدث',
    description: 'Next-generation multimodal performance with ultra-low latency.',
    descriptionAr: 'أحدث معمارية للذكاء الاصطناعي مع استجابة فورية ومعالجة متعددة الوسائط.',
    latency: '~250ms',
    costPerMillion: '$0.075 / 1M tokens',
    contextWindow: '1M tokens',
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    nameAr: 'جيميني 1.5 برو',
    badge: 'Deep Reasoning',
    badgeAr: 'تحليل متقدم',
    description: 'Deep complex analysis for comprehensive financial reporting and budgets.',
    descriptionAr: 'تفكير تحليلي عميق لتقارير الميزانية السنوية والاستشارات المالية المعقدة.',
    latency: '~650ms',
    costPerMillion: '$1.25 / 1M tokens',
    contextWindow: '2M tokens',
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash-Lite',
    nameAr: 'جيميني 3.1 فلاش لايت',
    badge: 'Economy',
    badgeAr: 'اقتصادي فائق',
    description: 'Maximum throughput at the lowest operational cost for simple categorizations.',
    descriptionAr: 'أعلى سرعة بأقل تكلفة ممكنة للمهام السريعة والتصنيف التلقائي الفوري.',
    latency: '~190ms',
    costPerMillion: '$0.0375 / 1M tokens',
    contextWindow: '1M tokens',
  },
];

export const AdminAiUsageCard: React.FC<AdminAiUsageCardProps> = ({
  lang = 'ar',
  className = '',
  onModelChange,
}) => {
  const isAr = lang === 'ar';

  // State for active model and token stats
  const [activeModelId, setActiveModelId] = useState<string>('gemini-2.5-flash');
  const [usedTokens, setUsedTokens] = useState<number>(348250);
  const totalMonthlyQuota = 1000000;
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const activeModel = AVAILABLE_MODELS.find((m) => m.id === activeModelId) || AVAILABLE_MODELS[0];
  const usagePercentage = Math.min(100, Math.round((usedTokens / totalMonthlyQuota) * 100));

  // Determine progress bar color based on consumption
  const getProgressColor = (pct: number) => {
    if (pct >= 90) return 'bg-rose-500';
    if (pct >= 75) return 'bg-amber-500';
    return 'bg-emerald-600';
  };

  const handleSelectModel = (modelId: string) => {
    setActiveModelId(modelId);
    if (onModelChange) {
      onModelChange(modelId);
    }
    const selected = AVAILABLE_MODELS.find((m) => m.id === modelId);
    const modelLabel = isAr ? selected?.nameAr : selected?.name;
    setStatusMessage(
      isAr
        ? `تم تعيين ${modelLabel} كنموذج افتراضي للاستعلامات الذكية`
        : `Active production model updated to ${modelLabel}`
    );
    setTimeout(() => setStatusMessage(null), 3500);
  };

  const handleSimulateRequest = () => {
    const increment = Math.floor(Math.random() * 1200) + 450;
    setUsedTokens((prev) => Math.min(totalMonthlyQuota, prev + increment));
    setStatusMessage(
      isAr
        ? `تم تسجيل استعلام تجريبي (+${increment.toLocaleString('en-US')} توكن)`
        : `Simulated query logged (+${increment.toLocaleString('en-US')} tokens)`
    );
    setTimeout(() => setStatusMessage(null), 3000);
  };

  const handleResetTokens = () => {
    setUsedTokens(348250);
    setStatusMessage(isAr ? 'تمت إعادة تعيين عداد الاستهلاك إلى القيمة المرجعية' : 'Token counter reset to baseline');
    setTimeout(() => setStatusMessage(null), 3000);
  };

  return (
    <div
      id="card-admin-ai-usage"
      className={`bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs space-y-5 ${className}`}
    >
      {/* 1. Header with Admin Badge & Status */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                {isAr ? 'لوحة تحكم استهلاك Gemini AI' : 'Gemini AI Admin & Usage'}
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-wide bg-indigo-100 text-indigo-800">
                {isAr ? 'مشرف النظام' : 'Admin'}
              </span>
            </div>
            <p className="text-[11px] text-slate-500">
              {isAr
                ? 'مراقبة الحصص الشهرية، كفاءة النماذج، والارتباط بفواتير Google Cloud'
                : 'Monitor monthly quotas, active model latency, and Google Cloud billing'}
            </p>
          </div>
        </div>

        {/* Live Status indicator */}
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/80">
          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
          <span>{isAr ? 'واجهة Gemini متصلة بنجاح' : 'Gemini API Live'}</span>
        </div>
      </div>

      {/* 2. Token Usage & Progress Bar */}
      <div className="bg-slate-50/90 border border-slate-200/80 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 font-bold text-slate-700">
            <BarChart3 className="w-4 h-4 text-indigo-600" />
            <span>{isAr ? 'استهلاك التوكنز الشهري' : 'Monthly Token Consumption'}</span>
          </div>
          <div className="text-right">
            <span className="font-extrabold text-slate-900 text-sm">
              {usedTokens.toLocaleString('en-US')}
            </span>
            <span className="text-slate-500 text-[11px]">
              {' '}/ {totalMonthlyQuota.toLocaleString('en-US')} {isAr ? 'توكن' : 'tokens'}
            </span>
            <span className="ml-1.5 font-black text-indigo-600">({usagePercentage}%)</span>
          </div>
        </div>

        {/* Visual Progress Bar */}
        <div className="w-full bg-slate-200 h-2.5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ease-out rounded-full ${getProgressColor(
              usagePercentage
            )}`}
            style={{ width: `${usagePercentage}%` }}
          />
        </div>

        {/* Sub-breakdown Stats */}
        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
          <div className="bg-white border border-slate-200/80 rounded-lg p-2">
            <div className="text-[10px] text-slate-500">{isAr ? 'توكنز الإدخال' : 'Input Tokens'}</div>
            <div className="text-xs font-bold text-slate-800">
              {Math.round(usedTokens * 0.72).toLocaleString('en-US')}
            </div>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-lg p-2">
            <div className="text-[10px] text-slate-500">{isAr ? 'توكنز الإخراج' : 'Output Tokens'}</div>
            <div className="text-xs font-bold text-slate-800">
              {Math.round(usedTokens * 0.28).toLocaleString('en-US')}
            </div>
          </div>
          <div className="bg-white border border-slate-200/80 rounded-lg p-2">
            <div className="text-[10px] text-slate-500">{isAr ? 'التكلفة التقديرية' : 'Est. Cost'}</div>
            <div className="text-xs font-bold text-emerald-700">
              ${((usedTokens / 1000000) * 0.075).toFixed(3)}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
          <span className="flex items-center gap-1">
            <Activity className="w-3.5 h-3.5 text-slate-400" />
            <span>
              {isAr
                ? `المتبقي: ${(totalMonthlyQuota - usedTokens).toLocaleString('en-US')} توكن قبل حد التوقف`
                : `Remaining: ${(totalMonthlyQuota - usedTokens).toLocaleString('en-US')} tokens`}
            </span>
          </span>
          <div className="flex items-center gap-2">
            <button
              id="btn-simulate-ai-query"
              type="button"
              onClick={handleSimulateRequest}
              className="text-indigo-600 hover:text-indigo-800 font-bold underline transition-colors cursor-pointer"
            >
              {isAr ? '+ تجربة طلب' : '+ Simulate'}
            </button>
            <button
              id="btn-reset-ai-tokens"
              type="button"
              onClick={handleResetTokens}
              title={isAr ? 'إعادة تعيين القيمة' : 'Reset counter'}
              className="text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* 3. Current Active Model Spotlight */}
      <div className="bg-gradient-to-r from-indigo-50/70 via-slate-50 to-indigo-50/70 border border-indigo-200/70 rounded-xl p-3.5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-700">
              {isAr ? 'النموذج النشط حالياً في الخادم:' : 'Current Active Server Model:'}
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-600 text-white">
            {activeModel.id}
          </span>
        </div>

        <div className="flex items-center justify-between flex-wrap gap-2 pt-1 text-xs">
          <div className="font-extrabold text-slate-900 text-sm">
            {isAr ? activeModel.nameAr : activeModel.name}
          </div>
          <div className="flex items-center gap-3 text-slate-600 text-[11px]">
            <span className="flex items-center gap-1 font-semibold text-emerald-700">
              <Zap className="w-3 h-3 text-emerald-600" />
              {activeModel.latency}
            </span>
            <span className="font-semibold text-slate-600">
              {activeModel.contextWindow}
            </span>
            <span className="font-mono text-slate-500">
              {activeModel.costPerMillion}
            </span>
          </div>
        </div>

        <p className="text-[11px] text-slate-600 leading-relaxed">
          {isAr ? activeModel.descriptionAr : activeModel.description}
        </p>
      </div>

      {/* 4. Model Switcher Options */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
            <Layers className="w-4 h-4 text-slate-600" />
            <span>{isAr ? 'خيارات تبديل نموذج الذكاء الاصطناعي' : 'Gemini Model Switcher'}</span>
          </div>
          <span className="text-[10px] text-slate-400">
            {isAr ? 'تأثير فوري على معالجة الصوت والمصاريف' : 'Instant routing toggle'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {AVAILABLE_MODELS.map((model) => {
            const isSelected = model.id === activeModelId;
            return (
              <button
                key={model.id}
                id={`btn-model-select-${model.id}`}
                type="button"
                onClick={() => handleSelectModel(model.id)}
                className={`p-3 rounded-xl border text-left rtl:text-right transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                  isSelected
                    ? 'bg-indigo-50/80 border-indigo-400 ring-2 ring-indigo-200/50 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/60'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isSelected ? 'bg-indigo-600 ring-2 ring-indigo-200' : 'bg-slate-300'
                      }`}
                    />
                    <span className="text-xs font-bold text-slate-900">
                      {isAr ? model.nameAr : model.name}
                    </span>
                  </div>
                  {isSelected ? (
                    <span className="p-0.5 rounded-full bg-indigo-600 text-white">
                      <Check className="w-3 h-3" />
                    </span>
                  ) : (
                    <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                      {isAr ? model.badgeAr : model.badge}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                  {isAr ? model.descriptionAr : model.description}
                </p>

                <div className="flex items-center justify-between text-[10px] text-slate-600 pt-1 border-t border-slate-100 font-medium">
                  <span className="text-emerald-700 font-bold">{model.latency}</span>
                  <span className="text-slate-400 font-mono">{model.costPerMillion}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Action feedback message */}
      {statusMessage && (
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2 animate-in fade-in duration-200">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* 5. Direct Link Button to Google Cloud Billing */}
      <div className="pt-1">
        <a
          id="btn-google-cloud-billing-link"
          href="https://console.cloud.google.com/billing"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all shadow-xs flex items-center justify-center gap-2 group cursor-pointer"
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96zM19 18H6c-2.21 0-4-1.79-4-4 0-2.05 1.53-3.76 3.56-3.97l1.07-.11.5-.95C8.08 7.14 9.94 6 12 6c2.62 0 4.88 1.86 5.39 4.43l.3 1.5 1.53.11c1.56.1 2.78 1.41 2.78 2.96 0 1.65-1.35 3-3 3z" />
          </svg>
          <span>
            {isAr
              ? 'إدارة الفواتير والحدود في Google Cloud Billing'
              : 'Manage Quotas & Billing in Google Cloud'}
          </span>
          <ArrowUpRight className="w-4 h-4 text-slate-400 group-hover:text-white transition-colors" />
        </a>

        <div className="flex items-center justify-between text-[10px] text-slate-400 mt-2 px-1">
          <span>{isAr ? 'معرف حساب الفوترة: مرتبط بمشروع Google Cloud' : 'Linked Billing Account: Google Cloud Active'}</span>
          <span className="flex items-center gap-1 text-emerald-600 font-semibold">
            <TrendingUp className="w-3 h-3" />
            {isAr ? 'الحد الائتماني: كافٍ' : 'Quota Health: Normal'}
          </span>
        </div>
      </div>
    </div>
  );
};
