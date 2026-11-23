import type { AdContactDetails } from '../../utils/adContent';
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
import { type AdPriceLock, type AdPriceLockResult, type PaidAdPrices, DEFAULT_PAID_AD_PRICES, cairoAdTransferTime, normalizeAdTransferReference, normalizePaymentContactPhone, adRunDays, isPaymentContactPhoneValid, isReceiptImageAllowed } from '../../utils/adCheckout';

import { INSTA_PAY_LINK } from '../../config/instaPay';
import { compressAdImage } from '../../utils/adImageCompression';
import { compressAdVideo, validateAdVideoDuration } from '../../utils/adVideoCompression';

type Invoice = AdPriceLock & { id: string; phone: string };
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
  adContacts?: AdContactDetails;
  videoLimit: number;
  mediaFile?: File | string;
  dailyPriceEgp: number;
  vipDurationDays?: number;
  initialInvoice?: Invoice;
  onPricesChange: (prices: PaidAdPrices) => void;
  onBack: () => void;
  onNavigate: (path: string) => void;
}

export function AdPaymentCheckout({
  tier, lang, advertiserName, adTitle, startsAt, endsAt, mediaType, adDescription, categorySlug, adContact, adContacts, videoLimit, mediaFile, dailyPriceEgp, vipDurationDays, initialInvoice, onPricesChange, onBack, onNavigate
}: Props) {
  const ar = lang === 'ar';
  const [invoice, setInvoice] = useState(initialInvoice);
  const [legacyMode, setLegacyMode] = useState(Boolean(initialInvoice?.legacyTransfer));
  const [legacyReference, setLegacyReference] = useState('');
  const [legacyTime, setLegacyTime] = useState('');
  const [legacyAmount, setLegacyAmount] = useState('');
  const dailyPrice = invoice?.dailyPriceEgp ?? (legacyMode ? DEFAULT_PAID_AD_PRICES[tier] : dailyPriceEgp);
  const receiptRequired = (invoice?.amountEgp ?? dailyPrice) > 0;
  const needsUpload = receiptRequired || mediaType !== 'none';
  const tierLabel = tier === 'vip' ? 'VIP' : (ar ? 'مميز' : 'Featured');
  const BackIcon = ar ? ArrowRight : ArrowLeft;
  const [phone, setPhone] = useState(initialInvoice?.phone ?? '');
  const [phoneTouched, setPhoneTouched] = useState(false);
  const [savedPhone, setSavedPhone] = useState(initialInvoice?.phone ?? '');
  const [phoneState, setPhoneState] = useState<'loading' | 'ready' | 'saving' | 'error'>(initialInvoice ? 'ready' : 'loading');
  useEffect(() => {
    if (initialInvoice) return;
    let active = true;
    offerAdsRequest<{ phone: string }>('ads.paymentContact', {}, true)
      .then(({ phone }) => { if (active) { setPhone(phone); setSavedPhone(phone); setPhoneState('ready'); } })
      .catch(() => { if (active) setPhoneState('error'); });
    return () => { active = false; };
  }, [initialInvoice]);
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
  const [restoredMedia, setRestoredMedia] = useState<File | null>(null);
  const [restoringMedia, setRestoringMedia] = useState(false);
  const [mediaError, setMediaError] = useState(false);
  const checkoutMedia = mediaFile ?? restoredMedia;
  const mediaReady = mediaType === 'none' || !!checkoutMedia;
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptError, setReceiptError] = useState('');
  const [dragging, setDragging] = useState(false);
  const phoneValid = isPaymentContactPhoneValid(phone);
  const runDays = vipDurationDays ?? adRunDays(startsAt, endsAt);
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
  const paymentDraft = useRef<{ id: string; prepared?: PaidPreparation; receipt?: UploadedAdMedia; media?: UploadedAdMedia } | null>(initialInvoice ? { id: initialInvoice.id } : null);
  const [priceMessage, setPriceMessage] = useState('');
  const adDetails = {
    tier, title: adTitle, description: adDescription, merchant: advertiserName,
    categorySlug, contact: adContact, ...adContacts, paymentPhone: savedPhone,
    ...(vipDurationDays !== undefined ? { vipDurationDays } : { startsAt: startsAt.getTime(), endsAt: endsAt.getTime() }),
    resourceType: mediaType === 'none' ? null : mediaType,
  };

  const lockPrice = async () => {
    if (sendLock.current || invoice || !phoneSaved || runDays === null || (needsUpload && paymentReady !== 'yes')) return;
    const transferredAt = legacyMode ? cairoAdTransferTime(legacyTime) : null;
    const reference = legacyMode ? normalizeAdTransferReference(legacyReference) : null;
    const amountEgp = Number(legacyAmount);
    if (legacyMode && (!reference || transferredAt === null || transferredAt > Date.now() || !Number.isSafeInteger(amountEgp) || amountEgp <= 0)) {
      setPriceMessage(ar ? 'أدخل مرجع التحويل وتوقيته بتوقيت القاهرة والمبلغ المحوّل.' : 'Enter the transfer reference, Cairo date and time, and the amount sent.');
      return;
    }
    sendLock.current = true;
    setSending(true);
    setPriceMessage('');
    const draft = paymentDraft.current ?? { id: crypto.randomUUID() };
    paymentDraft.current = draft;
    try {
      const result = await offerAdsRequest<AdPriceLockResult>('ads.lockPrice', {
        ...adDetails, id: draft.id, amountEgp: runDays * dailyPrice,
        ...(legacyMode && { legacyTransfer: { reference, transferredAt, amountEgp } }),
      }, true);
      if (result.priceChanged === true) {
        onPricesChange(result.prices);
        setPriceMessage(ar ? 'سعر الإعلان اتغيّر. راجع الإجمالي الجديد واضغط «متابعة للدفع».' : 'The ad rate changed. Review the new total and select Continue to payment.');
        return;
      }
      setInvoice({ ...result, id: draft.id, phone: savedPhone });
      const url = new URL(window.location.href);
      url.searchParams.set('invoice', draft.id);
      window.history.replaceState(window.history.state, '', url);
    } catch {
      setPriceMessage(legacyMode ? (ar ? 'تعذّر تسجيل طلب المراجعة. تأكد من البيانات وحاول مرة أخرى.' : 'Could not create the review request. Check the details and try again.') : ar ? 'تعذّر تجهيز طلب الدفع. حاول مرة أخرى قبل التحويل.' : 'We could not prepare your payment request. Try again before transferring money.');
    } finally {
      sendLock.current = false;
      setSending(false);
    }
  };

  const submit = async () => {
    if (sendLock.current || !invoice || (receiptRequired && !receiptFile) || !mediaReady || submitted) return;
    sendLock.current = true;
    setSending(true);
    setSendError('');
    const draft = paymentDraft.current;
    try {
      draft.prepared ??= await offerAdsRequest<PaidPreparation>('ads.prepare', {
        ...adDetails, id: invoice.id, amountEgp: invoice.amountEgp,
        bytes: typeof checkoutMedia === 'string' ? 1 : checkoutMedia?.size ?? 0,
        receiptBytes: receiptFile?.size,
      }, true);
      if (!draft.prepared.submitted) {
        if (receiptRequired && !draft.prepared.receiptSigned) throw new Error('receipt_required');
        if (receiptFile && draft.prepared.receiptSigned && !draft.receipt) {
          setUploadProgress(0);
          draft.receipt = await uploadAdMedia(receiptFile, draft.prepared.receiptSigned, setUploadProgress);
        }
        if (checkoutMedia && draft.prepared.signed && !draft.media) {
          setUploadProgress(0);
          draft.media = await uploadAdMedia(checkoutMedia, draft.prepared.signed, setUploadProgress);
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
      setSendError(code === 'invalid_video_duration' || code === 'ad_video_duration_unavailable'
        ? (ar ? `مدة الفيديو تتجاوز ${videoLimit} ثانية أو لا يمكن التحقق منها.` : `The video exceeds ${videoLimit} seconds or its duration could not be verified.`)
        : code === 'ad_upload_daily_limit'
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
    if (!file || !invoice || sendLock.current || paymentDraft.current?.prepared) return;
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
      <h1 className="flex items-center gap-2 text-lg font-extrabold"><Check className="size-5" aria-hidden="true" />{ar ? `تم إرسال إعلانك ${tierLabel} للإدارة بنجاح.` : `Your ${tierLabel} ad was sent successfully.`}</h1>
      <p className="text-sm">{ar ? 'تتم المراجعة والرد خلال ٢٤ ساعة تقريبًا. تقدر تتابع من الملف الشخصي في «إعلاناتي».' : 'Review usually takes around 24 hours. Track the status in My ads in your profile.'}</p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
        <a href="/settings/ads" onClick={event => followInternalLink(event, onNavigate)} className="inline-flex min-h-11 items-center font-bold underline">{ar ? 'متابعة الإعلان' : 'Track ad'}</a>
        <a href="/" onClick={event => followInternalLink(event, onNavigate)} className="inline-flex min-h-11 items-center font-bold underline">{ar ? 'الصفحة الرئيسية' : 'Home'}</a>
      </div>
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
                <h1 className="text-lg font-black sm:text-xl">{ar ? 'مراجعة الإعلان والدفع' : 'Review Ad & Payment'}</h1>
                <p className="mt-1 text-xs text-slate-600 dark:text-slate-300">
                  {ar ? 'راجع سعر الإعلان ومدته، ثم أكمل الدفع وأرسل الإيصال للمراجعة.' : 'Review the ad price and duration, then complete payment and submit the receipt.'}
                </p>
              </div>
            </div>
            <button type="button" onClick={onBack} disabled={sending || !!invoice} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 text-xs font-extrabold text-slate-700 hover:bg-slate-50 sm:self-center dark:border-slate-700 dark:bg-slate-800 dark:text-white">
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
                  {invoice ? (invoice.legacyTransfer ? (ar ? 'مراجعة تحويل سابق' : 'Previous transfer review') : (ar ? 'جاهز للدفع' : 'Ready for payment')) : (ar ? 'قبل الدفع' : 'Before payment')}
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
                {vipDurationDays !== undefined ? <p>{ar ? 'النشر يبدأ فور موافقة الإدارة.' : 'Publication begins immediately upon approval.'}</p> : <>
                <p>{ar ? 'بداية النشر بتوقيت القاهرة ' : 'Starts (Cairo time) '}{dates.format(startsAt)}</p>
                <p>{ar ? 'نهاية النشر بتوقيت القاهرة ' : 'Ends (Cairo time) '}{dates.format(endsAt)}</p></>}
              </div>
              {invoice && <p className="text-xs text-slate-600 dark:text-slate-300">
                {ar ? 'رقم الطلب' : 'Request ID'} <bdi>{invoice.id}</bdi> · {dates.format(invoice.createdAt)}
              </p>}
              <div className="space-y-3 border-t border-emerald-200 pt-4 text-sm dark:border-slate-700">
                <div className="flex items-center justify-between gap-3 text-slate-600 dark:text-slate-300">
                  <span>{ar ? 'سعر اليوم' : 'Daily rate'}</span>
                  <span className="font-bold">{amount(dailyPrice)}</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-300">{ar ? 'أي جزء من يوم يتحسب يوم كامل.' : 'A partial day is billed as a full day.'}</p>
                <div className="flex items-center justify-between gap-3 border-t border-emerald-200 pt-3 text-base font-black dark:border-slate-700">
                  <span className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-emerald-700" />{ar ? 'إجمالي المبلغ المطلوب' : 'Total due'}</span>
                  <span className="rounded-xl bg-emerald-700 px-4 py-2 text-white">{runDays === null ? '—' : amount(invoice?.amountEgp ?? runDays * dailyPrice)}</span>
                </div>
              </div>
            </section>

            <section className="space-y-2.5">
              <label htmlFor="ad-checkout-phone" className="flex items-center gap-2 text-sm font-bold">
                <Phone className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                {ar ? 'رقم الموبايل للتواصل بخصوص الإعلان' : 'Mobile number to contact you about your ad'}
              </label>
              <input id="ad-checkout-phone" type="tel" inputMode="tel" autoComplete="tel" dir="ltr" value={phone}
                onChange={event => setPhone(event.target.value)} maxLength={24} disabled={phoneState === 'loading' || phoneState === 'saving' || sending || !!invoice}
                placeholder={ar ? 'مثال: 01000000000' : 'Example: 01000000000'}
                aria-invalid={phoneTouched && !phoneValid}
                aria-describedby="ad-checkout-phone-help"
                className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              {phoneSaved ? <p id="ad-checkout-phone-help" role="status" className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <Check className="h-4 w-4" aria-hidden="true" />
                {ar ? 'رقمك محفوظ بالفعل. هنستخدمه لو احتجنا نتواصل معاك بخصوص الإعلان.' : 'Your number is saved. We may use it to contact you about this ad.'}
              </p> : <p id="ad-checkout-phone-help" className="text-xs leading-5 text-slate-600 dark:text-slate-300">
                {phoneValid ? (ar ? 'اضغط «حفظ الرقم» علشان تقدر تكمل الدفع.' : 'Save this number to continue to payment.')
                  : (ar ? 'اكتب رقم موبايل مصري صحيح واحفظه للمتابعة.' : 'Enter a valid Egyptian mobile number and save it to continue.')}
              </p>}
              {phoneTouched && !phoneValid && <p role="alert" className="text-xs font-bold text-rose-700 dark:text-rose-300">
                {ar ? 'تأكد من رقم الموبايل وحاول تاني.' : 'Check the mobile number and try again.'}
              </p>}
              {phoneState === 'loading' && <p role="status" className="text-xs">{ar ? 'جارٍ تحميل رقمك…' : 'Loading your number…'}</p>}
              {phoneState === 'error' && <p role="alert" className="text-xs text-rose-700 dark:text-rose-300">{ar ? 'تعذّر تحميل أو حفظ الرقم. حاول مرة أخرى.' : 'Could not load or save your number. Try again.'}</p>}
              {!phoneSaved && !invoice && <button type="button" onClick={() => void savePhone()} disabled={phoneState === 'saving' || phoneState === 'loading' || sending}
                className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50">
                {phoneState === 'saving' ? (ar ? 'جارٍ الحفظ…' : 'Saving…') : (ar ? 'حفظ الرقم' : 'Save number')}
              </button>}
            </section>

            <section className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
              <h2 className="flex items-center gap-2 text-sm font-extrabold text-emerald-900 dark:text-emerald-200">
                <ShieldCheck className="h-5 w-5" />
                {ar ? 'الدفع ومراجعة الإعلان' : 'Payment and ad review'}
              </h2>
              {priceMessage && <p role="alert" className="text-sm font-bold text-rose-700 dark:text-rose-300">{priceMessage}</p>}
              {invoice ? (invoice.legacyTransfer ? <p role="status" className="text-sm">
                {ar ? 'أرفق إيصال التحويل السابق. الإعلان يظل معلقًا لحد ما الإدارة تراجع التحويل وتطابقه.' : 'Attach your previous transfer receipt. The ad stays pending until the administrator verifies the transfer.'}
              </p> : receiptRequired ? <>
                <p className="text-sm">{ar ? 'المبلغ جاهز للدفع. افتح إنستا باي وحوّل الإجمالي الموضح بالأعلى، وبعدها ارجع هنا وارفع صورة الإيصال.' : 'Your total is ready. Open InstaPay, transfer the amount shown above, then return here and upload your receipt.'}</p>
                <a href={INSTA_PAY_LINK} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-xl bg-emerald-700 px-4 font-bold text-white">
                  {ar ? 'فتح إنستا باي للدفع' : 'Open InstaPay to pay'}
                </a>
              </> : <p className="text-sm">{ar ? 'مش مطلوب دفع في الحالة دي. تقدر ترسل الإعلان للمراجعة مباشرة.' : 'No payment is required. You can send the ad for review now.'}</p>) : <>
                {legacyMode ? <>
                  <p className="text-sm">{ar ? 'لو حوّلت مبلغ قبل تسجيل طلب الإعلان، اكتب بيانات التحويل علشان الإدارة تراجعها.' : 'If you transferred money before registering your ad request, enter the transfer details for review.'}</p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <label className="grid gap-1 text-xs font-bold">{ar ? 'مرجع التحويل' : 'Transfer reference'}
                      <input value={legacyReference} maxLength={48} onChange={event => setLegacyReference(event.target.value)} dir="ltr" disabled={sending}
                        className="min-h-11 min-w-0 rounded-lg border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-900" />
                    </label>
                    <label className="grid gap-1 text-xs font-bold">{ar ? 'وقت التحويل بتوقيت القاهرة' : 'Transfer time in Cairo'}
                      <input type="datetime-local" step={1} value={legacyTime} onChange={event => setLegacyTime(event.target.value)} disabled={sending}
                        className="min-h-11 min-w-0 rounded-lg border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-900" />
                    </label>
                    <label className="grid gap-1 text-xs font-bold">{ar ? 'المبلغ المحوّل (ج.م.)' : 'Amount sent (EGP)'}
                      <input type="number" min={1} step={1} value={legacyAmount} onChange={event => setLegacyAmount(event.target.value)} disabled={sending}
                        className="min-h-11 min-w-0 rounded-lg border border-slate-300 bg-white px-2 dark:border-slate-700 dark:bg-slate-900" />
                    </label>
                  </div>
                </> : <p className="text-sm">{ar ? 'راجع سعر الإعلان ومدته بالأعلى، وبعدها اضغط «متابعة للدفع».' : 'Review the ad price and duration above, then select Continue to payment.'}</p>}
                <button type="button" disabled={sending || !phoneSaved || runDays === null || (needsUpload && paymentReady !== 'yes')}
                  onClick={() => void lockPrice()} className="min-h-11 rounded-xl bg-emerald-700 px-4 text-sm font-bold text-white disabled:opacity-50">
                  {sending ? (ar ? 'جارٍ تجهيز الطلب…' : 'Preparing request…') : legacyMode ? (ar ? 'متابعة لمراجعة التحويل السابق' : 'Continue previous transfer review') : (ar ? 'متابعة للدفع' : 'Continue to payment')}
                </button>
                {!phoneSaved && <p className="text-xs text-slate-600 dark:text-slate-300">{ar ? 'احفظ رقم الموبايل بالأعلى علشان تقدر تكمل.' : 'Save your mobile number above to continue.'}</p>}
                {needsUpload && paymentReady !== 'yes' && <p role="status" className="text-xs font-semibold">
                  {paymentReady === 'checking' ? (ar ? 'جارٍ التحقق من إتاحة الإرسال…' : 'Checking submission availability…')
                    : paymentReady === 'daily_limit' ? (ar ? 'حصة الرفع خلصت. جرّب بعد منتصف الليل بتوقيت القاهرة.' : 'Your upload allowance resets at midnight Cairo time.')
                    : paymentReady === 'active' ? (ar ? 'عندك رفع قيد التنفيذ أو التحقق. كمّله الأول.' : 'You have an upload in progress. Complete it first.')
                    : paymentReady === 'paused' ? (ar ? 'رفع الإيصالات متوقف مؤقتًا.' : 'Receipt uploads are temporarily paused.')
                    : (ar ? 'تعذّر التحقق من إتاحة الإرسال.' : 'Could not check submission availability.')}
                  {paymentReady !== 'checking' && <> <button type="button" onClick={() => setAvailabilityAttempt(value => value + 1)} className="underline">{ar ? 'تحقق تاني' : 'Check again'}</button></>}
                </p>}
                {legacyMode ? <button type="button" disabled={sending} className="block text-xs font-semibold text-emerald-800 underline dark:text-emerald-200"
                  onClick={() => { setLegacyMode(false); setPriceMessage(''); paymentDraft.current = null; }}>
                  {ar ? 'العودة للدفع العادي' : 'Back to regular payment'}
                </button> : <details className="border-t border-emerald-200/70 pt-3 text-xs dark:border-emerald-900">
                  <summary className="w-fit cursor-pointer font-semibold text-emerald-800 underline dark:text-emerald-200">
                    {ar ? 'هل حوّلت فلوس قبل إنشاء طلب الإعلان؟' : 'Already transferred before creating your ad request?'}
                  </summary>
                  <p className="mt-2 text-slate-600 dark:text-slate-300">{ar ? 'دي حالة خاصة لو حوّلت مبلغ قبل تسجيل الطلب ومفيش طلب مربوط بالتحويل.' : 'This option is only for a payment made before creating a request, with no recorded request for the transfer.'}</p>
                  <button type="button" disabled={sending} className="mt-2 font-bold text-emerald-800 underline dark:text-emerald-200"
                    onClick={() => { setLegacyMode(true); setPriceMessage(''); paymentDraft.current = null; }}>
                    {ar ? 'مراجعة تحويل سابق' : 'Review previous transfer'}
                  </button>
                </details>}
              </>}
            </section>

            {initialInvoice && mediaType !== 'none' && !mediaFile && <section className="space-y-2">
              <label htmlFor="invoice-media" className="block text-sm font-bold">
                {ar ? 'اختر ملف الإعلان الأصلي مرة أخرى' : 'Select the original ad media again'}
              </label>
              <input id="invoice-media" type="file" accept={mediaType === 'image' ? 'image/png,image/jpeg,image/webp' : 'video/mp4,video/webm,video/quicktime'}
                disabled={restoringMedia || sending || !!paymentDraft.current?.prepared} onChange={async event => {
                  const original = event.target.files?.[0];
                  if (!original) return;
                  setMediaError(false);
                  setRestoringMedia(true);
                  setRestoredMedia(null);
                  try {
                    if (mediaType === 'image') {
                      setRestoredMedia(await compressAdImage(original));
                    } else {
                      let ready = original;
                      try {
                        ready = await compressAdVideo(original, undefined, undefined, videoLimit);
                      } catch (error) {
                        if (!(error instanceof Error) || error.message !== 'video_compression_unavailable') throw error;
                      }
                      if (ready !== original) {
                        try { await validateAdVideoDuration(ready, videoLimit); }
                        catch { ready = original; }
                      }
                      setRestoredMedia(ready);
                    }
                  } catch {
                    setMediaError(true);
                  } finally {
                    setRestoringMedia(false);
                  }
                }} />
              {mediaType === 'video' && <p className="text-xs">{ar ? `الحد الأقصى للفيديو ${videoLimit} ثانية.` : `Video limit: ${videoLimit} seconds.`}</p>}
              {restoringMedia && <p role="status">{ar ? 'جارٍ تجهيز الملف…' : 'Preparing media…'}</p>}
              {mediaError && <p role="alert">{ar ? 'تعذّر تجهيز الملف. راجع نوع الملف وحجمه ومدة الفيديو.' : 'Could not prepare the media. Check the file type, size and video limit.'}</p>}
            </section>}
            {invoice && receiptRequired && <section className="space-y-3" aria-labelledby="ad-receipt-title">
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
            </section>}

            <section className="space-y-3 border-t border-slate-200 pt-5 dark:border-slate-800">
              <button type="button" onClick={() => void submit()} disabled={sending || !invoice || (receiptRequired && !receiptFile) || !mediaReady || restoringMedia}
                className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-5 py-4 text-sm font-extrabold text-white disabled:opacity-50">
                {sendError ? (ar ? 'إعادة المحاولة' : 'Try again') : (receiptRequired ? (ar ? 'إرسال الإعلان وإيصال الدفع للمراجعة' : 'Send ad and receipt for review') : (ar ? 'إرسال الإعلان للمراجعة' : 'Send ad for review'))}
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
