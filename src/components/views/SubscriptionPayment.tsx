import { useEffect, useRef, useState, type FormEvent } from 'react';
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
      { date: payment.reviewedAt, label: ar ? 'وقت المراجعة' : 'Reviewed' },
    ].map(({ date, label }) => date && Number.isFinite(Date.parse(date)) && (
      <p key={label} className="text-xs text-slate-600 dark:text-slate-300">
        {label} <time dateTime={date}>{formatter.format(new Date(date))}</time>
      </p>
    ))}
  </>;
}

export function SubscriptionPayment({ lang, plan, onClose }: {
  lang: Language; plan: Plan | null; onClose: () => void;
}) {
  const ar = lang === 'ar';
  const [latest, setLatest] = useState<Payment | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [quote, setQuote] = useState<{ plan: Plan; amount: number } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
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
    let active = true;
    setLoaded(false);
    setError('');
    offerAdsRequest<Payment | null>('subscriptionPayment.status', {}, true)
      .then(data => { if (active) { setLatest(data); setLoaded(true); } })
      .catch(err => { if (active) setError(message(err)); });
    return () => { active = false; };
  }, [refresh, lang]);

  useEffect(() => {
    if (!plan || !loaded || latest?.status === 'pending') return;
    let active = true;
    setQuote(null);
    setError('');
    offerAdsRequest<{ amount: number }>('subscriptionPayment.quote', { plan }, true)
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
    setSending(true);
    setError('');
    try {
      if (uploaded.current?.file !== file) {
        const signed = await offerAdsRequest<SignedAdUpload>('subscriptionPayment.prepare', { plan, bytes: file.size }, true);
        uploaded.current = { file, media: await uploadAdMedia(file, signed, () => {}) };
      }
      await offerAdsRequest('subscriptionPayment.submit', { ...uploaded.current.media, plan, quotedAmount: quote.amount }, true);
      setFile(null);
      uploaded.current = null;
      setRefresh(value => value + 1);
      onClose();
    } catch (err) {
      setError(message(err));
    } finally {
      setSending(false);
    }
  }

  return <div className="space-y-4">
    {latest && (!plan || latest.status === 'pending') && <section className={box}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-bold">{ar ? 'آخر طلب اشتراك' : 'Latest subscription request'} · {planLabel(latest.plan)}</h2>
        <button type="button" onClick={() => setRefresh(value => value + 1)} className="text-sm underline">{ar ? 'تحديث الحالة' : 'Refresh status'}</button>
      </div>
      <p role="status">{latest.status === 'pending' ? (ar ? 'قيد المراجعة' : 'Under review') : latest.status === 'correction' ? (ar ? 'مطلوب تصحيح' : 'Correction requested') : (ar ? 'تم التفعيل' : 'Activated')}</p>
      <PaymentTimes payment={latest} lang={lang} />
      {latest.reason && <p>{latest.reason}</p>}
      {latest.paidExpiresAt && <p>{ar ? 'ينتهي في' : 'Ends on'} {new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-GB', { dateStyle: 'long', timeZone: 'Africa/Cairo' }).format(new Date(latest.paidExpiresAt))}</p>}
      {latest.receiptUrl && <a className="text-sm underline" href={latest.receiptUrl} target="_blank" rel="noreferrer">{ar ? 'عرض الإيصال' : 'View receipt'}</a>}
    </section>}
    {error && <p role="alert" className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900">{error} <button type="button" className="underline" onClick={() => setRefresh(value => value + 1)}>{ar ? 'إعادة المحاولة' : 'Retry'}</button></p>}
    {!loaded && plan && !error && <p role="status" className="text-sm">{ar ? 'جارٍ تحميل الدفع…' : 'Loading payment…'}</p>}
    {loaded && plan && latest?.status !== 'pending' && <form onSubmit={submit} className={box}>
      <h2 className="text-lg font-bold">{ar ? 'دفع الاشتراك بإنستاباي' : 'Pay with InstaPay'} · {planLabel(plan)}</h2>
      {quote?.plan === plan ? <>
        <p className="font-bold">{quote.amount} {ar ? 'جنيه مصري' : 'EGP'}</p>
        <p className="text-sm">{ar ? 'حوّل المبلغ، ثم أرفق صورة الإيصال. التفعيل بعد مراجعة التحويل.' : 'Transfer the shown amount, then attach your receipt. Activation follows review.'}</p>
        <a href={INSTA_PAY_LINK} target="_blank" rel="noreferrer" className={button}>{ar ? 'فتح إنستاباي' : 'Open InstaPay'}</a>
        <label className="block text-sm font-bold">{ar ? 'صورة الإيصال' : 'Receipt image'}<input required type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setFile(event.target.files?.[0] ?? null)} className={input} /></label>
        <button type="submit" disabled={sending} className={button}>{sending ? (ar ? 'جارٍ الإرسال…' : 'Sending…') : (ar ? 'إرسال للمراجعة' : 'Submit for review')}</button>
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
      {payment.receiptUrl && <a className="block underline" href={payment.receiptUrl} target="_blank" rel="noreferrer">{ar ? 'عرض الإيصال' : 'View receipt'}</a>}
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
