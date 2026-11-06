import { useState } from 'react';
import {
  ArrowLeft, ArrowRight, CheckCircle2, Database, RotateCcw, ShieldCheck,
  MessageSquareText, Users, CreditCard, Megaphone, BrainCircuit, Settings2,
  ChevronUp, Clock3, PanelsTopLeft,
} from 'lucide-react';
import type { AuthUser, Language } from '../../types';
import { translations } from '../../data/translations';
import { AdminAiUsageCard } from '../AdminAiUsageCard';
import { AdminAppUsersView } from './AdminAppUsersView';

interface AdminViewProps {
  lang: Language;
  user: AuthUser;
  onBack: () => void;
  onResetDemoData: () => void;
  onZeroAllBalances: () => Promise<boolean>;
  onOpenFeedbackAdmin: () => void;
  sectionId?: SectionId | null;
  onOpenSection: (section: SectionId) => void;
  onBackToSections: () => void;
}

export type SectionId = 'users' | 'subscriptions' | 'marketers' | 'reports' | 'ai' | 'system' | 'ads';

export function AdminView({
  lang, user, onBack, onResetDemoData, onZeroAllBalances, onOpenFeedbackAdmin,
  sectionId = null, onOpenSection, onBackToSections,
}: AdminViewProps) {
  const t = translations[lang];
  const ar = lang === 'ar';
  const selected = sectionId;
  const [confirmation, setConfirmation] = useState<'zero' | 'reset' | null>(null);

  const sections = [
    { id: 'users' as const, icon: Users, title: ar ? 'مستخدمى التطبيق' : 'App users', desc: ar ? 'التسجيل والتثبيت والاشتراكات والتحكم بالحسابات' : 'Registrations, installs, plans and account controls', ready: true },
    { id: 'subscriptions' as const, icon: CreditCard, title: ar ? 'الاشتراكات' : 'Subscriptions', desc: ar ? 'الخطط وفترات التجربة' : 'Plans and trials', ready: false },
    { id: 'marketers' as const, icon: Megaphone, title: ar ? 'المسوقون' : 'Marketers', desc: ar ? 'الأكواد والعمولات' : 'Codes and commissions', ready: false },
    { id: 'ads' as const, icon: PanelsTopLeft, title: ar ? 'إدارة الإعلانات' : 'Ads management', desc: ar ? 'الإعلانات والعروض المنشورة' : 'Published ads and offers', ready: false },
    { id: 'reports' as const, icon: MessageSquareText, title: ar ? 'البلاغات' : 'Reports', desc: ar ? 'تقييمات المحلل المحلي والتحكم فيها' : 'Local analyzer feedback and controls', ready: true },
    { id: 'ai' as const, icon: BrainCircuit, title: ar ? 'الذكاء الاصطناعي' : 'Artificial intelligence', desc: ar ? 'Gemini والاستهلاك واختيار النموذج' : 'Gemini, usage and model selection', ready: true },
    { id: 'system' as const, icon: Settings2, title: ar ? 'إعدادات النظام' : 'System settings', desc: ar ? 'التشخيص والأدوات الحالية' : 'Diagnostics and existing tools', ready: true },
  ];

  const showConfirmation = (type: 'zero' | 'reset') => {
    setConfirmation(type);
    window.setTimeout(() => setConfirmation(null), 3000);
  };
  const handleZeroBalances = async () => {
    if (await onZeroAllBalances()) showConfirmation('zero');
  };
  const handleReset = () => {
    onResetDemoData();
    showConfirmation('reset');
  };

  const activeSection = sections.find(section => section.id === selected);
  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-start gap-3">
        <button type="button" onClick={selected ? onBackToSections : onBack}
          aria-label={selected ? (ar ? 'العودة للأقسام الرئيسية' : 'Back to admin sections') : (ar ? 'العودة للرئيسية' : 'Back to home')}
          className="mt-0.5 w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center shrink-0">
          {ar ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <h1 className="text-xl font-extrabold text-slate-900">{activeSection?.title || (ar ? 'لوحة الإدارة' : 'Admin dashboard')}</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">{selected ? (ar ? 'العودة إلى أقسام الإدارة من زر الرجوع' : 'Use Back to return to admin sections') : (ar ? 'إدارة التطبيق ومتابعة الخدمات من مكان واحد' : 'App administration in one place')}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
        <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
        <span className="text-[11px] font-semibold text-emerald-900 truncate">{ar ? 'حساب صاحب التطبيق:' : 'App owner:'} {user.email}</span>
      </div>

      {!selected && <div className="grid grid-cols-2 gap-2.5">
        {sections.map(section => {
          const Icon = section.icon;
          return (
            <button key={section.id} type="button"
              onClick={() => section.id === 'reports' ? onOpenFeedbackAdmin() : onOpenSection(section.id)}
              className="min-h-32 rounded-2xl border border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50 p-3 flex flex-col items-start text-start gap-2 transition-colors">
              <span className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700">
                <Icon className="w-4.5 h-4.5" />
              </span>
              <span className="text-sm font-extrabold text-slate-900">{section.title}</span>
              <span className="text-[11px] text-slate-500 leading-relaxed">{section.desc}</span>
              <span className={`text-[10px] font-bold mt-auto ${section.ready ? 'text-emerald-700' : 'text-slate-400'}`}>
                {section.ready ? (ar ? 'وظائف متاحة' : 'Available functions') : (ar ? 'قيد التطوير' : 'In development')}
              </span>
            </button>
          );
        })}
      </div>}

      {activeSection && (
        <section className="space-y-3 scroll-mt-24" aria-label={activeSection.title}>
          <div className="flex items-center justify-between gap-2 px-1">
            <h2 className="text-base font-extrabold text-slate-900">{activeSection.title}</h2>
            <button type="button" onClick={onBackToSections} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-700">
              {ar ? 'الأقسام الرئيسية' : 'All sections'} <ChevronUp className="w-4 h-4" />
            </button>
          </div>

          {!activeSection.ready && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 flex items-start gap-3">
              <Clock3 className="w-5 h-5 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold text-sm text-slate-800">{ar ? 'هذا القسم قيد التطوير' : 'This section is in development'}</p>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                  {ar ? 'تم تجهيز مكان القسم فقط. لم تُفعَّل فيه بعد أدوات الإدارة أو صلاحيات جديدة، ولن تُعرض بيانات تجريبية على أنها بيانات حقيقية.' : 'Only the section layout is prepared. No new admin actions or permissions are enabled, and sample data is not presented as real.'}
                </p>
              </div>
            </div>
          )}

          {selected === 'reports' && (
            <button type="button" onClick={onOpenFeedbackAdmin}
              className="w-full rounded-2xl border border-emerald-200 bg-white px-4 py-4 flex items-center gap-3 text-start hover:bg-emerald-50 transition-colors">
              <MessageSquareText className="w-5 h-5 text-emerald-700 shrink-0" />
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-extrabold text-slate-900">{ar ? 'فتح البلاغات وتقييمات المحلل المحلي' : 'Open analyzer feedback reports'}</span>
                <span className="block text-[11px] text-slate-500 mt-1">{ar ? 'مراجعة البلاغات وإعدادات ظهور طلب التقييم' : 'View reports and configure rating prompts'}</span>
              </span>
              {ar ? <ArrowLeft className="w-4 h-4 text-emerald-600 shrink-0" /> : <ArrowRight className="w-4 h-4 text-emerald-600 shrink-0" />}
            </button>
          )}

          {selected === 'users' && <AdminAppUsersView lang={lang} />}
          {selected === 'ai' && <AdminAiUsageCard lang={lang} />}

          {selected === 'system' && (
            <>
              <section className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
                  <RotateCcw className="w-4 h-4 text-slate-600" />
                  <span>{t.dataManagement}</span>
                </div>
                <p className="text-xs text-slate-500">
                  {ar ? 'ملاحظة: الأدوات التالية تخص بيانات حسابك الحالي، ولا تعدل حسابات بقية المستخدمين.' : 'Note: These controls affect only your current account, not other users.'}
                </p>
                <p className="text-xs text-slate-500">{t.resetNotice}</p>
                <div className="flex flex-col gap-2">
                  <button type="button" onClick={handleZeroBalances}
                    className="w-full py-2.5 px-4 rounded-xl border border-rose-200 bg-rose-50/50 hover:bg-rose-50 text-rose-700 text-xs font-bold flex items-center justify-center gap-2">
                    <RotateCcw className="w-3.5 h-3.5" />{t.zeroAllBalances}
                  </button>
                  <button type="button" onClick={handleReset}
                    className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-2">
                    <RotateCcw className="w-3.5 h-3.5" />{t.resetDemoData}
                  </button>
                </div>
                {confirmation && (
                  <div role="status" className="p-2.5 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    {confirmation === 'zero'
                      ? (ar ? 'تم تصفير جميع الأرصدة بنجاح' : 'All balances set to zero successfully')
                      : (ar ? 'تمت استعادة البيانات الافتراضية بنجاح' : 'Demo data reset successfully')}
                  </div>
                )}
              </section>
              <section className="bg-slate-100/70 border border-slate-200/60 rounded-2xl p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
                  <Database className="w-4 h-4 text-slate-500" />{t.devDiagnostics}
                </div>
                <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />{t.storageEnforcementBadge}
                </div>
                <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-600" dir="ltr">
                  <div>Active Auth: <strong>Admin ({user.email})</strong></div>
                  <div>Firestore Database: <strong>ai-studio-mybucket-8e5dde08...</strong></div>
                  <div>Storage Mode: Structured Firestore Documents Only</div>
                </div>
                <p className="text-[11px] text-slate-400">{t.devNote}</p>
              </section>
            </>
          )}
        </section>
      )}
    </div>
  );
}
