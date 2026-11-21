import { ChevronDown } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useAppConfirm } from '../AppConfirmDialog';
import { INSTA_PAY_LINK } from '../../config/instaPay';
import { isReceiptImageAllowed } from '../../utils/adCheckout';
import { offerAdsRequest } from '../../services/offerAdsClient';
import { uploadAdMedia, type SignedAdUpload, type UploadedAdMedia } from '../../services/adMediaUpload';
import type { Language } from '../../types';

type Plan = 'basic' | 'pro';
type Payment = {
  id: string; plan: Plan; amount: number; status: 'pending' | 'correction' | 'approved';
  createdAt?: string; reviewedAt?: string; reason?: string; paidExpiresAt?: string; receiptUrl?: string; reference?: string; email?: string; code?: string; commission?: number;
};
const box = 'space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900';
const button = 'inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50';
const input = 'w-full rounded-xl border border-slate-300 bg-transparent p-3 text-sm';
const planLabel = (plan: Plan) => plan === 'basic' ? 'Basic' : 'Pro';

function PaymentTimes({ payment, lang }: { payment: Payment; lang: Language }) {
  const ar = lang === 'ar';
  const formatter = new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-GB', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo',
  });
  return <>
    {[
      { date: payment.createdAt, label: ar ? 'وقت إرسال الطلب' : 'Submitted' },
      { date: payment.reviewedAt, label: payment.status === 'approved' ? (ar ? 'وقت التفعيل' : 'Activated at') : (ar ? 'وقت المراجعة' : 'Reviewed') },
    ].map(({ date, label }) => date && Number.isFinite(Date.parse(date)) && (
      <p key={label} className="text-xs text-slate-600 dark:text-slate-300">
        {label} <time dateTime={date}>{formatter.format(new Date(date))}</time>
      </p>
    ))}
  </>;
}

function ReceiptPreview({ url, lang }: { url: string; lang: Language }) {
  const ar = lang === 'ar';
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <details className="space-y-2" onToggle={event => {
      setOpen(event.currentTarget.open);
      setFailed(false);
    }}>
      <summary className="w-fit cursor-pointer py-2 text-sm font-semibold underline">
        {open ? (ar ? 'إخفاء الإيصال' : 'Hide receipt') : (ar ? 'عرض الإيصال' : 'View receipt')}
      </summary>
      {open && (failed
        ? <p role="alert" className="text-sm text-rose-700">{ar ? 'تعذّر تحميل الإيصال. اقفل المعاينة وافتحها للمحاولة مرة أخرى.' : 'Could not load the receipt. Close and reopen the preview to retry.'}</p>
        : <img src={url} referrerPolicy="no-referrer" onError={() => setFailed(true)}
            alt={ar ? 'صورة إيصال تحويل إنستاباي' : 'InstaPay transfer receipt'}
            className="block h-auto max-h-[75vh] max-w-full rounded-lg border border-slate-200 object-contain" />)}
    </details>
  );
}

