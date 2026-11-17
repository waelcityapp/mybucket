import { useEffect, useMemo, useState, type DragEvent } from 'react';
import {
  ArrowLeft, ArrowRight, CalendarDays, Check, Clock3, Copy, CreditCard, FileCheck2,
  FileText, Image as ImageIcon, Phone, ShieldCheck, Upload, UserRound, Video, X
} from 'lucide-react';
import type { Language } from '../../types';
import { adRunDays, isPaymentContactPhoneValid, isReceiptImageAllowed } from '../../utils/adCheckout';

interface Props {
  lang: Language;
  advertiserName: string;
  adTitle: string;
  startsAt: Date;
  endsAt: Date;
  mediaType: 'image' | 'video' | 'none';
  onBack: () => void;
}

export function AdPaymentCheckout({
  lang, advertiserName, adTitle, startsAt, endsAt, mediaType, onBack
}: Props) {
  const ar = lang === 'ar';
  const BackIcon = ar ? ArrowRight : ArrowLeft;
  const [phone, setPhone] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptError, setReceiptError] = useState('');
  const [dragging, setDragging] = useState(false);
  const phoneValid = isPaymentContactPhoneValid(phone);
  const runDays = adRunDays(startsAt, endsAt);
  const dates = new Intl.DateTimeFormat(ar ? 'ar-EG' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const receiptPreviewUrl = useMemo(() => receiptFile ? URL.createObjectURL(receiptFile) : null, [receiptFile]);

  useEffect(() => {
    return () => { if (receiptPreviewUrl) URL.revokeObjectURL(receiptPreviewUrl); };
  }, [receiptPreviewUrl]);

  const selectReceipt = (file: File | null) => {
    if (!file) return;
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
            <button type="button" onClick={onBack} className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 text-xs font-extrabold text-slate-700 hover:bg-slate-50 sm:self-center dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <BackIcon className="h-4 w-4" />
              {ar ? 'الرجوع لتعديل الإعلان' : 'Back to edit advertisement'}
            </button>
          </header>

          <div className="space-y-6 p-4 sm:p-7">
            <div role="status" className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />
              <p>{ar
                ? 'هذه معاينة لصفحة الدفع فقط. الأسعار ورقم استقبال التحويلات وإرسال إيصالات الدفع لم تُفعّل بعد في My Bucket. لا تحوّل أي مبلغ الآن، ولن يتم حفظ صورة الإيصال على الخادم.'
                : 'This is a payment-page preview. Pricing, receiving transfer details and receipt submission are not enabled in My Bucket yet. Do not transfer money now; the receipt image is not saved to the server.'}</p>
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
                {summaryItem(ar ? 'مدة الإعلان' : 'Advertisement duration',
                  runDays === null ? '—' : (ar ? String(runDays) + ' يوم' : String(runDays) + ' days'), CalendarDays)}
                {summaryItem(ar ? 'نوع الوسائط' : 'Media',
                  mediaType === 'video' ? (ar ? 'فيديو إعلاني' : 'Promotional video')
                    : mediaType === 'image' ? (ar ? 'صورة إعلانية' : 'Advertisement image')
                      : (ar ? 'بدون وسائط' : 'No media'), mediaType === 'video' ? Video : ImageIcon)}
              </div>
              <div className="grid grid-cols-1 gap-2 text-xs leading-6 text-slate-600 sm:grid-cols-2 dark:text-slate-300">
                <p>{ar ? 'بداية النشر: ' : 'Starts: '}{dates.format(startsAt)}</p>
                <p>{ar ? 'نهاية النشر: ' : 'Ends: '}{dates.format(endsAt)}</p>
              </div>
              <div className="space-y-3 border-t border-emerald-200 pt-4 text-sm dark:border-slate-700">
                <div className="flex items-center justify-between gap-3 text-slate-600 dark:text-slate-300">
                  <span>{ar ? 'تكلفة نشر الإعلان المميز' : 'Featured ad placement cost'}</span>
                  <span className="font-bold">{ar ? 'السعر قيد التحديد' : 'Pricing not configured'}</span>
                </div>
                {mediaType === 'video' && <div className="flex items-center justify-between gap-3 text-slate-600 dark:text-slate-300">
                  <span>{ar ? 'تكلفة الفيديو الإضافية' : 'Video surcharge'}</span>
                  <span className="font-bold">{ar ? 'غير محددة' : 'Not configured'}</span>
                </div>}
                <div className="flex items-center justify-between gap-3 border-t border-emerald-200 pt-3 text-base font-black dark:border-slate-700">
                  <span className="flex items-center gap-2"><CreditCard className="h-5 w-5 text-emerald-700" />{ar ? 'إجمالي المبلغ المطلوب' : 'Total due'}</span>
                  <span className="rounded-xl bg-emerald-700 px-4 py-2 text-white">{ar ? 'لم يُحدد بعد' : 'Not set yet'}</span>
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
                  onChange={event => setPhone(event.target.value)} maxLength={20}
                  placeholder="01012345678"
                  className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
              </div>
              {phone && <p role="status" className={phoneValid ? 'flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-300' : 'text-xs font-bold text-rose-700 dark:text-rose-300'}>
                {phoneValid ? <Check className="h-4 w-4" /> : null}
                {phoneValid ? (ar ? 'رقم صحيح' : 'Valid phone number') : (ar ? 'أدخل رقم موبايل مصري صحيح.' : 'Enter a valid Egyptian mobile number.')}
              </p>}
              <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">{ar
                ? 'سيُستخدم هذا الرقم للمتابعة بعد تفعيل استقبال طلبات الدفع.'
                : 'This number will be used for follow-up once payment requests are enabled.'}</p>
            </section>

            <section className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 sm:p-5 dark:border-emerald-900 dark:bg-emerald-950/30">
              <h2 className="flex items-center gap-2 text-sm font-extrabold text-emerald-900 dark:text-emerald-200">
                <ShieldCheck className="h-5 w-5" />
                {ar ? 'تعليمات الدفع' : 'Payment instructions'}
              </h2>
              <p className="text-sm leading-7 text-slate-700 dark:text-slate-200">{ar
                ? 'ستتاح التحويلات باستخدام إنستا باي أو فودافون كاش بعد اعتماد الأسعار وبيانات استقبال المدفوعات. لن نعرض رقم تحويل من تطبيق آخر تلقائيًا.'
                : 'InstaPay and Vodafone Cash transfer details will appear after pricing and recipient details are approved. A different app’s payment number is not automatically reused.'}</p>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-emerald-200 pt-3 dark:border-emerald-900">
                <div className="flex flex-wrap gap-2 text-xs font-black text-slate-700 dark:text-slate-200">
                  <span className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 dark:border-emerald-800 dark:bg-slate-900">InstaPay</span>
                  <span className="rounded-full border border-emerald-200 bg-white px-3 py-1.5 dark:border-emerald-800 dark:bg-slate-900">Vodafone Cash</span>
                </div>
                <button type="button" disabled className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-200 px-4 text-xs font-extrabold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <Copy className="h-4 w-4" />
                  {ar ? 'نسخ رقم التحويل بعد التفعيل' : 'Copy transfer number when enabled'}
                </button>
              </div>
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
                    <button type="button" onClick={() => { setReceiptFile(null); setReceiptError(''); }}
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
              <p className="text-xs leading-5 text-slate-500 dark:text-slate-300">{ar
                ? 'للمعاينة فقط: اختيار صورة هنا لا يعني إرسال الإيصال للإدارة أو رفعه إلى Cloudinary.'
                : 'Preview only: selecting an image does not submit it to administrators or upload it to Cloudinary.'}</p>
            </section>

            <section className="space-y-3 border-t border-slate-200 pt-5 dark:border-slate-800">
              <button type="button" disabled className="flex min-h-13 w-full items-center justify-center gap-2 rounded-2xl bg-slate-200 px-5 py-4 text-sm font-black text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                <ShieldCheck className="h-5 w-5" />
                {ar ? 'إرسال الإعلان وإيصال الدفع للمراجعة — قريبًا' : 'Send ad and receipt for review — coming soon'}
              </button>
              <p role="status" className="flex items-start justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-center text-xs font-semibold leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                <Clock3 className="mt-0.5 h-4 w-4 shrink-0" />
                {ar
                  ? 'سيُفعّل إرسال الإعلان للمراجعة بعد ربط الأسعار والفاتورة وإيصالات الدفع بالخادم. لن يُنشر أي إعلان دون موافقة الإدارة.'
                  : 'Submission for review will be enabled after server-side pricing, invoicing and receipt storage are ready. No ad will publish without admin approval.'}
              </p>
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}
