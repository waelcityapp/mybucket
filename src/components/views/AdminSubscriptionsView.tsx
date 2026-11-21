import { BrainCircuit, ChevronLeft, ChevronRight, Clock3, CreditCard, SlidersHorizontal } from 'lucide-react';
import type { Language } from '../../types';
import { AdminPlanLimitsView } from './AdminPlanLimitsView';
import { AdminAiQuotaSettings } from './AdminAiQuotaSettings';
import { AdminTrialSettingsView } from './AdminTrialSettingsView';
import { AdminSubscriptionPayments } from './SubscriptionPayment';

const subscriptionPages = ['payments', 'plans', 'trial', 'analysis'] as const;
export type AdminSubscriptionPage = typeof subscriptionPages[number];

export function adminSubscriptionPage(path: string): AdminSubscriptionPage | undefined {
  return subscriptionPages.find(page => path === '/admin/subscriptions/' + page);
}

export function AdminSubscriptionsView({ lang, page, onOpen }: {
  lang: Language;
  page?: AdminSubscriptionPage;
  onOpen: (page: AdminSubscriptionPage) => void;
}) {
  const ar = lang === 'ar';
  const pages = [
    { id: 'payments', icon: CreditCard, title: ar ? 'طلبات الدفع' : 'Payment requests', detail: ar ? 'مراجعة الإيصالات وتفعيل الاشتراكات' : 'Review receipts and activate subscriptions' },
    { id: 'plans', icon: SlidersHorizontal, title: ar ? 'إعدادات الخطط' : 'Plan settings', detail: ar ? 'حدود Basic وPro ومحتوى صفحة الاشتراكات' : 'Basic and Pro limits and subscription page content' },
    { id: 'trial', icon: Clock3, title: ar ? 'مدة الاستخدام المجاني' : 'Free access duration', detail: ar ? 'مدة Basic وسجل تعديلات المدة' : 'Basic duration and its change history' },
    { id: 'analysis', icon: BrainCircuit, title: ar ? 'حدود التحليل والتكلفة' : 'Analysis and cost limits', detail: ar ? 'محاولات Gemini والمحلل المحلي' : 'Gemini and local analyzer attempts' },
  ] as const;

  if (page === 'payments') return <AdminSubscriptionPayments lang={lang} />;
  if (page === 'trial') return <AdminTrialSettingsView lang={lang} />;
  if (page === 'analysis') return <AdminAiQuotaSettings lang={lang} />;

  if (page === 'plans') return <AdminPlanLimitsView lang={lang} />;

  const Chevron = ar ? ChevronLeft : ChevronRight;
  return (
    <nav aria-label={ar ? 'أقسام الاشتراكات' : 'Subscription sections'} className="grid gap-3 sm:grid-cols-2">
      {pages.map(({ id, icon: Icon, title, detail }) => (
        <button key={id} type="button" onClick={() => onOpen(id)}
          className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-start hover:border-emerald-300 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-emerald-600">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="size-5" /></span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-extrabold text-slate-900">{title}</span>
            <span className="mt-1 block text-xs leading-relaxed text-slate-600">{detail}</span>
          </span>
          <Chevron className="size-4 shrink-0 text-emerald-700" />
        </button>
      ))}
    </nav>
  );
}
