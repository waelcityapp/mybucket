import { uploadAdMedia, type SignedAdUpload, type UploadedAdMedia } from '../../services/adMediaUpload';
import { followInternalLink } from '../../utils/navigationHistory';
import { AD_TIME_ZONE } from '../../utils/adSchedule';
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  ArrowLeft, ArrowRight, CalendarDays, Check, LoaderCircle, CreditCard, FileCheck2,
  FileText, Image as ImageIcon, Phone, ShieldCheck, Upload, UserRound, Video, X
} from 'lucide-react';
import type { Language } from '../../types';
import { offerAdsRequest } from '../../services/offerAdsClient';
import { paidAdDailyPrice, normalizePaymentContactPhone, adRunDays, isPaymentContactPhoneValid, isReceiptImageAllowed } from '../../utils/adCheckout';

const INSTA_PAY_LINK = 'https://ipn.eg/S/wael1011/instapay/2dvaYQ';
type PaidPreparation = { submitted: boolean; signed: SignedAdUpload | null; receiptSigned?: SignedAdUpload };

interface Props {
  tier: 'featured' | 'vip';
  lang: Language;
  advertiserName: string;
  adTitle: string;
  startsAt: Date;
  endsAt: Date;
  mediaType: 'image' | 'video' | 'none';
  adDescription: string;
  categorySlug: string;
  adContact: string;
  mediaFile?: File | string;
  onBack: () => void;
  onNavigate: (path: string) => void;
}

