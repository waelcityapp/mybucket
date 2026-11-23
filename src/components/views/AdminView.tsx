import { AdminOfferAds } from './AdminOfferAds';
import {
  ArrowLeft, ArrowRight, ShieldCheck,
  MessageSquareText, Users, CreditCard, Megaphone, BrainCircuit,
  ChevronUp, Clock3, PanelsTopLeft, PlayCircle, Palette,
} from 'lucide-react';
import type { AuthUser, Language } from '../../types';
import { AdminSiteVisitsCard } from '../AdminSiteVisitsCard';
import { AdminAiUsageCard } from '../AdminAiUsageCard';
import { AdminAppUsersView } from './AdminAppUsersView';
import { AdminSubscriptionsView, type AdminSubscriptionPage } from './AdminSubscriptionsView';

interface AdminViewProps {
  lang: Language;
  user: AuthUser;
  onBack: () => void;
  onOpenFeedbackAdmin: () => void;
  sectionId?: SectionId | null;
  subscriptionPage?: AdminSubscriptionPage;
  onOpenSubscriptionPage: (page: AdminSubscriptionPage) => void;
  onOpenSection: (section: SectionId) => void;
  onBackToSections: () => void;
  onOpenGrant: (uid: string) => void;
  onOpenNewUserSimulation: () => void;
}

export type SectionId = 'users' | 'subscriptions' | 'marketers' | 'reports' | 'ai' | 'ads' | 'branding';

export function AdminView({
  lang, user, onBack, onOpenFeedbackAdmin,
  sectionId = null, subscriptionPage, onOpenSubscriptionPage, onOpenSection, onBackToSections, onOpenGrant, onOpenNewUserSimulation,
}: AdminViewProps) {
  const ar = lang === 'ar';
  const selected = sectionId;

  const sections = [
    { id: 'users' as const, icon: Users, title: ar ? 'مستخدمى التطبيق' : 'App users', desc: ar ? 'التسجيل والتثبيت والاشتراكات والتحكم بالحسابات' : 'Registrations, installs, plans and account controls', ready: true },
    { id: 'subscriptions' as const, icon: CreditCard, title: ar ? 'الاشتراكات' : 'Subscriptions', desc: ar ? 'طلبات الدفع وإعدادات الخطط ومدة الاستخدام' : 'Payment requests, plan settings and access duration', ready: true },
    { id: 'marketers' as const, icon: Megaphone, title: ar ? 'المسوقون' : 'Marketers', desc: ar ? 'الأكواد والعمولات' : 'Codes and commissions', ready: false },
    { id: 'ads' as const, icon: PanelsTopLeft, title: ar ? 'إدارة الإعلانات' : 'Ads management', desc: ar ? 'مراجعة الإعلانات الواردة والموافقة أو الرفض' : 'Review, approve or reject submitted ads', ready: true },
    { id: 'reports' as const, icon: MessageSquareText, title: ar ? 'البلاغات' : 'Reports', desc: ar ? 'تقييمات المحلل المحلي والتحكم فيها' : 'Local analyzer feedback and controls', ready: true },
    { id: 'ai' as const, icon: BrainCircuit, title: ar ? 'الذكاء الاصطناعي' : 'Artificial intelligence', desc: ar ? 'Gemini والاستهلاك واختيار النموذج' : 'Gemini, usage and model selection', ready: true },
    { id: 'branding' as const, icon: Palette, title: ar ? 'التحكم في هوية التطبيق' : 'App identity', desc: ar ? 'تغيير الاسم والأيقونة عبر Cloudinary' : 'Edit the name and Cloudinary icon', ready: true },
  ];

  const activeSection = sections.find(section => section.id === selected);
  return (
    <div className="space-y-4 pb-24">
      <div className="flex items-start gap-3">
        <button type="button" onClick={subscriptionPage ? () => onOpenSection('subscriptions') : selected ? onBackToSections : onBack}
          aria-label={subscriptionPage ? (ar ? 'رجوع للاشتراكات' : 'Back to subscriptions') : selected ? (ar ? 'العودة للأقسام الرئيسية' : 'Back to admin sections') : (ar ? 'العودة للرئيسية' : 'Back to home')}
          className="mt-0.5 w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center shrink-0">
          {ar ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
        </button>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0" />
            <h1 className="text-xl font-extrabold text-slate-900">{activeSection?.title || (ar ? 'لوحة الإدارة' : 'Admin dashboard')}</h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">{subscriptionPage ? (ar ? 'رجوع للاشتراكات' : 'Back to subscriptions') : selected ? (ar ? 'العودة إلى أقسام الإدارة من زر الرجوع' : 'Use Back to return to admin sections') : (ar ? 'إدارة التطبيق ومتابعة الخدمات من مكان واحد' : 'App administration in one place')}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-3 py-2">
        <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
        <span className="text-[11px] font-semibold text-emerald-900 truncate">{ar ? 'حساب صاحب التطبيق:' : 'App owner:'} {user.email}</span>
      </div>

      {!selected && <AdminSiteVisitsCard lang={lang} />}

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

      {!selected && (
        <button type="button" onClick={onOpenNewUserSimulation}
          className="w-full rounded-2xl border border-emerald-200 bg-emerald-50 p-4 flex items-center gap-3 text-start hover:bg-emerald-100 transition-colors">
          <span className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0"><PlayCircle className="w-5 h-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-extrabold text-emerald-950">{ar ? 'محاكاة مستخدم جديد' : 'Simulate a new user'}</span>
            <span className="block text-xs text-emerald-800/80 mt-1 leading-relaxed">{ar ? 'جرّب التسجيل وإعداد الحسابات وبيانات نموذجية دون تغيير بياناتك الفعلية.' : 'Try the sign-in screen, account setup and sample finances without touching real data.'}</span>
          </span>
        </button>
      )}

      {activeSection && (
        <section className="space-y-3 scroll-mt-24" aria-label={activeSection.title}>
          {selected !== 'subscriptions' && <div className="flex items-center justify-between gap-2 px-1">
            <h2 className="text-base font-extrabold text-slate-900">{activeSection.title}</h2>
            <button type="button" onClick={onBackToSections} className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-emerald-700">
              {ar ? 'الأقسام الرئيسية' : 'All sections'} <ChevronUp className="w-4 h-4" />
            </button>
          </div>}

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

          {selected === 'ads' && <AdminOfferAds lang={lang} />}

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

          {selected === 'users' && <AdminAppUsersView lang={lang} onOpenGrant={onOpenGrant} />}
          {selected === 'subscriptions' && <AdminSubscriptionsView lang={lang} page={subscriptionPage} onOpen={onOpenSubscriptionPage} />}
          {selected === 'ai' && <AdminAiUsageCard lang={lang} />}

        </section>
      )}
    </div>
  );
}
