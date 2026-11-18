import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, ArrowLeft, ImagePlus, Megaphone, CheckCircle2, X } from 'lucide-react';
import type { Language } from '../../types';
import { compressAdImage } from '../../utils/adImageCompression';
import { captureAdVideoPoster } from '../../utils/adVideoPoster';
import { compressAdVideo } from '../../utils/adVideoCompression';
import { AdVideoPlayer } from '../AdVideoPlayer';
import { AdPaymentCheckout } from './AdPaymentCheckout';
import { AdCreativeCard } from '../AdCreativeCard';
import { AdScheduleFields } from '../AdScheduleFields';
import { adScheduleDate, emptyAdSchedule } from '../../utils/adSchedule';
import { offerAdsRequest } from '../../services/offerAdsClient';
import { auth } from '../../lib/firebase';
import { uploadAdMedia, type SignedAdUpload, type UploadedAdMedia } from '../../services/adMediaUpload';

const categories = [
  { id: 'banks-finance', ar: 'البنوك والمؤسسات المالية', en: 'Banks & Financial Services' },
  { id: 'restaurants-cafes-outings', ar: 'المطاعم والكافيهات والخروجات', en: 'Restaurants, Cafes & Outings' },
  { id: 'food-beverages', ar: 'الأطعمة والمشروبات', en: 'Food & Beverages' },
  { id: 'fashion', ar: 'الملابس والأحذية والإكسسوارات', en: 'Fashion & Accessories' },
  { id: 'travel-events', ar: 'الرحلات والفعاليات', en: 'Travel & Events' },
  { id: 'sports-fitness', ar: 'الجيم والرياضة', en: 'Sports & Fitness' },
  { id: 'cars-transport', ar: 'السيارات والمواصلات', en: 'Cars & Transport' },
  { id: 'health-beauty', ar: 'الصحة والجمال', en: 'Health & Beauty' },
  { id: 'home-shopping', ar: 'المنزل والتسوق', en: 'Home & Shopping' },
  { id: 'education-services', ar: 'التعليم والخدمات', en: 'Education & Services' },
  { id: 'technology', ar: 'الإلكترونيات والتكنولوجيا', en: 'Electronics & Technology' },
] as const;

interface Props { lang: Language; onBack: () => void }