export function AdPaymentCheckout({
  tier, lang, advertiserName, adTitle, startsAt, endsAt, mediaType, adDescription, categorySlug, adContact, mediaFile, onBack, onNavigate
}: Props) {
  const ar = lang === 'ar';
  const dailyPrice = paidAdDailyPrice(tier);
  const tierLabel = tier === 'vip' ? 'VIP' : (ar ? 'مميز' : 'Featured');
  const BackIcon = ar ? ArrowRight : ArrowLeft;
  const [phone, setPhone] = useState('');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [savedPhone, setSavedPhone] = useState('');
  const [phoneState, setPhoneState] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  useEffect(() => {
    let active = true;
    offerAdsRequest<{ phone: string }>('ads.paymentContact', {}, true)
      .then(({ phone }) => { if (active) { setPhone(phone); setSavedPhone(phone); setPhoneState('ready'); } })
      .catch(() => { if (active) setPhoneState('error'); });
    return () => { active = false; };
  }, []);
  const savePhone = async () => {
    setPhoneTouched(true);
    if (!isPaymentContactPhoneValid(phone)) {
      document.getElementById('ad-checkout-phone')?.focus();
      return;
    }
    if (phoneState === 'saving') return;
    setPhoneState('saving');
    try {
      const result = await offerAdsRequest<{ phone: string }>('ads.paymentContact', { phone }, true);
      setPhone(result.phone);
      setSavedPhone(result.phone);
      setPhoneState('ready');
    } catch {
      setPhoneState('error');
    }
  };
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptError, setReceiptError] = useState('');
  const [dragging, setDragging] = useState(false);
  const phoneValid = isPaymentContactPhoneValid(phone);
  const runDays = adRunDays(startsAt, endsAt);
  const amount = (value: number) => new Intl.NumberFormat(ar ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP', maximumFractionDigits: 0 }).format(value);
  const phoneSaved = !!savedPhone && normalizePaymentContactPhone(phone) === savedPhone;
  type PaymentAvailability = 'checking' | 'yes' | 'daily_limit' | 'active' | 'paused' | 'error';
  const [paymentReady, setPaymentReady] = useState<PaymentAvailability>('checking');
  const [availabilityAttempt, setAvailabilityAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setPaymentReady('checking');
    offerAdsRequest<{ available: boolean; reason?: 'daily_limit' | 'active' | 'paused' }>('ads.paidAvailability', {}, true)
      .then(result => { if (active) setPaymentReady(result.available ? 'yes' : (result.reason ?? 'error')); })
      .catch(() => { if (active) setPaymentReady('error'); });
    return () => { active = false; };
  }, [availabilityAttempt]);
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [sendError, setSendError] = useState('');
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const sendLock = useRef(false);
  const paymentDraft = useRef<{ id: string; prepared?: PaidPreparation; receipt?: UploadedAdMedia; media?: UploadedAdMedia } | null>(null);
  const submit = async () => {
    if (sendLock.current || !receiptFile || !phoneSaved || runDays === null || submitted) return;
    sendLock.current = true;
    setSending(true);
    setSendError('');
    const draft = paymentDraft.current ?? { id: crypto.randomUUID() };
    paymentDraft.current = draft;
    try {
      draft.prepared ??= await offerAdsRequest<PaidPreparation>('ads.prepare', {
        id: draft.id, tier, title: adTitle, description: adDescription, merchant: advertiserName,
        categorySlug, contact: adContact, paymentPhone: savedPhone, amountEgp: runDays * dailyPrice,
        startsAt: startsAt.getTime(), endsAt: endsAt.getTime(), resourceType: mediaType === 'none' ? null : mediaType,
        bytes: typeof mediaFile === 'string' ? 1 : mediaFile?.size ?? 0, receiptBytes: receiptFile.size,
      }, true);
      if (!draft.prepared.submitted) {
        if (!draft.prepared.receiptSigned) throw new Error('receipt_required');
        if (!draft.receipt) {
          setUploadProgress(0);
          draft.receipt = await uploadAdMedia(receiptFile, draft.prepared.receiptSigned, setUploadProgress);
        }
        if (mediaFile && draft.prepared.signed && !draft.media) {
          setUploadProgress(0);
          draft.media = await uploadAdMedia(mediaFile, draft.prepared.signed, setUploadProgress);
        }
        setUploadProgress(null);
        const result = await offerAdsRequest<{ submitted: boolean }>('ads.submit', { id: draft.id, ...draft.media, receipt: draft.receipt }, true);
        if (result.submitted !== true) throw new Error('ad_submission_unconfirmed');
      }
      setSubmitted(true);
      window.scrollTo(0, 0);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'ad_upload_daily_limit') setPaymentReady('daily_limit');
      if (code === 'ad_upload_active') setPaymentReady('active');
      if (code === 'ad_upload_paused') setPaymentReady('paused');
      setSendError(code === 'ad_upload_daily_limit'
        ? (ar ? 'حصة رفع الملفات غير كافية حاليًا. جرّب بعد منتصف الليل بتوقيت القاهرة واحتفظ بالإيصال.' : 'Your upload allowance is too low right now. Keep your receipt and retry after midnight Cairo time.')
        : code === 'ad_upload_active' || code === 'ad_upload_paused'
          ? (ar ? 'رفع الملفات غير متاح حاليًا. احتفظ بالإيصال وحاول تاني بعد قليل.' : 'Uploads are temporarily unavailable. Keep your receipt and try again shortly.')
          : (ar ? 'إرسال الإعلان ما اكتملش. احتفظ بالإيصال وحاول تاني من نفس الصفحة.' : 'Submission did not finish. Keep the receipt and try again from this page.'));
    } finally {
      sendLock.current = false;
      setSending(false);
      setUploadProgress(null);
    }
  };
  const dates = new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: AD_TIME_ZONE });
  const receiptPreviewUrl = useMemo(() => receiptFile ? URL.createObjectURL(receiptFile) : null, [receiptFile]);

  useEffect(() => {
    return () => { if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl); };
  }, [receiptPreviewUrl]);

  const selectReceipt = (file: File | null) => {
    if (!file || sendLock.current || paymentDraft.current?.prepared) return;
    if (!isReceiptImageAllowed(file.type, file.size)) {
      setReceiptError(ar
        ? 'اختر صورة JPG أو PNG أو WebP بحجم لا يتجاوز 5 ميجابايت.'
        : 'Choose a JPG, PNG or WebP image no larger than 5 MB.');
      return;
    }
    setReceiptFile(file);
    setReceiptError('');
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    selectReceipt(event.dataTransfer.files.item(0));
  };

  const summaryItem = (label: string, value: string, icon: typeof UserRound) => {
    const Icon = icon;
    return (
      <div className="rounded-xl border border-emerald-100 bg-white px-3.5 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="mb-1.5 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <Icon className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
          <span>{label}</span>
        </div>
        <p className="break-words text-sm font-extrabold text-slate-900 dark:text-white">{value}</p>
      </div>
    );
  };

  if (submitted) return <main dir={ar ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 p-5 dark:bg-slate-950">
    <section role="status" className="mx-auto max-w-xl space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
      <h1 className="flex items-center gap-2 text-lg font-extrabold"><Check className="size-5" aria-hidden="true" />{ar ? `مبروك! تم إرسال إعلانك ${tierLabel} والإيصال للإدارة بنجاح.` : `Your ${tierLabel} ad and receipt were sent successfully.`}</h1>
      <p className="text-sm">{ar ? 'تتم المراجعة والرد خلال ٢٤ ساعة تقريبًا. تقدر تتابع من الملف الشخصي في «إعلاناتي».' : 'Review usually takes around 24 hours. Track the status in My ads in your profile.'}</p>
      <a href="/settings/ads" onClick={event => followInternalLink(event, onNavigate)} className="inline-flex min-h-11 items-center font-bold underline">{ar ? 'متابعة الإعلان' : 'Track ad'}</a>
    </section>
  </main>;

  return (
    <main dir={ar ? 'rtl' : 'ltr'} className="min-h-screen bg-[#F8FAFC] px-3 py-5 pb-16 text-slate-900 sm:px-6 sm:py-8 dark:bg-slate-950 dark:text-white">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <section className="overflow-hidden rounded-3xl border border-emerald-200 bg-white shadow-lg dark:border-emerald-800 dark:bg-slate-900">
          <header className="flex flex-col gap-4 border-b border-emerald-100 bg-gradient-to-l from-emerald-50 via-white to-teal-50 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7 dark:border-slate-800 dark:from-emerald-950/50 dark:via-slate-900 dark:to-slate-900">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-700 text-white shadow-md">
                <FileText className="h-6 w-6" />
              </span>
              <div>
                <p className="text-xs font-extrabold text-emerald-700 dark:text-emerald-300">My Bucket</p>
                <h1 className="text-lg font-black sm:text-xl">{ar ? 'صفحة الدفع لمراجعة وتأكيد الإعلان' : 'Payment Review & Checkout'}</h1>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  {ar ? 'راجع ملخص الإعلان والفاتورة وأرفق إيصال التحويل.' : 'Review the advertisement, invoice and transfer receipt.'}
                </p>
              </div>
            </div>
            <button type="button" onClick={onBack} disabled={sending || !!paymentDraft.current?.prepared} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 text-xs font-extrabold text-slate-700 hover:bg-slate-50 sm:self-center dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <BackIcon className="h-4 w-4" />
              {ar ? 'الرجوع لتعديل الإعلان' : 'Back to edit advertisement'}
            </button>
          </header>

          <div className="space-y-6 p-4 sm:p-7">
            <div role="status" className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{ar
                ? 'الإدارة بتراجع الإيصال والتحويل قبل الموافقة على النشر.'
                : 'The administrator checks the receipt and transfer before approving publication.'}</p>
            </div>

            <section aria-labelledby="ad-checkout-invoice" className="space-y-4 rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 sm:p-6 dark:border-slate-700 dark:bg-slate-950/50">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-emerald-200 pb-3 dark:border-slate-700">
                <h2 id="ad-checkout-invoice" className="flex items-center gap-2 text-base font-black">
                  <FileCheck2 className="h-5 w-5 text-emerald-700 dark:text-emerald-400" />
                  {ar ? 'ملخص الفاتورة' : 'Invoice Summary'}
                </h2>
                <span className="rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 dark:border-slate-700 dark:bg-slate-800 dark:text-emerald-300">
                  {ar ? 'فاتورة غير مُصدرة' : 'Invoice not issued'}
                </span>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {summaryItem(ar ? 'اسم المعلن' : 'Advertiser', advertiserName, UserRound)}
                {summaryItem(ar ? 'الإعلان' : 'Advertisement', adTitle, FileText)}
                {summaryItem(ar ? 'نوع الإعلان' : 'Ad tier', tierLabel, CreditCard)}
                {summaryItem(ar ? 'مدة الإعلان' : 'Advertisement duration',
                  runDays === null ? '—' : (ar ? String(runDays) + ' يوم' : String(runDays) + ' days'), CalendarDays)}
                {summaryItem(ar ? 'نوع الوسائط' : 'Media',
                  mediaType === 'video' ? (ar ? 'فيديو إعلاني' : 'Promotional video')
                    : mediaType === 'image' ? (ar ? 'صورة إعلانية' : 'Advertisement image')
                      : (ar ? 'بدون وسائط' : 'No media'), mediaType === 'video' ? Video : ImageIcon)}
              </div>
              <div className="grid grid-cols-1 gap-2 text-xs leading-6 text-slate-600 sm:grid-cols-2 dark:text-slate-300">
                <p>{ar ? 'بداية النشر بتوقيت القاهرة ' : 'Starts (Cairo time) '}{dates.format(startsAt)}</p>
                <p>{ar ? 'نهاية النشر بتوقيت القاهرة ' : 'Ends (Cairo time) '}{dates.format(endsAt)}</p>
              </div>
              <div className="space-y-3 border-t border-emerald-200 pt-4 text-sm dark:border-slate-700">
                <div className="flex items-center justify-between gap-3 text-slate-600 dark:text-slate-300">
                  <span>{ar ? 'السعر التجريبي لليوم' : 'Trial daily rate'}</span>
                  <span className="font-bold">{amount(dailyPrice)}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">{ar ? 'أي جزء من يوم يتحسب يوم كامل.' : 'A partial day is billed as a full day.'}</p>
                <div className="flex items-center justify-between gap-3 border-t border-emerald-200 pt-3 text-base font-black dark:border-slate-700">
                  <span className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-emerald-700" />{ar ? 'إجمالي المبلغ المطلوب' : 'Total due'}</span>
                  <span className="rounded-xl bg-emerald-700 px-4 py-2 text-white">{runDays === null ? '—' : amount(runDays * dailyPrice)}</span>
                </div>
              </div>
            </section>

            <section className="space-y-2.5">
              <label htmlFor="ad-checkout-phone" className="flex items-center gap-2 text-sm font-bold">
                <Phone className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                {ar ? 'رقم الموبايل لمتابعة الفاتورة' : 'Mobile number for invoice follow-up'}
              </label>
              <div className="relative">
                <input id="ad-checkout-phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" value={phone}
                  onChange={event => setPhone(event.target.value)} maxLength={24} disabled={phoneState === 'loading' || phoneState === 'saving' || sending || !!paymentDraft.current?.prepared}
                  placeholder={ar ? 'مثال: 01000000000' : 'Example: 01000000000'}
                  aria-invalid={phoneTouched && !phoneValid}
                  aria-describedby="ad-checkout-phone-help"
                  className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              </div>
              {(phoneTouched || phone) && <p role="status" className={phoneValid ? 'flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300' : 'text-xs font-bold text-rose-700 dark:text-rose-300'}>
                {phoneValid ? <Check className="h-4 w-4" /> : null}
                {phoneValid ? (ar ? 'صيغة الرقم صحيحة' : 'Valid number format') : (ar ? 'أدخل رقم موبايل مصري صحيح.' : 'Enter a valid Egyptian mobile number.')}
              </p>}
              <p id="ad-checkout-phone-help" className="text-xs leading-5 text-slate-500 dark:text-slate-400">{ar
                ? 'اكتب رقم موبايلك، ثم احفظه. الرقم في الخانة مثال. احفظ الرقم في حسابك عشان يظهر تلقائيًا في الإعلانات المميزة القادمة. تقدر تغيّره في أي وقت.'
                : 'Enter and save your own mobile number. The placeholder is an example. Your saved number will appear for future featured ads.'}</p>
              {phoneState === 'loading' && <p role="status" className="text-xs">{ar ? 'جاري تحميل رقم المتابعة...' : 'Loading your contact number…'}</p>}
              {phoneState === 'error' && <p role="alert" className="text-xs text-rose-700">{ar ? 'تعذّر تحميل أو حفظ الرقم. تقدر تدخله وتحفظه تاني.' : 'Could not load or save the number. Enter it and try saving again.'}</p>}
              {phoneSaved && <p role="status" className="text-xs font-bold text-emerald-700">{ar ? 'الرقم محفوظ في حسابك.' : 'Number saved to your account.'}</p>}
              <button type="button" onClick={() => void savePhone()} disabled={phoneSaved || phoneState === 'saving' || phoneState === 'loading'}
                className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50">
                {phoneState === 'saving' ? (ar ? 'جاري الحفظ...' : 'Saving…') : (ar ? 'حفظ رقم المتابعة' : 'Save contact number')}
              </button>
            </section>

            <section className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
              <h2 className="flex items-center gap-2 text-sm font-extrabold text-emerald-900 dark:text-emerald-200">
                <ShieldCheck className="h-5 w-5" />
                {ar ? 'تعليمات الدفع' : 'Payment instructions'}
              </h2>
              <p className="text-sm leading-6 text-slate-700 dark:text-slate-200">{ar
                ? 'رابط إنستا باي بيفتح التحويل. اكتب مبلغ الفاتورة داخل إنستا باي، وبعد التحويل ارجع هنا عشان ترفق صورة الإيصال وترسلها للمراجعة.'
                : 'The InstaPay link opens the transfer. Enter the invoice amount in InstaPay, then return here to attach and submit your receipt.'}</p>
              {phoneSaved && runDays !== null && paymentReady === 'yes' ? (
                <a href={INSTA_PAY_LINK} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-4 font-bold text-white">
                  {ar ? 'فتح إنستا باي' : 'Open InstaPay'}
                </a>
              ) : <div className="space-y-2">
                <button type="button" disabled className="min-h-11 rounded-xl bg-slate-200 px-4 text-sm font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {ar ? 'فتح إنستا باي' : 'Open InstaPay'}
                </button>
                <p role="status" className="text-xs font-semibold">
                  {paymentReady === 'checking' ? (ar ? 'جاري التحقق من إتاحة الإرسال...' : 'Checking submission availability…')
                    : paymentReady === 'daily_limit' ? (ar ? 'استخدمت ٣ محاولات الرفع المتاحة النهارده. الرابط هيتاح بعد تجديد الحصة عند منتصف الليل بتوقيت القاهرة.' : 'You have used today’s three upload attempts. The link becomes available after midnight Cairo time.')
                    : paymentReady === 'active' ? (ar ? 'عندك رفع قيد التنفيذ أو التحقق. كمّله الأول.' : 'You have an upload in progress. Complete it first.')
                    : paymentReady === 'paused' ? (ar ? 'رفع الإيصالات متوقف مؤقتًا.' : 'Receipt uploads are temporarily paused.')
                    : paymentReady === 'error' ? (ar ? 'تعذّر التحقق من إتاحة الإرسال.' : 'Could not check submission availability.')
                    : (ar ? 'احفظ رقم المتابعة عشان تفتح رابط إنستا باي.' : 'Save your contact number to open InstaPay.')}
                  {paymentReady !== 'yes' && paymentReady !== 'checking' && <> <button type="button" onClick={() => setAvailabilityAttempt(value => value + 1)} className="underline">{ar ? 'تحقق تاني' : 'Check again'}</button></>}
                </p>
              </div>}
            </section>

            <section className="space-y-3" aria-labelledby="ad-receipt-title">
              <h2 id="ad-receipt-title" className="flex items-center gap-2 text-sm font-extrabold">
                <Upload className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                {ar ? 'إرفاق صورة إيصال الدفع' : 'Attach payment receipt image'}
              </h2>
              {receiptPreviewUrl ? (
                <div className="space-y-3 rounded-2xl border border-emerald-200 p-4 dark:border-emerald-900">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="flex items-center gap-1.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                      <Check className="h-4 w-4" />
                      {ar ? 'تم اختيار الصورة على جهازك فقط' : 'Image selected locally only'}
                    </p>
                    <button type="button" disabled={sending || !!paymentDraft.current?.prepared} onClick={() => { setReceiptFile(null); setReceiptError(''); }}
                      className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 text-xs font-bold text-rose-700 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
                      <X className="h-4 w-4" />{ar ? 'حذف وتغيير الصورة' : 'Remove and change'}
                    </button>
                  </div>
                  <img src={receiptPreviewUrl} alt={ar ? 'معاينة صورة الإيصال' : 'Receipt preview'} className="mx-auto max-h-72 max-w-full rounded-xl object-contain" />
                </div>
              ) : (
                <div onDragOver={event => { event.preventDefault(); setDragging(true); }}
                  onDragLeave={event => { event.preventDefault(); setDragging(false); }}
                  onDrop={handleDrop}
                  className={dragging
                    ? 'rounded-2xl border-2 border-dashed border-emerald-600 bg-emerald-100 p-7 text-center dark:bg-emerald-950'
                    : 'rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50/50 p-7 text-center dark:border-emerald-900 dark:bg-slate-950'}>
                  <input id="ad-checkout-receipt" type="file" accept="image/jpeg,image/png,image/webp"
                    onChange={event => { selectReceipt(event.target.files?.item(0) ?? null); event.target.value = ''; }} className="sr-only" />
                  <label htmlFor="ad-checkout-receipt" className="flex cursor-pointer flex-col items-center gap-3">
                    <span className="grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                      <Upload className="h-7 w-7" />
                    </span>
                    <span className="text-sm font-extrabold">{ar ? 'اضغط لاختيار الإيصال أو اسحب الصورة هنا' : 'Click to select a receipt or drop an image here'}</span>
                    <span className="text-xs text-slate-500 dark:text-slate-300">JPG, PNG, WebP — 5 MB</span>
                  </label>
                </div>
              )}
              {receiptError && <p role="alert" className="text-xs font-bold text-rose-700">{receiptError}</p>}
            </section>

            <section className="space-y-3 border-t border-slate-200 pt-5 dark:border-slate-800">
              <button type="button" onClick={() => void submit()} disabled={sending || !phoneSaved || !receiptFile || runDays === null}
                className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-4 text-sm font-extrabold text-white disabled:opacity-50">
                {sendError ? (ar ? 'إعادة المحاولة' : 'Try again') : (ar ? 'إرسال الإعلان وإيصال الدفع للمراجعة' : 'Send ad and receipt for review')}
              </button>
              {sending && <div role="status" className="grid justify-items-center gap-2 py-3 text-sm font-bold">
                <LoaderCircle className="size-7 motion-safe:animate-spin" aria-hidden="true" />
                <p>{ar ? 'جاري إرسال الإعلان، برجاء الانتظار' : 'Sending your ad. Please wait.'}</p>
                {uploadProgress !== null && <progress max={100} value={uploadProgress} aria-label={ar ? 'تقدّم رفع الملف' : 'Upload progress'} className="w-full accent-emerald-700" />}
              </div>}
              {sendError && <p role="alert" className="text-sm font-bold text-rose-700 dark:text-rose-300">{sendError}</p>}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