export function SubscriptionPayment({ lang, plan, activePaidPlan, onClose, children }: {
  lang: Language; plan: Plan | null; activePaidPlan?: Plan | null; onClose: () => void; children?: ReactNode;
}) {
  const ar = lang === 'ar';
  const [latest, setLatest] = useState<Payment | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [quote, setQuote] = useState<{ plan: Plan; amount: number } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [step, setStep] = useState<'prepare' | 'upload' | 'submit' | null>(null);
  const [progress, setProgress] = useState(0);
  const sending = step !== null;
  const sendLock = useRef(false);
  const uploaded = useRef<{ file: File; media: UploadedAdMedia } | null>(null);

  const message = (err: unknown) => {
    const code = err instanceof Error ? err.message : '';
    if (code === 'receipt_upload_limit') return ar ? 'وصلت لحد محاولات رفع الإيصال. حاول مرة أخرى بعد ساعة.' : 'Receipt upload limit reached. Try again in an hour.';
    if (code === 'payment_already_pending') return ar ? 'عندك طلب قيد المراجعة بالفعل.' : 'A request is already under review.';
    if (code === 'payment_price_changed') return ar ? 'المبلغ المعروض اتغير. تواصل مع الإدارة لو التحويل تم بالفعل.' : 'The price changed. Contact support if you already transferred.';
    if (code === 'active_other_plan') return ar ? 'انتظر انتهاء اشتراكك المدفوع الحالي قبل شراء خطة مختلفة.' : 'Wait until your current paid term ends before buying another plan.';
    return ar ? 'تعذّر إكمال الطلب. راجع الاتصال وحاول مرة أخرى.' : 'Unable to complete the request. Check your connection and retry.';
  };

  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    let checking = false;
    setLoaded(false);
    setError('');

    async function loadStatus(initial = false) {
      if (checking || controller.signal.aborted) return;
      checking = true;
      try {
        const data = await offerAdsRequest<Payment | null>('subscriptionPayment.status', {}, true,
          AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]));
        if (controller.signal.aborted) return;
        pending = data?.status === 'pending';
        setLatest(data);
        setLoaded(true);
      } catch (err) {
        if (initial && !controller.signal.aborted) setError(message(err));
      } finally {
        checking = false;
      }
    }

    const checkPending = () => {
      if (pending && document.visibilityState === 'visible') void loadStatus();
    };
    void loadStatus(true);
    const timer = window.setInterval(checkPending, 30000);
    document.addEventListener('visibilitychange', checkPending);
    return () => {
      controller.abort();
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', checkPending);
    };
  }, [refresh, lang]);

  useEffect(() => {
    if (!plan || !loaded || latest?.status === 'pending') return;
    let active = true;
    setQuote(null);
    setError('');
    offerAdsRequest<{ amount: number }>('subscriptionPayment.quote', { plan }, true, AbortSignal.timeout(15000))
      .then(({ amount }) => { if (active) setQuote({ plan, amount }); })
      .catch(err => { if (active) setError(message(err)); });
    return () => { active = false; };
  }, [plan, loaded, latest?.status, lang]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!plan || quote?.plan !== plan || !file || sending) return;
    if (!isReceiptImageAllowed(file.type, file.size)) {
      setError(ar ? 'اختر صورة JPG أو PNG أو WebP حتى ٥ ميجابايت.' : 'Choose a JPG, PNG or WebP image up to 5 MB.');
      return;
    }
    if (sendLock.current) return;
    sendLock.current = true;
    setError('');
    let phase: 'prepare' | 'upload' | 'submit' = 'prepare';
    try {
      if (uploaded.current?.file !== file) {
        setStep('prepare');
        const signed = await offerAdsRequest<SignedAdUpload>('subscriptionPayment.prepare', { plan, bytes: file.size }, true, AbortSignal.timeout(15000));
        phase = 'upload';
        setStep(phase);
        setProgress(0);
        uploaded.current = { file, media: await uploadAdMedia(file, signed, setProgress, AbortSignal.timeout(60000)) };
      }
      phase = 'submit';
      setStep(phase);
      const saved = await offerAdsRequest<{ status: Payment['status'] }>('subscriptionPayment.submit',
        { ...uploaded.current.media, plan, quotedAmount: quote.amount }, true, AbortSignal.timeout(30000));
      if (!['pending', 'correction', 'approved'].includes(saved.status)) throw new Error('payment_not_saved');
      setFile(null);
      uploaded.current = null;
      setRefresh(value => value + 1);
      onClose();
    } catch (err) {
      if (phase === 'submit') {
        const latestPayment = await offerAdsRequest<Payment | null>('subscriptionPayment.status', {}, true, AbortSignal.timeout(10000)).catch(() => null);
        if (latestPayment && latestPayment.id === uploaded.current?.media.publicId.split('/').at(-1)) {
          setRefresh(value => value + 1);
          onClose();
          return;
        }
        setError(ar ? `الصورة اترفعت. تعذّر تأكيد إرسال الطلب للمراجعة. ${message(err)}` : `Image uploaded. Could not confirm submission for review. ${message(err)}`);
      } else if (phase === 'upload') {
        setError(ar ? 'لم يصل تأكيد برفع الصورة. جرّب إرسالها مرة أخرى.' : 'The image upload could not be confirmed. Try sending again.');
      } else {
        setError(ar ? `تعذّر تجهيز رفع الإيصال. ${message(err)}` : `Could not prepare the receipt upload. ${message(err)}`);
      }
    } finally {
      sendLock.current = false;
      setStep(null);
    }
  }

  const isActivePlan = latest?.status === 'approved' && latest.plan === activePaidPlan;

  return <div className="space-y-4">
    {latest && (!plan || latest.status === 'pending') && <details key={latest.id} className={`${box} group`}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-lg focus-visible:outline-2 focus-visible:outline-emerald-600 [&::-webkit-details-marker]:hidden">
        <span className="space-y-1">
          <span className="block font-bold">{latest.status === 'pending' ? (ar ? 'تم إرسال طلب الاشتراك' : 'Subscription request sent') : (ar ? 'آخر طلب اشتراك' : 'Latest subscription request')} · <span className={isActivePlan ? 'inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400' : undefined}>
            {isActivePlan && <span aria-hidden="true" className="size-2 rounded-full bg-emerald-500" />}
            <bdi>{planLabel(latest.plan)}</bdi>
          </span></span>
          <span className="block text-sm text-slate-600 dark:text-slate-300" role="status">{latest.status === 'pending' ? (ar ? 'قيد المراجعة' : 'Under review') : latest.status === 'correction' ? (ar ? 'مطلوب تصحيح' : 'Correction requested') : isActivePlan ? (ar ? 'مفعّل حاليًا' : 'Currently active') : (ar ? 'تم التفعيل' : 'Activated')}</span>
        </span>
        <ChevronDown aria-hidden="true" className="size-5 shrink-0 transition-transform group-open:rotate-180" />
      </summary>
      <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-700">
        <PaymentTimes payment={latest} lang={lang} />
        {latest.reason && <p>{latest.reason}</p>}
        {latest.paidExpiresAt && <p>{ar ? 'ينتهي في' : 'Ends on'} {new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-GB', { dateStyle: 'long', timeZone: 'Africa/Cairo' }).format(new Date(latest.paidExpiresAt))}</p>}
        {latest.receiptUrl && <ReceiptPreview url={latest.receiptUrl} lang={lang} />}
      </div>
    </details>}
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">{error} <button type="button" className="underline" disabled={sending} onClick={() => setRefresh(value => value + 1)}>{ar ? 'إعادة المحاولة' : 'Retry'}</button></p>}
    {loaded && !plan && latest?.status !== 'pending' && children}
    {!loaded && !error && <p role="status" className="text-sm">{ar ? 'جارٍ تحميل حالة الاشتراك…' : 'Loading subscription status…'}</p>}
    {loaded && plan && latest?.status !== 'pending' && <form onSubmit={submit} className={box}>
      <h2 className="text-lg font-bold">{ar ? 'دفع الاشتراك بإنستاباي' : 'Pay with InstaPay'} · {planLabel(plan)}</h2>
      {quote?.plan === plan ? <>
        <p className="font-bold">{quote.amount} {ar ? 'جنيه مصري' : 'EGP'}</p>
        <p className="text-sm">{ar ? 'حوّل المبلغ، ثم أرفق صورة الإيصال. التفعيل بعد مراجعة التحويل.' : 'Transfer the shown amount, then attach your receipt. Activation follows review.'}</p>
        <a href={INSTA_PAY_LINK} target="_blank" rel="noreferrer" className={button}>{ar ? 'فتح إنستاباي' : 'Open InstaPay'}</a>
        <label className="block text-sm font-bold">{ar ? 'صورة الإيصال' : 'Receipt image'}<input required disabled={sending} type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setFile(event.target.files?.[0] ?? null)} className={input} /></label>
        <button type="submit" disabled={sending || !file} className={button}>
          {step === 'prepare' ? (ar ? 'جارٍ تجهيز الرفع…' : 'Preparing upload…')
            : step === 'upload' ? (ar ? `جارٍ رفع الصورة… ${progress}٪` : `Uploading image… ${progress}%`)
            : step === 'submit' ? (ar ? 'تم رفع الصورة، جارٍ إرسال الطلب…' : 'Image uploaded, submitting request…')
            : (ar ? 'إرسال للمراجعة' : 'Submit for review')}
        </button>
      </> : !error && <p role="status">{ar ? 'جارٍ تحميل المبلغ…' : 'Loading amount…'}</p>}
    </form>}
  </div>;
}