export function CreateOfferPage({ lang, onBack }: Props) {
  const ar = lang === 'ar';
  const [tier, setTier] = useState<'free' | 'featured'>('free');
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [merchant, setMerchant] = useState('');
  const [contact, setContact] = useState('');
  const [startsAt, setStartsAt] = useState(emptyAdSchedule);
  const [endsAt, setEndsAt] = useState(emptyAdSchedule);
  const [dateError, setDateError] = useState<'invalid' | 'order' | 'past' | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [imageStatus, setImageStatus] = useState<'idle' | 'compressing' | 'ready' | 'error'>('idle');
  const [videoProgress, setVideoProgress] = useState<number | 'checking' | null>(null);
  const [mediaError, setMediaError] = useState<'generic' | 'video_too_long' | 'video_too_large'>('generic');
  const [compressionNotice, setCompressionNotice] = useState(false);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'verifying' | 'success' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [pendingUpload, setPendingUpload] = useState<UploadedAdMedia | null>(null);
  const [verifiedUpload, setVerifiedUpload] = useState<{ secureUrl: string; publicId: string } | null>(null);
  const imageSelection = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const preparation = useRef<AbortController | null>(null);
  const inFlightUpload = useRef<Promise<UploadedAdMedia> | null>(null);
  const [testAsset, setTestAsset] = useState<Pick<SignedAdUpload, 'publicId' | 'resourceType'> | null>(null);
  const [removingMedia, setRemovingMedia] = useState(false);
  useEffect(() => () => preparation.current?.abort(), []);
  const [preview, setPreview] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(() => window.location.pathname === '/offers/new/payment');
  useEffect(() => {
    const syncCheckoutRoute = () => setCheckoutOpen(window.location.pathname === '/offers/new/payment');
    window.addEventListener('popstate', syncCheckoutRoute);
    return () => window.removeEventListener('popstate', syncCheckoutRoute);
  }, []);
  const submission = useRef<{ id: string; media: UploadedAdMedia | null } | null>(null);
  const [hasSubmission, setHasSubmission] = useState(false);
  const [cancellingSend, setCancellingSend] = useState(false);
  const [cancelRequired, setCancelRequired] = useState(false);
  const cancelSend = useRef(false);
  const [sending, setSending] = useState(false);
  const [sendProgress, setSendProgress] = useState<number | null>(null);
  const [sendError, setSendError] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const imageUrl = useMemo(() => image ? URL.createObjectURL(image) : null, [image]);
  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);
  const [videoPoster, setVideoPoster] = useState<{ source: string; url: string } | null>(null);
  const isVideo = image?.type.startsWith('video/') ?? false;
  const poster = videoPoster?.source === imageUrl ? videoPoster?.url : undefined;
  useEffect(() => {
    setVideoPoster(null);
    if (!isVideo || !imageUrl) return;
    return captureAdVideoPoster(imageUrl, url => setVideoPoster({ source: imageUrl, url }));
  }, [imageUrl, isVideo]);
  const isAdmin = auth.currentUser?.email?.trim().toLowerCase() === 'waelvts@gmail.com';
  const gateway = async (action: string, payload: Record<string, unknown>) => {
    const user = auth.currentUser;
    if (!user) throw new Error('authentication_required');
    const response = await fetch('/api/gateway', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await user.getIdToken() }, body: JSON.stringify({ action, payload }) });
    const result = await response.json();
    if (!response.ok || !result?.ok) throw new Error(typeof result?.error === 'string' ? result.error : 'upload_failed');
    return result.data;
  };
  const removeMedia = async () => {
    if (removingMedia) return;
    ++imageSelection.current;
    preparation.current?.abort();
    setUploadError('');
    if (testAsset) {
      setRemovingMedia(true);
      try {
        // Wait for Cloudinary's response before deleting, so a late upload cannot recreate the asset.
        await inFlightUpload.current?.catch(() => undefined);
        await gateway('admin.ads.testUploadDelete', testAsset);
      } catch {
        setUploadState('error');
        setUploadError(ar ? 'تعذّر حذف الملف من Cloudinary. اضغط × لإعادة المحاولة.' : 'Could not delete the file from Cloudinary. Press × to retry.');
        return;
      } finally {
        setRemovingMedia(false);
      }
    }
    if (fileInput.current) fileInput.current.value = '';
    submission.current = null;
    setImage(null);
    setImageStatus('idle');
    setVideoProgress(null);
    setCompressionNotice(false);
    setUploadState('idle');
    setPendingUpload(null);
    setVerifiedUpload(null);
    setTestAsset(null);
    inFlightUpload.current = null;
  };
  const uploadTest = async () => {
    if (!image || !isAdmin || removingMedia || (testAsset && !pendingUpload) || uploadState === 'uploading' || uploadState === 'verifying') return;
    const selection = imageSelection.current;
    setUploadState('uploading'); setUploadProgress(pendingUpload ? 100 : 0); setUploadError('');
    try {
      let uploaded = pendingUpload;
      if (!uploaded) {
        const resourceType = image.type.startsWith('video/') ? 'video' : 'image';
        const signed = await gateway('admin.ads.testUploadSign', { resourceType, bytes: image.size }) as SignedAdUpload;
        if (selection !== imageSelection.current) return;
        setTestAsset({ publicId: signed.publicId, resourceType: signed.resourceType });
        inFlightUpload.current = uploadAdMedia(image, signed, progress => {
          if (selection === imageSelection.current) setUploadProgress(progress);
        });
        uploaded = await inFlightUpload.current;
        if (selection !== imageSelection.current) return;
        setPendingUpload(uploaded);
      }
      setUploadState('verifying');
      const data = await gateway('admin.ads.testUploadConfirm', { publicId: uploaded.publicId, resourceType: uploaded.resourceType, version: uploaded.version, responseSignature: uploaded.responseSignature });
      if (selection !== imageSelection.current) return;
      if (typeof data?.secureUrl !== 'string' || data?.publicId !== uploaded.publicId) throw new Error('upload_failed');
      setVerifiedUpload({ secureUrl: data.secureUrl, publicId: data.publicId });
      setUploadState('success');
    } catch (error) {
      if (selection !== imageSelection.current) return;
      const code = error instanceof Error ? error.message : '';
      setUploadError(code === 'ad_upload_not_configured'
        ? (ar ? 'إعدادات Cloudinary غير مكتملة على الخادم.' : 'Cloudinary server configuration is incomplete.')
        : code === 'ad_video_duration_unavailable'
          ? (ar ? 'الفيديو اترفع، لكن Cloudinary لم يرجع مدته بعد. اضغط إعادة التأكد من الرفع، من غير ما ترفع الملف تاني.' : 'Video uploaded, but Cloudinary did not return its duration yet. Retry verification without uploading again.')
          : code === 'invalid_video_duration'
            ? (ar ? 'مدة الفيديو المرفوع تجاوزت دقيقة واحدة. اختر فيديو أقصر.' : 'The uploaded video exceeds one minute. Choose a shorter video.')
            : code === 'ad_upload_verification_failed'
              ? (ar ? 'الفيديو اترفع، لكن تعذر الاتصال بـ Cloudinary للتأكد منه. حاول إعادة التأكد من الرفع.' : 'Video uploaded, but Cloudinary verification is unavailable. Retry verification.')
              : (ar ? 'تعذر الرفع أو التأكد منه. حاول مرة أخرى.' : 'Upload or verification failed. Please try again.'));
      setUploadState('error');
    }
  };
  const handleReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const start = adScheduleDate(startsAt), end = adScheduleDate(endsAt);
    if (!start || !end) { setDateError('invalid'); return; }
    if (end.getTime() <= start.getTime()) { setDateError('order'); return; }
    if (end.getTime() <= Date.now()) { setDateError('past'); return; }
    setDateError(null);
    if (title.trim() && description.trim() && category && merchant.trim()) setPreview(true);
  };
  const discardSubmission = async () => {
    if (!submission.current) return;
    setCancellingSend(true);
    setSendError('');
    try {
      await offerAdsRequest('ads.cancel', { id: submission.current.id }, true);
      submission.current = null;
      setHasSubmission(false);
      setCancelRequired(false);
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'ad_already_submitted') setSubmitted(true);
      else {
        setCancelRequired(true);
        setSendError(ar ? 'تعذّر إلغاء الإرسال وحذف الملف. اضغط × للمحاولة تاني.' : 'Could not cancel the submission and remove the media. Press × to retry.');
      }
    } finally {
      setCancellingSend(false);
      cancelSend.current = false;
    }
  };
  const requestCancel = () => {
    if (cancellingSend || submitted) return;
    if (sending) {
      cancelSend.current = true;
      setCancellingSend(true);
    } else {
      void discardSubmission();
    }
  };
  const sendForReview = async () => {
    if (sending || cancellingSend || cancelRequired || submitted || tier !== 'free') return;
    const start = adScheduleDate(startsAt);
    const end = adScheduleDate(endsAt);
    if (!start || !end || end.getTime() <= Date.now()) {
      setSendError(ar ? 'راجع تاريخ بداية ونهاية النشر.' : 'Check the publication dates.');
      return;
    }
    const draft = submission.current ?? { id: crypto.randomUUID(), media: null };
    submission.current = draft;
    setHasSubmission(true);
    setSending(true);
    setSendProgress(null);
    setSendError('');
    try {
      const prepared = await offerAdsRequest<{ submitted: boolean; signed: SignedAdUpload | null }>('ads.prepare', {
        id: draft.id, title, description, merchant, contact, categorySlug: category,
        startsAt: start.getTime(), endsAt: end.getTime(),
        resourceType: image ? (isVideo ? 'video' : 'image') : null, bytes: image?.size ?? 0,
      }, true);
      if (cancelSend.current && !prepared.submitted) return;
      if (!prepared.submitted) {
        if (image && prepared.signed && !draft.media) {
          setSendProgress(0);
          draft.media = await uploadAdMedia(image, prepared.signed, setSendProgress);
        }
        setSendProgress(null);
        if (cancelSend.current) return;
        await offerAdsRequest('ads.submit', { ...draft.media, id: draft.id }, true);
      }
      cancelSend.current = false;
      setCancellingSend(false);
      setSubmitted(true);
    } catch (error) {
      if (cancelSend.current) return;
      const code = error instanceof Error ? error.message : '';
      setSendError(code === 'ad_daily_limit'
        ? (ar ? 'وصلت للحد اليومي لإرسال الإعلانات. حاول يوم تاني.' : 'You reached the daily ad limit. Try again another day.')
        : code === 'ad_video_duration_unavailable'
          ? (ar ? 'الفيديو اترفع ولسه بيتفحص. جرّب الإرسال تاني بعد شوية.' : 'The video uploaded and is still being processed. Try sending again shortly.')
          : (ar ? 'تعذّر إرسال الإعلان. راجع البيانات وحاول مرة تانية.' : 'Could not submit the ad. Check the details and try again.'));
    } finally {
      if (cancelSend.current) await discardSubmission();
      setSending(false);
      setSendProgress(null);
    }
  };
  const goToPayment = () => {
    if (!preview || tier !== 'featured') return;
    if (window.location.pathname !== '/offers/new/payment') {
      window.history.pushState({ myBucketTab: 'offers', offerPaymentPreview: true }, '', '/offers/new/payment');
    }
    setCheckoutOpen(true);
    window.scrollTo(0, 0);
  };
  const returnFromPayment = () => {
    if (window.location.pathname === '/offers/new/payment') {
      if (window.history.state?.offerPaymentPreview) window.history.back();
      else window.history.replaceState({ myBucketTab: 'offers' }, '', '/offers/new');
    }
    setCheckoutOpen(false);
  };
  if (checkoutOpen) {
    const start = adScheduleDate(startsAt);
    const end = adScheduleDate(endsAt);
    if (!preview || tier !== 'featured' || !start || !end || !title.trim() || !merchant.trim() || !category) {
      return (
        <main dir={ar ? 'rtl' : 'ltr'} className="min-h-screen bg-slate-50 px-4 py-12 text-slate-900">
          <section className="mx-auto max-w-xl space-y-4 rounded-2xl border border-emerald-100 bg-white p-6">
            <h1 className="text-xl font-black">{ar ? 'صفحة الدفع — My Bucket' : 'My Bucket — Payment'}</h1>
            <p className="text-sm leading-6 text-slate-600">
              {ar ? 'بيانات الإعلان غير موجودة في هذه الجلسة. ارجع لإنشاء الإعلان واختار إعلان مميز، ثم افتح صفحة الدفع من المعاينة.' : 'The advertisement draft is not available in this session. Create a featured ad and open checkout from its preview.'}
            </p>
            <button type="button" onClick={() => { window.history.replaceState({ myBucketTab: 'offers' }, '', '/offers/new'); setCheckoutOpen(false); setPreview(false); }}
              className="min-h-11 w-full rounded-xl bg-emerald-700 px-4 text-sm font-extrabold text-white">
              {ar ? 'العودة إلى إنشاء الإعلان' : 'Back to create advertisement'}
            </button>
          </section>
        </main>
      );
    }
    return <AdPaymentCheckout lang={lang} advertiserName={merchant} adTitle={title} startsAt={start} endsAt={end}
      mediaType={image ? (image.type.startsWith('video/') ? 'video' : 'image') : 'none'} onBack={returnFromPayment} />;
  }

  const label = 'block text-xs font-extrabold text-slate-700 mb-1.5';
  const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500';
  const BackIcon = ar ? ArrowRight : ArrowLeft;
  return (
    <div dir={ar ? 'rtl' : 'ltr'} className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center gap-3">
          <button type="button" disabled={removingMedia || sending || cancellingSend || (hasSubmission && !submitted)} onClick={preview && !submitted ? () => setPreview(false) : onBack}
            className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 inline-flex items-center justify-center shrink-0"
            aria-label={ar ? 'العودة' : 'Back'}><BackIcon className="w-5 h-5" /></button>
          <div className="min-w-0">
            <h1 className="font-extrabold text-lg">{preview ? (ar ? 'مراجعة الإعلان' : 'Review advertisement') : (ar ? 'إنشاء إعلان' : 'Create advertisement')}</h1>
            <p className="text-xs text-slate-500">My Bucket</p>
          </div>
        </div>
      </header>
      <main className="max-w-xl mx-auto px-4 py-5 pb-20 space-y-5">
        {submitted ? (
          <section className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
            <h2 className="flex items-center gap-2 font-extrabold"><CheckCircle2 className="size-5" />{ar ? 'تم إرسال إعلانك للمراجعة' : 'Your ad was sent for review'}</h2>
            <p className="text-sm">{ar ? 'هيظهر في القسم خلال مدة النشر المحددة بعد موافقة الإدارة.' : 'It will appear in its category during the selected dates after approval.'}</p>
            <a className="inline-flex min-h-11 items-center font-bold underline" href="/settings/ads">{ar ? 'تابع الإعلان في إعلاناتي' : 'Track the ad in My ads'}</a>
          </section>
        ) : preview ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
            <h2 className="font-extrabold">{ar ? 'معاينة الإعلان قبل الإرسال' : 'Preview before submission'}</h2>
            {imageUrl && image?.type.startsWith('video/') && <p className="text-xs text-slate-500">{ar ? 'تجربة مشاهدة الزائر: 3 مرات يوميًا على هذا المتصفح.' : 'Visitor playback demo: 3 plays per day in this browser.'}</p>}
            <AdCreativeCard lang={lang} title={title} description={description} merchant={merchant} contact={contact} mediaUrl={imageUrl} poster={poster} mediaType={image?.type.startsWith('video/') ? 'video' : 'image'} videoQuotaId="local-ad-preview-demo" />
            <p className="text-xs text-slate-600">{ar ? 'بداية النشر:' : 'Publication starts:'} {adScheduleDate(startsAt)?.toLocaleString(ar ? 'ar-EG' : 'en-GB')}</p>
            <p className="text-xs text-slate-600">{ar ? 'نهاية النشر:' : 'Publication ends:'} {adScheduleDate(endsAt)?.toLocaleString(ar ? 'ar-EG' : 'en-GB')}</p>
            <button type="button" disabled={hasSubmission || cancellingSend} onClick={() => setPreview(false)} className="w-full rounded-xl border border-emerald-600 text-emerald-700 py-3 text-sm font-bold disabled:opacity-50">{ar ? 'تعديل الإعلان' : 'Edit advertisement'}</button>
            <div className="space-y-2 rounded-xl bg-slate-50 p-3 text-center">
              <button type="button" onClick={tier === 'free' ? () => void sendForReview() : goToPayment} disabled={sending || cancellingSend || cancelRequired}
                className="w-full rounded-xl bg-emerald-700 px-3 py-3 text-sm font-extrabold text-white hover:bg-emerald-800 disabled:opacity-50">
                {tier === 'free' ? (sending ? (ar ? 'جاري إرسال الإعلان...' : 'Sending ad…') : (ar ? 'إرسال للمراجعة' : 'Send for review')) : (ar ? 'الانتقال إلى صفحة الدفع' : 'Continue to payment')}
              </button>
              {hasSubmission && <button type="button" aria-label={ar ? 'إلغاء الإرسال' : 'Cancel submission'}
                disabled={cancellingSend} onClick={requestCancel}
                className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-bold text-red-700 disabled:opacity-50">
                <X className="size-5" aria-hidden="true" />{ar ? 'إلغاء الإرسال' : 'Cancel submission'}
              </button>}
              {cancellingSend && <p role="status" className="text-xs text-slate-600">{ar ? 'جاري إلغاء الإرسال وتنظيف الملف...' : 'Cancelling the submission and cleaning up the media…'}</p>}
              {sendProgress !== null && <progress max={100} value={sendProgress} aria-label={ar ? 'تقدّم رفع الملف' : 'Media upload progress'} className="block h-2 w-full accent-emerald-700" />}
              {sendError && <p role="alert" className="text-sm text-red-700">{sendError}</p>}
              <p className="text-xs text-slate-600">{tier === 'free'
                ? (ar ? 'الإعلان يظهر للجمهور بعد موافقة الإدارة.' : 'Your ad becomes public after the administrator approves it.')
                : (ar ? 'صفحة دفع الإعلان المميز متاحة للمعاينة.' : 'Featured ad checkout is available for preview.')}</p>
            </div>
          </section>
        ) : (
          <form onSubmit={handleReview} className="space-y-5">
            <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <h2 className="font-extrabold text-sm">{ar ? '1. نوع الإعلان' : '1. Advertisement type'}</h2>
              <div className="grid grid-cols-2 gap-3">
                {(['free', 'featured'] as const).map(value => (
                  <button key={value} type="button" aria-pressed={tier === value} onClick={() => setTier(value)}
                    className={`rounded-xl border p-3 text-start text-sm font-extrabold transition-colors ${tier === value ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-700'}`}>
                    {value === 'free' ? (ar ? 'مجاني' : 'Free') : (ar ? 'مميز' : 'Featured')}
                    <span className="block text-[11px] font-normal mt-1">{value === 'free' ? (ar ? 'بدون باقة مدفوعة' : 'No paid package') : (ar ? 'السعر والمميزات لاحقًا' : 'Pricing and benefits to follow')}</span>
                  </button>
                ))}
              </div>
            </section>
            <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <h2 className="font-extrabold text-sm">{ar ? '2. بيانات الإعلان' : '2. Advertisement details'}</h2>
              <div><label htmlFor="offer-category" className={label}>{ar ? 'القسم' : 'Category'}</label>
                <select id="offer-category" required value={category} onChange={event => setCategory(event.target.value)} className={field}>
                  <option value="">{ar ? 'اختر القسم' : 'Choose category'}</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{ar ? c.ar : c.en}</option>)}
                </select>
              </div>
              <div><label htmlFor="offer-title" className={label}>{ar ? 'عنوان الإعلان' : 'Title'}</label>
                <input id="offer-title" required maxLength={120} value={title} onChange={event => setTitle(event.target.value)} className={field} placeholder={ar ? 'اكتب عنوانًا واضحًا للإعلان' : 'A clear advertisement title'} />
              </div>
              <div><label htmlFor="offer-desc" className={label}>{ar ? 'التفاصيل' : 'Description'}</label>
                <textarea id="offer-desc" rows={5} required maxLength={1000} value={description} onChange={event => setDescription(event.target.value.slice(0,1000))} className={field} placeholder={ar ? 'اكتب تفاصيل الإعلان وشروط العرض إن وجدت' : 'Describe the advertisement and any conditions'} /><p aria-live="polite" className={`text-end text-[11px] font-semibold ${1000 - description.length <= 15 ? 'text-red-600' : 'text-slate-500'}`}>{ar ? `المتبقي: ${1000 - description.length} حرف` : `Remaining: ${1000 - description.length} characters`}</p>
              </div>
              <div><label htmlFor="offer-merchant" className={label}>{ar ? 'اسم المعلن أو النشاط' : 'Advertiser or business name'}</label>
                <input id="offer-merchant" required maxLength={100} value={merchant} onChange={event => setMerchant(event.target.value)} className={field} />
              </div>
              <div><label htmlFor="offer-contact" className={label}>{ar ? 'وسيلة التواصل (اختياري)' : 'Contact details (optional)'}</label>
                <input id="offer-contact" maxLength={200} value={contact} onChange={event => setContact(event.target.value)} className={field} />
              </div>
            </section>
            <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <h2 className="font-extrabold text-sm">{ar ? '3. مدة النشر' : '3. Publication schedule'}</h2>
              <p className="text-xs text-slate-500">{ar ? 'المواعيد حسب توقيت جهازك. الإعلان لا يظهر إلا بعد موافقة الإدارة.' : 'Times use your device time zone. The advertisement appears only after admin approval.'}</p>
              <AdScheduleFields id="start" lang={lang} value={startsAt} onChange={value => { setStartsAt(value); setDateError(null); }} />
              <AdScheduleFields id="end" lang={lang} value={endsAt} onChange={value => { setEndsAt(value); setDateError(null); }} />
              {dateError && <p role="alert" className="text-xs font-bold text-red-700">{dateError === 'invalid' ? (ar ? 'يرجى اختيار تاريخ ووقت صحيحين لبداية النشر ونهايته.' : 'Please choose valid start and end dates and times.') : dateError === 'order' ? (ar ? 'يجب أن يكون موعد نهاية النشر بعد موعد بدايته.' : 'The publication end must be after its start.') : (ar ? 'موعد نهاية النشر قد مضى. يرجى اختيار موعد في المستقبل.' : 'The publication end has passed. Please choose a future date and time.')}</p>}
            </section>
            <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <label htmlFor="offer-image" className="flex items-center gap-2 font-extrabold text-sm"><ImagePlus className="w-5 h-5 text-emerald-700" />{ar ? '4. صورة أو فيديو الإعلان (اختياري)' : '4. Advertisement image or video (optional)'}</label>
              <div className="flex items-center gap-2">
              <input ref={fileInput} id="offer-image" type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime" disabled={removingMedia || !!testAsset || uploadState === 'uploading' || uploadState === 'verifying'} onChange={async event => {
                const next = event.target.files?.[0] ?? null;
                const selection = ++imageSelection.current;
                preparation.current?.abort();
                const controller = new AbortController();
                preparation.current = controller;
                submission.current = null;
                setSendError('');
                setVideoProgress(null);
                setImage(null); setMediaError('generic'); setCompressionNotice(false); setUploadState('idle'); setUploadError(''); setPendingUpload(null); setVerifiedUpload(null);
                if (!next) { setImageStatus('idle'); return; }
                const isVideo = next.type.startsWith('video/');
                if ((!isVideo && next.size > 5 * 1024 * 1024) || !['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'].includes(next.type)) { setImageStatus('error'); return; }
                setImageStatus('compressing');
                if (isVideo) setVideoProgress('checking');
                try {
                  const result = isVideo
                    ? await compressAdVideo(next, progress => {
                      if (selection === imageSelection.current) setVideoProgress(progress);
                    }, controller.signal)
                    : await compressAdImage(next, controller.signal);
                  if (selection === imageSelection.current) { setImage(result); setImageStatus('ready'); }
                } catch (error) {
                  if (selection === imageSelection.current) {
                    const code = error instanceof Error ? error.message : '';
                    if (code === 'video_compression_unavailable') { setImage(next); setCompressionNotice(true); setImageStatus('ready'); return; }
                    setMediaError(code === 'video_too_long' || code === 'video_too_large' ? code : 'generic');
                    setImageStatus('error');
                  }
                }
              }} className="block min-w-0 flex-1 text-xs text-slate-600 file:me-3 file:border-0 file:rounded-lg file:bg-emerald-50 file:text-emerald-800 file:font-bold file:px-3 file:py-2" />
                {imageStatus !== 'idle' && <button type="button" onClick={() => void removeMedia()} disabled={removingMedia}
                  aria-label={ar ? 'إلغاء وإزالة الملف' : 'Cancel and remove media'}
                  title={ar ? 'إلغاء وإزالة الملف' : 'Cancel and remove media'}
                  className="grid size-11 shrink-0 place-items-center rounded-xl border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50">
                  <X className="size-5" aria-hidden="true" />
                </button>}
              </div>
              {removingMedia && <p role="status" className="text-xs text-slate-600">{ar ? 'جاري إلغاء العملية وحذف الملف من Cloudinary...' : 'Cancelling and removing the file from Cloudinary…'}</p>}
              <p className="text-xs text-slate-500">{ar ? 'للتجربة: الصور حتى 5 ميجابايت، والفيديو حتى 25 ميجابايت ودقيقة واحدة. تجهيز الفيديو قد يستغرق مدة تشغيله.' : 'For this preview: images up to 5 MB; videos up to 25 MB and one minute. Video preparation may take its full duration.'}</p>
              {imageStatus === 'compressing' && (videoProgress === null
                ? <p role="status" className="text-xs text-slate-600">{ar ? 'جاري تجهيز الصورة...' : 'Preparing the image…'}</p>
                : <div className="space-y-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-emerald-900">
                  <div className="flex items-center justify-between gap-2 text-sm font-bold">
                    <p role="status">{videoProgress === 'checking'
                      ? (ar ? 'جاري فحص الفيديو...' : 'Checking the video…')
                      : (ar ? 'جاري تجهيز الفيديو للمعاينة...' : 'Preparing the video for preview…')}</p>
                    {typeof videoProgress === 'number' && <span dir="ltr">{videoProgress}%</span>}
                  </div>
                  <progress max={100} value={typeof videoProgress === 'number' ? videoProgress : undefined}
                    aria-label={ar ? 'تقدّم تجهيز الفيديو' : 'Video preparation progress'}
                    className="block h-2.5 w-full accent-emerald-700" />
                  <p className="text-xs">{ar ? 'التجهيز بيتم على جهازك وقد يستغرق مدة الفيديو. خليك في الصفحة لحد ما تظهر المعاينة.' : 'Preparation runs on your device and can take as long as the video. Keep this page open until the preview appears.'}</p>
                </div>)}
              {imageStatus === 'ready' && <p role="status" className="text-xs text-emerald-700">{ar ? 'الملف جاهز للمعاينة.' : 'File is ready for preview.'}</p>}
              {compressionNotice && <p className="text-xs text-amber-800">{ar ? 'المتصفح لا يدعم ضغط الفيديو؛ المعاينة تستخدم الملف الأصلي على جهازك.' : 'This browser cannot compress video; the local preview uses the original file.'}</p>}
              {imageStatus === 'error' && <p role="alert" className="text-xs text-red-700">{mediaError === 'video_too_long' ? (ar ? 'مدة الفيديو أكتر من دقيقة. اختار فيديو مدته دقيقة أو أقل.' : 'The video is longer than one minute. Choose a video of one minute or less.') : mediaError === 'video_too_large' ? (ar ? 'حجم الفيديو أكبر من 25 ميجابايت. اختار ملفًا أصغر.' : 'The video exceeds 25 MB. Choose a smaller file.') : (ar ? 'تعذر تجهيز الملف. تأكد من الحجم ونوع الملف ودعم المتصفح.' : 'Could not prepare the file. Check its size, type and browser support.')}</p>}
              {imageUrl && (image?.type.startsWith('video/') ? <AdVideoPlayer src={imageUrl} poster={poster} label={ar ? 'معاينة فيديو الإعلان' : 'Advertisement video preview'} className="w-full max-h-48 object-contain rounded-xl bg-slate-50" /> : <img src={imageUrl} alt={ar ? 'معاينة الصورة' : 'Image preview'} className="w-full max-h-48 object-contain rounded-xl bg-slate-50" />)}
              {isAdmin && image && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-3">
                <p className="text-xs font-bold text-emerald-900">{ar ? 'اختبار رفع للإدارة فقط' : 'Admin-only upload test'}</p>
                <p className="text-xs leading-relaxed text-emerald-800">{ar ? 'يرفع الملف فعليًا إلى Cloudinary. لن يُحفظ الإعلان في Firebase أو يُرسل للمراجعة بعد، وتقدر تحذف الملف التجريبي بزر ×.' : 'Uploads the file to Cloudinary. The ad is not yet saved to Firebase or submitted for review; Use × to remove the test file from Cloudinary.'}</p>
                {uploadState !== 'success' && <button type="button" onClick={() => void uploadTest()} disabled={removingMedia || (!!testAsset && !pendingUpload) || uploadState === 'uploading' || uploadState === 'verifying'} className="w-full rounded-xl bg-emerald-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{pendingUpload ? (ar ? 'إعادة التأكد من الرفع' : 'Retry verification') : (ar ? 'رفع تجريبي إلى Cloudinary' : 'Test upload to Cloudinary')}</button>}
                {(uploadState === 'uploading' || uploadState === 'verifying' || uploadState === 'success') && <div className="space-y-2 text-xs font-bold text-emerald-900">
                  <div className="flex items-center justify-between gap-2"><span>{ar ? 'نسبة رفع الملف' : 'Upload progress'}</span><span dir="ltr">{uploadState === 'uploading' ? uploadProgress : 100}%</span></div>
                  <progress aria-label={ar ? 'نسبة رفع الملف' : 'Upload progress'} max={100} value={uploadState === 'uploading' ? uploadProgress : 100} className="block h-3 w-full accent-emerald-700" />
                </div>}
                {uploadState === 'verifying' && <p role="status" className="text-xs text-emerald-900">{ar ? 'اكتمل إرسال الملف، جاري التأكد منه...' : 'File sent; verifying...'}</p>}
                {uploadState === 'success' && verifiedUpload && <p role="status" className="text-xs font-bold text-emerald-900">{ar ? 'تم التحميل بنجاح' : 'Upload completed successfully'}</p>}
                {uploadError && <p role="alert" className="text-xs text-red-700">{uploadError}</p>}
              </div>}

            </section>
            <button type="submit" disabled={removingMedia || imageStatus === 'compressing' || uploadState === 'uploading' || uploadState === 'verifying'} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold py-3 flex justify-center items-center gap-2"><Megaphone className="w-5 h-5" />{ar ? 'مراجعة الإعلان' : 'Review advertisement'}</button>
          </form>
        )}
      </main>
    </div>
  );
}
