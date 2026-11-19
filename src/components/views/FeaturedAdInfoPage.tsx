import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { Language } from '../../types';

export function FeaturedAdInfoPage({ lang, onBack }: { lang: Language; onBack: () => void }) {
  const ar = lang === 'ar';
  const Back = ar ? ArrowRight : ArrowLeft;
  return <main dir={ar ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 px-4 py-5 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
    <div className="mx-auto max-w-xl space-y-4">
      <header className="flex items-center gap-3">
        <button type="button" onClick={onBack} aria-label={ar ? 'العودة لإنشاء الإعلان' : 'Back to creating an ad'}
          className="grid size-11 shrink-0 place-items-center rounded-xl bg-slate-200 dark:bg-slate-800">
          <Back className="size-5" aria-hidden="true" />
        </button>
        <h1 className="text-xl font-extrabold">{ar ? 'مميزات الإعلان المدفوع والأسعار' : 'Paid ad benefits and pricing'}</h1>
      </header>
      <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="font-extrabold">{ar ? 'المميزات المقترحة' : 'Proposed benefits'}</h2>
        <ul className="list-disc space-y-2 ps-5 text-sm leading-relaxed">
          <li>{ar ? 'المميز يظهر قبل المجاني داخل قسمه. VIP يظهر أولًا داخل قسمه وكمان في واجهة «وفّر مع My Bucket».' : 'Featured ads appear before free ads in their category. VIP ads also appear on the offers landing page and lead their category.'}</li>
          <li>{ar ? 'زر واتساب برسالة جاهزة باسم العرض، بجانب الاتصال.' : 'WhatsApp with a prefilled offer message, alongside phone contact.'}</li>
          <li>{ar ? 'تقرير عن مرات الظهور وفتح العرض والضغط على وسائل التواصل.' : 'A report on impressions, offer views and contact clicks.'}</li>
        </ul>
      </section>
      <section className="space-y-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 dark:border-emerald-900 dark:bg-emerald-950">
        <h2 className="font-extrabold">{ar ? 'الباقات والأسعار' : 'Packages and pricing'}</h2>
        <p className="text-sm">{ar ? 'السعر التجريبي ١٠٠ جنيه لليوم للمميز و٢٠٠ جنيه لليوم لـVIP. الدفع عبر إنستا باي وإرسال الإيصال للمراجعة.' : 'Trial rates: EGP 100 per day for Featured and EGP 200 per day for VIP. Pay through InstaPay and submit the receipt for review.'}</p>
      </section>
    </div>
  </main>;
}