export function AdminSubscriptionPayments({ lang }: { lang: Language }) {
  const ar = lang === 'ar';
  const confirmAction = useAppConfirm();
  const [status, setStatus] = useState<Payment['status']>('pending');
  const [payments, setPayments] = useState<Payment[] | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [busy, setBusy] = useState(false);
  const [references, setReferences] = useState<Record<string, string>>({});
  const [reason, setReason] = useState<Record<string, string>>({});
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    setError('');
    setPayments(null);
    offerAdsRequest<Payment[]>('admin.subscriptionPayment.list', { status }, true)
      .then(data => { if (active) setPayments(data); })
      .catch(() => { if (active) setError(ar ? 'تعذّر تحميل طلبات الدفع.' : 'Could not load payment requests.'); });
    return () => { active = false; };
  }, [status, refresh, ar]);

  async function review(payment: Payment, decision: 'approve' | 'correction') {
    if (busy) return;
    const reference = (references[payment.id] ?? payment.reference ?? '').trim();
    if (decision === 'approve' && !await confirmAction({
      lang, title: ar ? 'تأكيد وصول التحويل' : 'Confirm transfer received',
      description: ar ? `هل طابقت تحويل ${payment.amount} جنيه والرقم المرجعي ${reference} في حسابك؟` : `Did you match the EGP ${payment.amount} transfer and reference ${reference} in your account?`,
      confirmLabel: ar ? 'تأكيد الدفع والتفعيل' : 'Confirm payment and activate', cancelLabel: ar ? 'إلغاء' : 'Cancel',
    })) return;
    setBusy(true);
    setError('');
    try {
      await offerAdsRequest('admin.subscriptionPayment.review', { id: payment.id, decision, reference, reason: reason[payment.id] ?? '' }, true);
      setRefresh(value => value + 1);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setError(code === 'reference_already_used' ? (ar ? 'الرقم المرجعي مُعتمد في طلب آخر.' : 'This reference was already approved.') : code === 'invalid_transfer_reference' ? (ar ? 'راجع الرقم المرجعي الموجود في الإيصال.' : 'Check the reference shown on the receipt.') : (ar ? 'تعذّر حفظ قرار المراجعة.' : 'Could not save the review.'));
    } finally {
      setBusy(false);
    }
  }

  return <section className={box}>
    <h2 className="font-extrabold">{ar ? 'طلبات دفع الاشتراكات' : 'Subscription payment requests'}</h2>
    <label className="block text-sm">{ar ? 'حالة الطلب' : 'Request status'}<select value={status} onChange={event => setStatus(event.target.value as Payment['status'])} className={input}>
      <option value="pending">{ar ? 'قيد المراجعة' : 'Under review'}</option><option value="correction">{ar ? 'مطلوب تصحيح' : 'Correction requested'}</option><option value="approved">{ar ? 'تم التفعيل' : 'Activated'}</option>
    </select></label>
    <button type="button" onClick={() => setRefresh(value => value + 1)} className="min-h-11 text-sm underline">{ar ? 'تحديث الطلبات' : 'Refresh requests'}</button>
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    {payments === null && !error && <p role="status">{ar ? 'جارٍ التحميل…' : 'Loading…'}</p>}
    {payments?.length === 0 && <p>{ar ? 'لا توجد طلبات بهذه الحالة.' : 'No requests with this status.'}</p>}
    {payments?.map(payment => <article key={payment.id} className="space-y-2 rounded-xl border border-slate-200 p-4 text-sm">
      <p className="font-bold">{planLabel(payment.plan)} · {payment.amount} {ar ? 'جنيه' : 'EGP'}</p>
      <p className="break-all">{payment.email}</p>
      <PaymentTimes payment={payment} lang={lang} />
      {payment.status !== 'pending' && payment.reference && <p>{ar ? 'الرقم المرجعي' : 'Reference'} <bdi>{payment.reference}</bdi></p>}
      {payment.receiptUrl && <ReceiptPreview url={payment.receiptUrl} lang={lang} />}
      {payment.code && <p>{ar ? 'كود المسوّق' : 'Marketer code'} <bdi>{payment.code}</bdi></p>}
      {payment.reason && <p>{payment.reason}</p>}
      {payment.commission !== undefined && <p>{ar ? 'عمولة المسوّق' : 'Marketer commission'} {payment.commission} {ar ? 'جنيه' : 'EGP'}</p>}
      {payment.status === 'pending' && <>
        <label className="block font-bold">{ar ? 'الرقم المرجعي من الإيصال' : 'Reference from receipt'}
          <input dir="ltr" maxLength={48} className={input} value={references[payment.id] ?? payment.reference ?? ''}
            onChange={event => setReferences(current => ({ ...current, [payment.id]: event.target.value }))} />
        </label>
        <button type="button" disabled={busy || !(references[payment.id] ?? payment.reference)?.trim()} className={button} onClick={() => void review(payment, 'approve')}>{ar ? 'تأكيد الدفع وتفعيل الاشتراك' : 'Confirm payment and activate'}</button>
        <label className="block">{ar ? 'سبب طلب التصحيح' : 'Correction reason'}<textarea maxLength={300} className={input} value={reason[payment.id] ?? ''} onChange={event => setReason(current => ({ ...current, [payment.id]: event.target.value }))} /></label>
        <button type="button" className="min-h-11 font-bold underline disabled:opacity-50" disabled={busy || !reason[payment.id]?.trim()} onClick={() => void review(payment, 'correction')}>{ar ? 'طلب تصحيح' : 'Request correction'}</button>
      </>}
    </article>)}
  </section>;
}
