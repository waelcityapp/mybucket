import { ArrowRight, BookOpen, CreditCard, ListChecks, Mic, Wallet } from 'lucide-react';
import type { Language } from '../../types';

interface Props { lang: Language; onBack: () => void }
export function UsageGuideView({ lang, onBack }: Props) {
  const ar = lang === 'ar';
  const steps = ar ? [
    { title: '١. جهّز حساباتك', text: 'من إعدادات الحساب، أضف حسابات البنك والكاش وأدخل الرصيد الحالي. لو ما عندكش بنك، ابدأ بالكاش وأضف البنك لاحقًا.', Icon: Wallet },
    { title: '٢. أضف وسائل الدفع', text: 'عند إضافة إنستاباي أو بطاقة خصم، اختر هل هي مستقلة أم مرتبطة بحساب بنكي. الوسيلة المرتبطة تعرض رصيد البنك نفسه ولا تضيفه مرة ثانية للإجمالي.', Icon: CreditCard },
    { title: '٣. سجّل عملياتك', text: 'استخدم مصروف أو دخل أو تحويل، وحدد المبلغ والحساب والبند. ويمكنك كتابة العملية أو قولها بالصوت، ثم مراجعة البيانات وتعديلها قبل الحفظ.', Icon: Mic },
    { title: '٤. راجع وعدّل', text: 'من العمليات والبنود يمكنك مراجعة ما سجلته. عند تعديل مصروف أو حذفه، يحدّث التطبيق الأرصدة المرتبطة به.', Icon: ListChecks },
  ] : [
    { title: '1. Set up accounts', text: 'Open Account settings to add bank accounts and cash with their current balances. You can start with cash and add banks later.', Icon: Wallet },
    { title: '2. Add payment methods', text: 'When adding InstaPay or a debit card, choose whether it is independent or linked to a bank. A linked method displays the bank balance and is not counted twice.', Icon: CreditCard },
    { title: '3. Record transactions', text: 'Choose expense, income or transfer and enter the amount and account. You can also type or speak a transaction, then review and edit it before saving.', Icon: Mic },
    { title: '4. Review and edit', text: 'Review your records in Transactions and Categories. Editing or deleting an expense updates the affected balances.', Icon: ListChecks },
  ];
  return <main dir={ar ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 px-4 py-6 text-slate-900">
    <div className="mx-auto max-w-xl space-y-5">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-900"><ArrowRight className={`h-4 w-4 ${ar ? '' : 'rotate-180'}`} />{ar ? 'رجوع' : 'Back'}</button>
      <header className="space-y-2"><span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700"><BookOpen className="h-5 w-5" /></span><h1 className="text-2xl font-black">{ar ? 'شرح استخدام My Bucket' : 'How to use My Bucket'}</h1><p className="text-sm leading-6 text-slate-600">{ar ? 'خطوات بسيطة تساعدك تبدأ وتنظم حساباتك.' : 'A simple guide to getting started and organizing your accounts.'}</p></header>
      <div className="space-y-3">{steps.map(({ title, text, Icon }) => <section key={title} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-start gap-3"><span className="rounded-xl bg-slate-100 p-2 text-slate-600"><Icon className="h-4 w-4" /></span><div><h2 className="text-sm font-black">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-600">{text}</p></div></div></section>)}</div>
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950"><strong>{ar ? 'قبل ما تجرّب: ' : 'Before you try: '}</strong>{ar ? 'العمليات التي تحفظها تُسجّل في حسابك وتغيّر أرصدته داخل التطبيق. لا يوجد وضع تجربة منفصل حاليًا. التطبيق لا يتصل بالبنك الحقيقي.' : 'Saved transactions are recorded in your account and change your balances in the app. There is no separate practice mode yet. The app does not connect to your real bank.'}</div>
    </div>
  </main>;
}
