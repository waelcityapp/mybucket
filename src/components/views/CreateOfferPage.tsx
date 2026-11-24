import { validVipDurationDays } from '../../utils/adCheckout';
import { AD_NO_LINKS_AR, AD_NO_LINKS_EN, adContactError, adVideoLimit, containsExternalAdLink } from '../../utils/adContent';
import { type PaidAdPrices, type AdPriceLock, type LegacyAdTransfer } from '../../utils/adCheckout';
import { AdPricingPage } from './FeaturedAdInfoPage';
import { followInternalLink } from '../../utils/navigationHistory';
import { DEFAULT_FREE_OFFER_POLICY, OFFER_CATEGORY_LABELS, type FreeOfferEligibility, type FreeOfferPolicy, type OfferTier, type PublicOfferAd } from '../../data/offerAds';
import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, ArrowLeft, ImagePlus, Megaphone, CheckCircle2, LoaderCircle, Video, X } from 'lucide-react';
import type { Language } from '../../types';
import { compressAdImage } from '../../utils/adImageCompression';
import { captureAdVideoPoster } from '../../utils/adVideoPoster';
import { compressAdVideo, validateAdVideoDuration } from '../../utils/adVideoCompression';
import { AdVideoPlayer } from '../AdVideoPlayer';
import { AdPaymentCheckout } from './AdPaymentCheckout';
import { AdCreativeCard } from '../AdCreativeCard';
import { AdScheduleFields } from '../AdScheduleFields';
import { AD_TIME_ZONE, adScheduleDate, emptyAdSchedule } from '../../utils/adSchedule';
import { offerAdsRequest } from '../../services/offerAdsClient';
import { uploadAdMedia, type SignedAdUpload, type UploadedAdMedia } from '../../services/adMediaUpload';

const mediaAccept = {
  image: 'image/png,image/jpeg,image/webp',
  video: 'video/mp4,video/webm,video/quicktime',
};

interface Props { lang: Language; canEditDirectly?: boolean; onBack: () => void; onNavigate: (path: string) => void }

export function CreateOfferPage({ lang, canEditDirectly = false, onBack, onNavigate }: Props) {
  const ar = lang === 'ar';
  const [prices, setPrices] = useState<PaidAdPrices | null>(null);
  const [priceFailure, setPriceFailure] = useState(false);
  const [priceAttempt, setPriceAttempt] = useState(0);
  const [invoiceId] = useState(() => window.location.pathname === '/offers/new/payment'
    ? new URLSearchParams(window.location.search).get('invoice') : null);
  const [resumed, setResumed] = useState<(PublicOfferAd & {
    mediaType: 'image' | 'video' | null;
    payment: Omit<AdPriceLock, 'createdAt' | 'legacyTransfer'> & { tier: keyof PaidAdPrices; phone: string };
    createdAt: number;
    legacyTransfer?: LegacyAdTransfer;
    videoLimit: number;
  }) | null>(null);
  const [invoiceFailed, setInvoiceFailed] = useState(false);
  useEffect(() => {
    let active = true;
    setPriceFailure(false);
    offerAdsRequest<PaidAdPrices>('ads.paidPrices', {}, true)
      .then(value => { if (active) setPrices(value); })
      .catch(() => { if (active) setPriceFailure(true); });
    return () => { active = false; };
  }, [priceAttempt]);
  useEffect(() => {
    if (!invoiceId) return;
    let active = true;
    offerAdsRequest<NonNullable<typeof resumed>>('ads.resumePayment', { id: invoiceId }, true)
      .then(value => { if (active) setResumed(value); })
      .catch(() => { if (active) setInvoiceFailed(true); });
    return () => { active = false; };
  }, [invoiceId]);
  const query = new URLSearchParams(window.location.search);
  const editId = window.location.pathname === '/offers/new' ? query.get('edit') : null;
  const requestingEdit = Boolean(editId && !canEditDirectly);
  const editAction = canEditDirectly ? 'admin.ads.edit' : 'ads.edit';
  const editErrors: Record<string, string> = {
    ad_edit_request_pending: ar ? 'عندك طلب تعديل قيد المراجعة لنفس الإعلان.' : 'An edit request for this ad is awaiting review.',
    ad_edit_request_limit: ar ? 'استخدمت طلبي التعديل المتاحين لهذا الإعلان.' : 'You have used both edit requests for this ad.',
    ad_edit_unavailable: ar ? 'الإعلان غير متاح للتعديل حاليًا.' : 'This ad is no longer available for editing.',
    ad_edit_conflict: ar ? 'الإعلان اتعدل من صفحة تانية. ارجع لإعلاناتي وافتحه من جديد.' : 'This ad was edited elsewhere. Reopen it from My ads.',
    ad_upload_daily_limit: ar ? 'استخدمت محاولات رفع الملفات المتاحة النهارده. تقدر تحاول بعد منتصف الليل بتوقيت القاهرة.' : 'You have used your media upload attempts for today. Try again after midnight Cairo time.',
  };
  const [editLoadError, setEditLoadError] = useState('');
  const renewId = editId ? null : query.get('renew');
  const correctionId = query.get('correction') === '1' ? renewId : null;
  const [tier, setTier] = useState<OfferTier | null>(correctionId ? 'free' : null);
  const [freePolicy, setFreePolicy] = useState<FreeOfferPolicy>(DEFAULT_FREE_OFFER_POLICY);
  useEffect(() => {
    let active = true;
    offerAdsRequest<FreeOfferPolicy>('ads.freePolicy', {}, true)
      .then(policy => { if (active) setFreePolicy(policy); })
      .catch(() => { /* The eligibility check still enforces the live policy. */ });
    return () => { active = false; };
  }, []);
  const [eligibility, setEligibility] = useState<FreeOfferEligibility | 'checking' | 'error'>('checking');
  const visiblePolicy = typeof eligibility === 'object' ? eligibility : freePolicy;
  const freeDays = visiblePolicy.freeIntervalDays;
  const durationDays = visiblePolicy.freeDurationDays;
  const duration = new Intl.NumberFormat(ar ? 'ar-EG' : 'en-GB').format(durationDays);
  const freeSchedule = ar ? `النشر يبدأ فور موافقة الإدارة ويستمر لمدة ${duration} يوم.`
    : `Publication starts when an admin approves the ad and lasts ${duration} ${durationDays === 1 ? 'day' : 'days'}.`;
  const [eligibilityAttempt, setEligibilityAttempt] = useState(0);
  const freeFieldsLocked = !editId && tier === 'free' && (typeof eligibility === 'string' || eligibility.status !== 'available');
  useEffect(() => {
    if (editId || tier !== 'free') return;
    let active = true;
    offerAdsRequest<FreeOfferEligibility>('ads.freeEligibility', {}, true)
      .then(result => {
        if (!active) return;
        setEligibility(result);
      })
      .catch(() => { if (active) setEligibility('error'); });
    return () => { active = false; };
  }, [tier, eligibilityAttempt, editId]);
  const [category, setCategory] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [merchant, setMerchant] = useState('');
  const [contact, setContact] = useState('');
  const [callPhone, setCallPhone] = useState('');
  const [whatsappPhone, setWhatsappPhone] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [checkingVideo, setCheckingVideo] = useState(false);
  const adContacts = { callPhone, whatsappPhone, mapsUrl };
  const isPaid = tier === 'featured' || tier === 'vip';
  const videoLimit = adVideoLimit(tier ?? 'free');
  const linkErrors = {
    title: containsExternalAdLink(title),
    description: containsExternalAdLink(description),
    merchant: containsExternalAdLink(merchant),
    contact: !isPaid && containsExternalAdLink(contact),
  };
  const phoneErrors = {
    callPhone: isPaid && adContactError({ callPhone }) === 'ad_invalid_call_phone',
    whatsappPhone: isPaid && adContactError({ whatsappPhone }) === 'ad_invalid_whatsapp_phone',
    mapsUrl: isPaid && adContactError({ mapsUrl }) === 'ad_invalid_maps_url',
  };
  const contentError = Object.values(linkErrors).some(Boolean)
    ? 'ad_external_link' : isPaid ? adContactError(adContacts) : null;
  const contentErrors = {
    ad_external_link: ar ? 'أزل الروابط الخارجية من نص الإعلان قبل رفع الملفات أو الإرسال.' : 'Remove external links from the ad text before uploading or submitting.',
    ad_invalid_call_phone: ar ? 'أدخل رقم اتصال مصري أو دولي صحيح، أو اترك الحقل فارغًا.' : 'Enter a valid Egyptian or international phone number, or leave it blank.',
    ad_invalid_whatsapp_phone: ar ? 'أدخل رقم محمول صحيح لواتساب، أو اترك الحقل فارغًا.' : 'Enter a valid mobile number for WhatsApp, or leave it blank.',
    ad_invalid_maps_url: ar ? 'أدخل رابط مشاركة صحيح من خرائط Google، أو اترك الحقل فارغًا.' : 'Enter a valid Google Maps share link, or leave it blank.',
  };
  const fieldWarningClass = 'mt-1 text-xs font-bold text-rose-700 dark:text-rose-300';
  const videoLimitMessage = ar ? `اختر فيديو مدته ${new Intl.NumberFormat('ar-EG').format(videoLimit)} ثانية أو أقل.`
    : `Choose a video no longer than ${videoLimit} seconds.`;
  const [vipDays, setVipDays] = useState('');
  const vipDurationDays = Number(vipDays);
  const [startsAt, setStartsAt] = useState(emptyAdSchedule);
  const [endsAt, setEndsAt] = useState(emptyAdSchedule);
  const [dateError, setDateError] = useState<'invalid' | 'order' | 'past' | null>(null);
  const [renewState, setRenewState] = useState<'loading' | 'ready' | 'error'>(renewId || editId ? 'loading' : 'ready');
  const [editRevision, setEditRevision] = useState('');
  const [removeExistingMedia, setRemoveExistingMedia] = useState(false);
  const editUpload = useRef<{ id: string; media?: UploadedAdMedia } | null>(null);
  const [reusedMedia, setReusedMedia] = useState<PublicOfferAd['media']>();
  useEffect(() => {
    if (!renewId && !editId) return;
    let active = true;
    offerAdsRequest<PublicOfferAd & { editRevision?: string }>(editId ? `${editAction}.read` : 'ads.renewal',
      { id: editId ?? renewId, ...(correctionId && { correction: true }) }, true)
      .then(ad => {
        if (!active) return;
        if (editId) {
          setTier(ad.tier ?? 'free');
          setEditRevision(ad.editRevision ?? '');
        }
        setTitle(ad.title);
        setDescription(ad.description);
        setCategory(ad.categorySlug);
        setMerchant(ad.merchant);
        setContact(ad.contact);
        setCallPhone(ad.callPhone ?? '');
        setWhatsappPhone(ad.whatsappPhone ?? '');
        setMapsUrl(ad.mapsUrl ?? '');
        setReusedMedia(ad.media);
        setRenewState('ready');
      })
      .catch(error => {
        if (!active) return;
        if (editId && error instanceof Error) setEditLoadError(error.message);
        setRenewState('error');
      });
    return () => { active = false; };
  }, [renewId, correctionId, editId, editAction]);
  const [image, setImage] = useState<File | null>(null);
  const [imageStatus, setImageStatus] = useState<'idle' | 'compressing' | 'ready' | 'error'>('idle');
  const [videoProgress, setVideoProgress] = useState<number | 'checking' | null>(null);
  const [mediaError, setMediaError] = useState<'generic' | 'video_too_long' | 'video_too_large'>('generic');
  const [compressionNotice, setCompressionNotice] = useState(false);
  const imageSelection = useRef(0);
  const fileInput = useRef<HTMLInputElement>(null);
  const openMediaPicker = (kind: keyof typeof mediaAccept) => {
    const input = fileInput.current;
    if (!input || input.disabled || (tier === 'free' && kind === 'video')) return;
    input.accept = mediaAccept[kind];
    input.click();
  };
  const preparation = useRef<AbortController | null>(null);
  useEffect(() => () => preparation.current?.abort(), []);
  const [preview, setPreview] = useState(false);
  const [pricingOpen, setPricingOpen] = useState(() => window.location.pathname === '/offers/new/pricing' || window.location.pathname === '/offers/new/featured');
  const openPricing = () => {
    if (window.location.pathname !== '/offers/new/pricing') window.history.pushState({ myBucketTab: 'offers', adPricing: true }, '', '/offers/new/pricing' + window.location.search);
    setPricingOpen(true);
    window.scrollTo(0, 0);
  };
  const closePricing = () => {
    if (window.history.state?.adPricing) window.history.back();
    else window.history.replaceState({ myBucketTab: 'offers' }, '', '/offers/new' + window.location.search);
    setPricingOpen(false);
  };
  const choosePricingTier = (choice: OfferTier) => {
    if (choice === 'free' && tier !== 'free') {
      setEligibility('checking');
      if (previewType === 'video' || videoProgress !== null) removeMedia();
    }
    setTier(choice);
    closePricing();
  };
  const [checkoutOpen, setCheckoutOpen] = useState(() => window.location.pathname === '/offers/new/payment');
  useEffect(() => {
    const syncCheckoutRoute = () => {
      setCheckoutOpen(window.location.pathname === '/offers/new/payment');
      setPricingOpen(window.location.pathname === '/offers/new/pricing' || window.location.pathname === '/offers/new/featured');
    };
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
  const [sendRecovery, setSendRecovery] = useState<'retry' | 'restartUpload' | 'changeVideo' | null>(null);
  const sendLock = useRef(false);
  const [submitted, setSubmitted] = useState(false);
  const imageUrl = useMemo(() => image ? URL.createObjectURL(image) : null, [image]);
  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);
  const [videoPoster, setVideoPoster] = useState<{ source: string; url: string } | null>(null);
  const isVideo = image?.type.startsWith('video/') ?? false;
  const previewUrl = imageUrl ?? reusedMedia?.url;
  const previewType = image ? (isVideo ? 'video' : 'image') : reusedMedia?.type;
  const poster = image ? (videoPoster?.source === imageUrl ? videoPoster?.url : undefined) : reusedMedia?.poster;
  useEffect(() => {
    setVideoPoster(null);
    if (!isVideo || !imageUrl) return;
    return captureAdVideoPoster(imageUrl, url => setVideoPoster({ source: imageUrl, url }));
  }, [imageUrl, isVideo]);
  const removeMedia = () => {
    if (editId) {
      setRemoveExistingMedia(true);
      editUpload.current = null;
    }
    ++imageSelection.current;
    preparation.current?.abort();
    if (fileInput.current) fileInput.current.value = '';
    submission.current = null;
    setReusedMedia(undefined);
    setImage(null);
    setImageStatus('idle');
    setVideoProgress(null);
    setCompressionNotice(false);
  };
  const handleReview = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!tier || freeFieldsLocked || contentError || checkingVideo || imageStatus === 'compressing' || imageStatus === 'error') return;
    if (editId) {
      if (editUpload.current && !editUpload.current.media) editUpload.current = null;
      if (title.trim() && description.trim() && category && merchant.trim()) setPreview(true);
      return;
    }
    if (tier === 'free') {
      if (previewType === 'video') return;
    } else {
      if (tier === 'vip' && !validVipDurationDays(vipDurationDays)) return;
      const start = adScheduleDate(startsAt), end = adScheduleDate(endsAt);
      if (tier === 'featured') {
        if (!start || !end) { setDateError('invalid'); return; }
        if (end.getTime() <= start.getTime()) { setDateError('order'); return; }
        if (end.getTime() <= Date.now()) { setDateError('past'); return; }
      }
      const source = image ?? reusedMedia?.url;
      if (source && previewType === 'video') {
        setCheckingVideo(true);
        try {
          await validateAdVideoDuration(source, videoLimit);
        } catch (error) {
          setMediaError(error instanceof Error && error.message === 'video_too_long' ? 'video_too_long' : 'generic');
          setImageStatus('error');
          return;
        } finally {
          setCheckingVideo(false);
        }
      }
    }
    setDateError(null);
    if (title.trim() && description.trim() && category && merchant.trim()) setPreview(true);
  };
  const saveEditedAd = async () => {
    if (!editId || !tier || contentError || sendLock.current) return;
    sendLock.current = true;
    setSending(true);
    setSendError('');
    try {
      const fields = { id: editId, editRevision, categorySlug: category, title, description, merchant,
        ...(isPaid ? adContacts : { contact }) };
      let operationId = editUpload.current?.id ?? crypto.randomUUID();
      if (image && !editUpload.current?.media) {
        const prepared = await offerAdsRequest<{ editId: string; signed: SignedAdUpload }>(`${editAction}.prepare`,
          { ...fields, resourceType: previewType, bytes: image.size }, true);
        operationId = prepared.editId;
        setSendProgress(0);
        const media = await uploadAdMedia(image, prepared.signed, setSendProgress);
        editUpload.current = { id: operationId, media };
      } else if (!image) {
        editUpload.current = { id: operationId };
      }
      await offerAdsRequest(`${editAction}.save`, {
        ...fields, ...editUpload.current?.media, editId: operationId,
        mediaAction: image ? 'replace' : removeExistingMedia ? 'remove' : 'keep',
      }, true);
      onBack();
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setSendError(editErrors[code] ?? (requestingEdit
        ? (ar ? 'تعذّر إرسال طلب التعديل. حاول تاني.' : 'Could not submit the edit request. Try again.')
        : (ar ? 'تعذّر حفظ التعديل. حاول تاني.' : 'Could not save the changes. Try again.')));
    } finally {
      sendLock.current = false;
      setSending(false);
      setSendProgress(null);
    }
  };
  const discardSubmission = async () => {
    if (!submission.current) return true;
    setCancellingSend(true);
    setSendError('');
    try {
      await offerAdsRequest('ads.cancel', { id: submission.current.id }, true);
      submission.current = null;
      setHasSubmission(false);
      setCancelRequired(false);
      setSendRecovery(null);
      return true;
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (code === 'ad_already_submitted') setSubmitted(true);
      else {
        setCancelRequired(true);
        setSendError(ar ? 'تعذّر إلغاء الإرسال وحذف الملف. اضغط × للمحاولة تاني.' : 'Could not cancel the submission and remove the media. Press × to retry.');
      }
      return false;
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
    if (sendLock.current || cancellingSend || cancelRequired || submitted || tier !== 'free') return;
    if (freeFieldsLocked || contentError || previewType === 'video') return;
    sendLock.current = true;
    setSending(true);
    setSendProgress(null);
    setSendError('');
    let stage: 'prepare' | 'upload' | 'submit' = 'prepare';
    try {
      if (sendRecovery === 'restartUpload' && !await discardSubmission()) return;
      const draft = submission.current ?? { id: crypto.randomUUID(), media: null };
      submission.current = draft;
      setHasSubmission(true);
      setSendRecovery(null);
      const prepared = draft.media ? { submitted: false, signed: null } : await offerAdsRequest<{ submitted: boolean; signed: SignedAdUpload | null }>('ads.prepare', {
        id: draft.id, title, description, merchant, contact, categorySlug: category,
        tier: 'free', ...(correctionId && { correctionId }),
        resourceType: previewType ?? null, bytes: image?.size ?? (reusedMedia ? 1 : 0),
      }, true);
      if (cancelSend.current && !prepared.submitted) return;
      if (!prepared.submitted) {
        const source = image ?? reusedMedia?.url;
        if (source && prepared.signed && !draft.media) {
          stage = 'upload';
          setSendProgress(0);
          draft.media = await uploadAdMedia(source, prepared.signed, setSendProgress);
        }
        setSendProgress(null);
        if (cancelSend.current) return;
        stage = 'submit';
        const result = await offerAdsRequest<{ submitted: boolean }>('ads.submit', { ...draft.media, id: draft.id }, true);
        if (result.submitted !== true) throw new Error('ad_submission_unconfirmed');
      }
      cancelSend.current = false;
      setCancellingSend(false);
      setSubmitted(true);
    } catch (error) {
      if (cancelSend.current) return;
      const code = error instanceof Error ? error.message : '';
      if (code === 'ad_upload_daily_limit' || code === 'ad_upload_active' || code === 'ad_upload_paused') {
        submission.current = null;
        setHasSubmission(false);
      }
      const errors = {
        ad_upload_daily_limit: ar ? 'استخدمت كل محاولات الرفع المتاحة النهارده. الحصة بتتجدد الساعة ١٢ بالليل بتوقيت القاهرة.' : 'You have used all of today’s upload attempts. They reset at midnight Cairo time.',
        ad_upload_active: ar ? 'عندك ملف قيد الرفع أو التحقق. كمّله أو ألغيه قبل محاولة رفع تانية.' : 'Complete or cancel your current upload before starting another.',
        ad_upload_paused: ar ? 'رفع ملفات الإعلانات متوقف مؤقتًا. حاول لاحقًا.' : 'Ad media uploads are temporarily paused.',
        ad_free_interval: ar ? 'لسه ما مرّتش المدة المطلوبة من آخر إعلان مجاني اتوافق عليه.' : 'Your free-ad interval has not passed since the last approval.',
        ...contentErrors,
        ad_active_exists: ar ? 'عندك إعلان مجاني نشط. استنى لحد ما مدته تنتهي.' : 'You already have an active free ad. Wait for it to end.',
        ad_free_image_only: ar ? 'الإعلان المجاني يسمح بصورة واحدة اختيارية بدون فيديو.' : 'Free ads allow one optional image and no video.',
        ad_correction_unavailable: ar ? 'الطلب ده مش متاح للتصحيح حاليًا. راجع إعلاناتي.' : 'This ad is no longer available for correction. Check My ads.',
        ad_pending_exists: ar ? 'عندك إعلان مجاني بانتظار الموافقة.' : 'You already have a free ad awaiting review.',
        ad_daily_limit: ar ? 'وصلت للحد اليومي لإرسال الإعلانات. حاول يوم تاني.' : 'You reached the daily ad limit. Try again another day.',
      };
      if (code === 'invalid_video_duration') {
        setSendRecovery('changeVideo');
        setSendError(ar ? 'مدة الفيديو غير مناسبة. اختار فيديو مدته دقيقة أو أقل.' : 'Choose a video with a valid duration of one minute or less.');
      } else if (stage === 'upload' || code === 'ad_upload_already_issued') {
        setSendRecovery('restartUpload');
        setSendError(ar ? 'رفع الملف ما اكتملش. اتأكد من الإنترنت وحاول تاني.' : 'The upload did not complete. Check your connection and try again.');
      } else if (Object.hasOwn(errors, code)) {
        setSendRecovery(null);
        setSendError(errors[code as keyof typeof errors]);
      } else {
        setSendRecovery('retry');
        setSendError(submission.current?.media
          ? (ar ? 'تم رفع الملف، لكن إرسال الإعلان للمراجعة ما اكتملش. تقدر تحاول تاني بنفس الملف.' : 'Your file was uploaded, but submission did not finish. You can retry with the same file.')
          : (ar ? 'تعذّر إرسال الإعلان حاليًا. حاول مرة تانية بعد قليل.' : 'Could not submit the ad right now. Try again shortly.'));
      }
    } finally {
      if (cancelSend.current) await discardSubmission();
      sendLock.current = false;
      setSending(false);
      setSendProgress(null);
    }
  };
  const changeInvalidVideo = async () => {
    if (!await discardSubmission()) return;
    removeMedia();
    setPreview(false);
  };
  const goToPayment = () => {
    if (contentError || !prices || !preview || (tier !== 'featured' && tier !== 'vip')) return;
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
  if (pricingOpen) return <AdPricingPage lang={lang} onBack={closePricing} onChoose={choosePricingTier} onlyFree={Boolean(correctionId)} />;
  if (invoiceId) {
    if (!resumed) return <main className="p-5 dark:bg-slate-950 dark:text-white">
      <p role={invoiceFailed ? 'alert' : 'status'}>{invoiceFailed
        ? (ar ? 'الفاتورة غير متاحة. لو تم التحويل، احتفظ بالإيصال وتواصل مع الإدارة.' : 'This invoice is unavailable. If you transferred money, keep the receipt and contact the administrator.')
        : (ar ? 'جارٍ تحميل الفاتورة…' : 'Loading invoice…')}</p>
    </main>;
    return <AdPaymentCheckout tier={resumed.payment.tier} lang={lang} advertiserName={resumed.merchant}
      adTitle={resumed.title} startsAt={new Date(resumed.startsAt)} endsAt={new Date(resumed.endsAt)}
      mediaType={resumed.mediaType ?? 'none'} adDescription={resumed.description} categorySlug={resumed.categorySlug}
      adContact={resumed.contact} adContacts={{ callPhone: resumed.callPhone, whatsappPhone: resumed.whatsappPhone, mapsUrl: resumed.mapsUrl }}
      vipDurationDays={resumed.vipDurationDays} videoLimit={resumed.videoLimit} dailyPriceEgp={resumed.payment.dailyPriceEgp}
      initialInvoice={{ ...resumed.payment, id: invoiceId, createdAt: resumed.createdAt, legacyTransfer: resumed.legacyTransfer }} onPricesChange={setPrices}
      onBack={onBack} onNavigate={onNavigate} />;
  }

  if (checkoutOpen) {
    const vipDurationValid = tier === 'vip' && validVipDurationDays(vipDurationDays);
    const start = vipDurationValid ? new Date(0) : adScheduleDate(startsAt);
    const end = vipDurationValid ? new Date(vipDurationDays * 86400000) : adScheduleDate(endsAt);
    if (!prices || !preview || (tier !== 'featured' && tier !== 'vip') || !start || !end || (tier === 'vip' && !vipDurationValid) || !title.trim() || !merchant.trim() || !category) {
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
    return <AdPaymentCheckout tier={tier} lang={lang} advertiserName={merchant} adTitle={title} startsAt={start} endsAt={end}
      mediaType={previewType ?? 'none'} adDescription={description} categorySlug={category} adContact="" adContacts={adContacts} vipDurationDays={vipDurationValid ? vipDurationDays : undefined} videoLimit={videoLimit}
      mediaFile={image ?? reusedMedia?.url} dailyPriceEgp={prices[tier]} onPricesChange={setPrices} onBack={returnFromPayment} onNavigate={onNavigate} />;
  }

  const label = `block text-xs font-extrabold text-slate-700 mb-1.5 dark:text-slate-300`;
  const field = `w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100`;
  const BackIcon = ar ? ArrowRight : ArrowLeft;
  const formSurface = 'dark:border-slate-700 dark:bg-slate-900';
  const formMuted = 'dark:text-slate-300';
  return (
    <div dir={ar ? 'rtl' : 'ltr'} className={`min-h-screen bg-[#F8FAFC] text-slate-900 dark:bg-slate-950 dark:text-slate-100`}>
      <header className={`bg-white border-b border-slate-200 ${formSurface}`}>
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center gap-3">
          <button type="button" disabled={sending || cancellingSend || (hasSubmission && !submitted)} onClick={preview && !submitted ? () => setPreview(false) : onBack}
            className={`w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 inline-flex items-center justify-center shrink-0 dark:bg-slate-800 dark:hover:bg-slate-700`}
            aria-label={ar ? 'العودة' : 'Back'}><BackIcon className="w-5 h-5" /></button>
          <div className="min-w-0">
            <h1 className="font-extrabold text-lg">{preview ? (ar ? 'مراجعة الإعلان' : 'Review advertisement') : requestingEdit ? (ar ? 'طلب تعديل الإعلان' : 'Request an ad edit') : editId ? (ar ? 'تعديل الإعلان' : 'Edit ad') : (ar ? 'إنشاء إعلان' : 'Create advertisement')}</h1>
            <p className={`text-xs text-slate-500 ${formMuted}`}>My Bucket</p>
          </div>
        </div>
      </header>
      <main className="max-w-xl mx-auto px-4 py-5 pb-20 space-y-5">
        {renewState !== 'ready' ? (
          <section className={`rounded-2xl border border-slate-200 bg-white p-5 ${formSurface}`}>
            <p role={renewState === 'error' ? 'alert' : 'status'}>{renewState === 'loading'
              ? (ar ? 'جاري تحميل بيانات الإعلان...' : 'Loading ad details…')
              : editId ? (editErrors[editLoadError] ?? (ar ? 'تعذّر فتح الإعلان للتعديل.' : 'Could not open this ad for editing.'))
              : (ar ? 'تعذّر فتح الإعلان لإعادة الإرسال. راجع «إعلاناتي» وحاول تاني.' : 'Could not open this ad for resubmission. Check My ads and try again.')}</p>
            {renewState === 'error' && <a className="mt-3 inline-block font-bold text-emerald-800 underline" href="/settings/ads" onClick={event => followInternalLink(event, onNavigate)}>{ar ? 'إعلاناتي' : 'My ads'}</a>}
          </section>
        ) : submitted ? (
          <section role="status" className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-emerald-950">
            <h2 className="flex items-center gap-2 font-extrabold"><CheckCircle2 className="size-5" />{ar ? 'مبروك! تم إرسال إعلانك للإدارة بنجاح.' : 'Your ad was sent successfully.'}</h2>
            <p className="text-sm">{ar ? 'تتم المراجعة والرد خلال ٢٤ ساعة تقريبًا. تقدر تتابع حالة إعلانك من ملفك الشخصي في قسم «إعلاناتي».' : 'Review usually takes around 24 hours. Follow your ad’s status in My ads in your profile.'}</p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
              <a className="inline-flex min-h-11 items-center font-bold underline" href="/settings/ads" onClick={event => followInternalLink(event, onNavigate)}>{ar ? 'متابعة الإعلان' : 'Track ad'}</a>
              <a href="/" onClick={event => followInternalLink(event, onNavigate)} className="inline-flex min-h-11 items-center font-bold underline">{ar ? 'الصفحة الرئيسية' : 'Home'}</a>
            </div>
          </section>
        ) : preview ? (
          <section className={`rounded-2xl border border-slate-200 bg-white p-4 space-y-4 ${formSurface}`}>
            <h2 className="font-extrabold">{editId ? (ar ? 'معاينة التعديل' : 'Preview changes') : (ar ? 'معاينة الإعلان قبل الإرسال' : 'Preview before submission')}</h2>
            <AdCreativeCard lang={lang} title={title} description={description} merchant={merchant} contact={isPaid ? callPhone : contact} mediaUrl={previewUrl} poster={poster} mediaType={previewType} videoQuotaId="local-ad-preview-demo" />
            {editId ? null : tier === 'free' ? <p className="text-xs text-slate-600 dark:text-slate-300">{freeSchedule}</p> : tier === 'vip' ? <p className="text-sm dark:text-slate-300">
              {ar ? `النشر فور الموافقة لمدة ${vipDurationDays} يوم.` : `Publishes on approval for ${vipDurationDays} days.`}
            </p> : <>
            <p className={`text-xs text-slate-600 ${formMuted}`}>{ar ? 'بداية النشر بتوقيت القاهرة' : 'Publication starts (Cairo time)'} {adScheduleDate(startsAt)?.toLocaleString(ar ? 'ar-EG' : 'en-GB', { timeZone: AD_TIME_ZONE })}</p>
            <p className={`text-xs text-slate-600 ${formMuted}`}>{ar ? 'نهاية النشر بتوقيت القاهرة' : 'Publication ends (Cairo time)'} {adScheduleDate(endsAt)?.toLocaleString(ar ? 'ar-EG' : 'en-GB', { timeZone: AD_TIME_ZONE })}</p>
            </>}
            <button type="button" disabled={sending || hasSubmission || cancellingSend} onClick={() => setPreview(false)} className={`w-full rounded-xl border border-emerald-600 text-emerald-700 py-3 text-sm font-bold disabled:opacity-50 dark:text-emerald-300`}>{ar ? 'تعديل الإعلان' : 'Edit advertisement'}</button>
            <div className={`space-y-2 rounded-xl bg-slate-50 p-3 text-center dark:bg-slate-800`}>
              <button type="button" onClick={editId ? () => void saveEditedAd() : tier === 'free' ? () => void sendForReview() : goToPayment} disabled={sending || cancellingSend || cancelRequired || sendRecovery === 'changeVideo' || (!editId && tier !== 'free' && !prices)}
                className="w-full rounded-xl bg-emerald-700 px-3 py-3 text-sm font-extrabold text-white hover:bg-emerald-800 disabled:opacity-50">
                {requestingEdit ? (sending ? (ar ? 'جاري إرسال الطلب...' : 'Submitting…') : (ar ? 'إرسال التعديل للمراجعة' : 'Submit edit for review'))
                  : editId ? (sending ? (ar ? 'جاري الحفظ...' : 'Saving…') : (ar ? 'حفظ التعديلات' : 'Save changes')) : tier === 'free' ? (sending ? (ar ? 'جاري إرسال الإعلان...' : 'Sending ad…') : (sendRecovery === 'retry' || sendRecovery === 'restartUpload' ? (ar ? 'إعادة المحاولة' : 'Try again') : (ar ? 'إرسال للمراجعة' : 'Send for review'))) : (ar ? 'الانتقال إلى صفحة الدفع' : 'Continue to payment')}
              </button>
              {sending && !cancellingSend && <div role="status" className="grid justify-items-center gap-2 py-3 text-sm font-bold text-emerald-900 dark:text-emerald-200">
                <LoaderCircle className="size-7 motion-safe:animate-spin" aria-hidden="true" />
                <p>{requestingEdit ? (ar ? 'جاري إرسال طلب التعديل' : 'Submitting edit request') : editId ? (ar ? 'جاري حفظ التعديلات' : 'Saving changes') : (ar ? 'جاري إرسال الإعلان، برجاء الانتظار' : 'Sending your ad. Please wait.')}</p>
              </div>}
              {sendRecovery === 'changeVideo' && <button type="button" disabled={cancellingSend} onClick={() => void changeInvalidVideo()}
                className="min-h-11 rounded-xl bg-emerald-100 px-3 text-sm font-bold text-emerald-900">{ar ? 'تغيير الفيديو' : 'Change video'}</button>}
              {hasSubmission && <button type="button" aria-label={ar ? 'إلغاء الإرسال' : 'Cancel submission'}
                disabled={cancellingSend} onClick={requestCancel}
                className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-sm font-bold text-red-700 disabled:opacity-50">
                <X className="size-5" aria-hidden="true" />{ar ? 'إلغاء الإرسال' : 'Cancel submission'}
              </button>}
              {cancellingSend && <p role="status" className={`text-xs text-slate-600 ${formMuted}`}>{ar ? 'جاري إلغاء الإرسال وتنظيف الملف...' : 'Cancelling the submission and cleaning up the media…'}</p>}
              {sendProgress !== null && <div className="space-y-1">
                <p className="text-xs font-bold">{ar ? 'جاري رفع الملف' : 'Uploading media'} <span dir="ltr">{sendProgress}%</span></p>
                <progress max={100} value={sendProgress} aria-label={ar ? 'تقدّم رفع الملف' : 'Media upload progress'} className="block h-2 w-full accent-emerald-700" />
              </div>}
              {sendError && <p role="alert" className="text-sm text-red-700 dark:text-red-300">{sendError}</p>}
              {requestingEdit && <p className={`text-xs text-slate-600 ${formMuted}`}>{ar ? 'هيتحسب طلب من الطلبين المتاحين. الإعلان الحالي يفضل ظاهر لحد ما الإدارة توافق على التعديل، طالما مدة النشر لسه سارية.' : 'This uses one of your two requests. The current ad stays visible while it is active and awaiting approval.'}</p>}
              {!editId && <p className={`text-xs text-slate-600 ${formMuted}`}>{tier === 'free'
                ? (ar ? 'الإعلان يظهر للجمهور بعد موافقة الإدارة.' : 'Your ad becomes public after the administrator approves it.')
                : (ar ? 'ادفع عبر إنستا باي وأرسل الإيصال مع الإعلان للمراجعة.' : 'Pay via InstaPay and send the receipt with your ad for review.')}</p>}
            </div>
          </section>
        ) : (
          <form onSubmit={handleReview} className="space-y-5">
            {!editId && <section className={`bg-white rounded-2xl border border-slate-200 p-4 space-y-3 ${formSurface}`}>
              <h2 className="font-extrabold text-sm">{ar ? '1. نوع الإعلان' : '1. Advertisement type'}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {!correctionId && priceFailure && <p role="alert" className="col-span-full text-sm text-rose-700 dark:text-rose-300">
                  {ar ? 'تعذّر تحميل أسعار الإعلانات.' : 'Ad prices could not be loaded.'}{' '}
                  <button className="underline" type="button" onClick={() => setPriceAttempt(n => n + 1)}>{ar ? 'إعادة المحاولة' : 'Retry'}</button>
                </p>}
                {(correctionId ? ['free'] as const : ['free', 'featured', 'vip'] as const).map(value => (
                  <div key={value} className="grid content-start gap-1">
                  <button type="button" aria-pressed={tier === value} onClick={() => {
                    if (value === 'free' && tier !== 'free') {
                      setEligibility('checking');
                      if (previewType === 'video' || videoProgress !== null) removeMedia();
                    }
                    setTier(value);
                  }}
                    className={`min-h-16 rounded-xl border p-3 text-start text-sm font-extrabold transition-colors ${tier === value ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : `border-slate-200 text-slate-700 ${formMuted}`}`}>
                    {value === 'free' ? (ar ? 'مجاني' : 'Free') : value === 'vip' ? 'VIP' : (ar ? 'مميز' : 'Featured')}
                    {value === 'free' && <span className="mt-1 block text-xs font-normal">
                      {ar ? `انتظار ${new Intl.NumberFormat('ar-EG').format(freeDays)} يوم من آخر موافقة` : `${freeDays} ${freeDays === 1 ? 'day' : 'days'} between approvals`}
                    </span>}
                  </button>
                  {value !== 'free' && <span className={`text-xs text-slate-600 ${formMuted}`}>
                    {prices ? (ar ? `${new Intl.NumberFormat('ar-EG').format(prices[value])} جنيه / يوم` : `EGP ${new Intl.NumberFormat('en-EG').format(prices[value])} / day`)
                      : (ar ? 'السعر غير متاح حاليًا' : 'Price currently unavailable')}
                  </span>}
                  </div>
                ))}
              </div>
              <button type="button" onClick={openPricing}
                className="flex min-h-11 w-full items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm font-extrabold text-emerald-900 hover:bg-emerald-100 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-200">
                {ar ? 'قارن المميزات والأسعار' : 'Compare benefits and pricing'}
              </button>
            </section>}
            {!editId && tier === 'free' && eligibility === 'checking' && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
              {ar ? 'بنتأكد إن فيه إعلان مجاني متاح لحسابك...' : 'Checking whether you can submit a free ad…'}
            </p>}
            {!editId && tier === 'free' && eligibility === 'error' && <div role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              {ar ? 'تعذّر التحقق من إتاحة الإعلان المجاني.' : 'Could not check free ad availability.'}{' '}
              <button type="button" className="font-bold underline" onClick={() => { setEligibility('checking'); setEligibilityAttempt(value => value + 1); }}>{ar ? 'حاول تاني' : 'Retry'}</button>
            </div>}
            {!editId && tier === 'free' && typeof eligibility === 'object' && eligibility.status !== 'available' && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">
              {eligibility.status === 'active'
                ? (ar ? 'عندك إعلان مجاني نشط. استنى لحد ما مدته تنتهي.' : 'You already have an active free ad. Wait for it to end.')
                : eligibility.status === 'interval'
                  ? (ar ? 'تقدر ترسل إعلان مجاني تاني بعد' : 'You can submit your next free ad after') + ' ' +
                    new Date(eligibility.availableAt).toLocaleString(ar ? 'ar-EG' : 'en-GB', { timeZone: AD_TIME_ZONE }) + (ar ? ' بتوقيت القاهرة' : ' Cairo time')
                  : (ar ? 'عندك إعلان مجاني بانتظار الموافقة. استنى قرار الإدارة قبل إرسال إعلان تاني.' : 'You already have a free ad awaiting review. Wait for the decision before submitting another.')}
            </p>}
            {correctionId && <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
              {ar ? 'بيانات الطلب السابق جاهزة للتصحيح. أعد الإرسال بصورة واحدة أو بدون صورة.' : 'Your original ad details are ready to edit. Resubmit with one image or without an image.'}
            </p>}
            {tier && !freeFieldsLocked && <fieldset className="m-0 min-w-0 space-y-5 border-0 p-0">
            <section className={`bg-white rounded-2xl border border-slate-200 p-4 space-y-3 ${formSurface}`}>
              <h2 className="font-extrabold text-sm">{ar ? '2. بيانات الإعلان' : '2. Advertisement details'}</h2>
              <div><label htmlFor="offer-category" className={label}>{ar ? 'القسم' : 'Category'}</label>
                <select id="offer-category" required value={category} onChange={event => setCategory(event.target.value)} className={field}>
                  <option value="">{ar ? 'اختر القسم' : 'Choose category'}</option>
                  {OFFER_CATEGORY_LABELS.map(c => <option key={c.id} value={c.id}>{ar ? c.ar : c.en}</option>)}
                </select>
              </div>
              <div><label htmlFor="offer-title" className={label}>{ar ? 'عنوان الإعلان' : 'Title'}</label>
                <input id="offer-title" required maxLength={120} value={title} onChange={event => setTitle(event.target.value)}
                   aria-invalid={linkErrors.title} aria-describedby={linkErrors.title ? 'offer-title-error' : undefined}
                   className={field} placeholder={ar ? 'اكتب عنوانًا واضحًا للإعلان' : 'A clear advertisement title'} />
                 {linkErrors.title && <p id="offer-title-error" role="alert" className={fieldWarningClass}>{contentErrors.ad_external_link}</p>}
              </div>
              <div><label htmlFor="offer-desc" className={label}>{ar ? 'التفاصيل' : 'Description'}</label>
                <textarea id="offer-desc" rows={5} required maxLength={1000} value={description} onChange={event => setDescription(event.target.value.slice(0,1000))}
                   aria-invalid={linkErrors.description} aria-describedby={linkErrors.description ? 'offer-desc-error' : undefined}
                   className={field} placeholder={ar ? AD_NO_LINKS_AR : AD_NO_LINKS_EN} />
                 {linkErrors.description && <p id="offer-desc-error" role="alert" className={fieldWarningClass}>{contentErrors.ad_external_link}</p>}
                 <p aria-live="polite" className={`text-end text-[11px] font-semibold ${1000 - description.length <= 15 ? 'text-red-600' : 'text-slate-500'}`}>{ar ? `المتبقي: ${1000 - description.length} حرف` : `Remaining: ${1000 - description.length} characters`}</p>
              </div>
              <div><label htmlFor="offer-merchant" className={label}>{ar ? 'اسم المعلن أو النشاط' : 'Advertiser or business name'}</label>
                <input id="offer-merchant" required maxLength={100} value={merchant} onChange={event => setMerchant(event.target.value)}
                   aria-invalid={linkErrors.merchant} aria-describedby={linkErrors.merchant ? 'offer-merchant-error' : undefined} className={field} />
                 {linkErrors.merchant && <p id="offer-merchant-error" role="alert" className={fieldWarningClass}>{contentErrors.ad_external_link}</p>}
              </div>
              {isPaid ? <div className="grid gap-3 sm:grid-cols-2">
                <div><label htmlFor="offer-call-phone" className={label}>{ar ? 'رقم الاتصال (اختياري)' : 'Phone number (optional)'}</label>
                  <input id="offer-call-phone" type="tel" dir="ltr" maxLength={50} value={callPhone} onChange={event => setCallPhone(event.target.value)}
                    aria-invalid={phoneErrors.callPhone} aria-describedby={phoneErrors.callPhone ? 'offer-call-error' : undefined} className={field} />
                   {phoneErrors.callPhone && <p id="offer-call-error" role="alert" className={fieldWarningClass}>{contentErrors.ad_invalid_call_phone}</p>}
                </div>
                <div><label htmlFor="offer-whatsapp-phone" className={label}>{ar ? 'رقم واتساب (اختياري)' : 'WhatsApp number (optional)'}</label>
                  <input id="offer-whatsapp-phone" type="tel" dir="ltr" maxLength={50} value={whatsappPhone} onChange={event => setWhatsappPhone(event.target.value)}
                    aria-invalid={phoneErrors.whatsappPhone} aria-describedby={phoneErrors.whatsappPhone ? 'offer-whatsapp-error' : undefined} className={field} />
                   {phoneErrors.whatsappPhone && <p id="offer-whatsapp-error" role="alert" className={fieldWarningClass}>{contentErrors.ad_invalid_whatsapp_phone}</p>}
                </div>
                <div className="sm:col-span-2"><label htmlFor="offer-maps-url" className={label}>{ar ? 'رابط خرائط Google (اختياري)' : 'Google Maps link (optional)'}</label>
                  <input id="offer-maps-url" type="url" dir="ltr" maxLength={2048} value={mapsUrl} onChange={event => setMapsUrl(event.target.value)}
                    aria-invalid={phoneErrors.mapsUrl} aria-describedby={phoneErrors.mapsUrl ? 'offer-maps-error' : undefined} className={field} />
                   {phoneErrors.mapsUrl && <p id="offer-maps-error" role="alert" className={fieldWarningClass}>{contentErrors.ad_invalid_maps_url}</p>}
                </div>
              </div> : <div><label htmlFor="offer-contact" className={label}>{ar ? 'وسيلة التواصل (اختياري)' : 'Contact details (optional)'}</label>
                <input id="offer-contact" maxLength={200} value={contact} onChange={event => setContact(event.target.value)}
                   aria-invalid={linkErrors.contact} aria-describedby={linkErrors.contact ? 'offer-contact-error' : undefined} className={field} />
                 {linkErrors.contact && <p id="offer-contact-error" role="alert" className={fieldWarningClass}>{contentErrors.ad_external_link}</p>}
              </div>}
            </section>
            {!editId && <section className={`bg-white rounded-2xl border border-slate-200 p-4 space-y-3 ${formSurface}`}>
              <h2 className="font-extrabold text-sm">{ar ? '3. مدة النشر' : '3. Publication schedule'}</h2>
              {tier === 'free' ? <p className="text-xs text-slate-600 dark:text-slate-300">{freeSchedule}</p> : tier === 'vip' ? <div className="space-y-2">
                <p className="text-sm">{ar ? 'ينشر إعلان VIP فور موافقة الإدارة.' : 'VIP ads publish immediately after approval.'}</p>
                <label htmlFor="offer-vip-days" className={label}>{ar ? 'مدة النشر المدفوعة (بالأيام)' : 'Paid publication duration (days)'}</label>
                <input id="offer-vip-days" type="number" inputMode="numeric" min={1} step={1} required value={vipDays}
                  onChange={event => setVipDays(event.target.value)} className={field} />
              </div> : <>
              <p className={`text-xs text-slate-500 ${formMuted}`}>{ar ? 'المواعيد بتوقيت القاهرة. الإعلان لا يظهر إلا بعد موافقة الإدارة.' : 'All times are in Cairo time. The advertisement appears only after admin approval.'}</p>
              <AdScheduleFields id="start" lang={lang} value={startsAt} onChange={value => { setStartsAt(value); setDateError(null); }} />
              <AdScheduleFields id="end" lang={lang} value={endsAt} onChange={value => { setEndsAt(value); setDateError(null); }} />
              {dateError && <p role="alert" className="text-xs font-bold text-red-700">{dateError === 'invalid' ? (ar ? 'يرجى اختيار تاريخ ووقت صحيحين لبداية النشر ونهايته.' : 'Please choose valid start and end dates and times.') : dateError === 'order' ? (ar ? 'يجب أن يكون موعد نهاية النشر بعد موعد بدايته.' : 'The publication end must be after its start.') : (ar ? 'موعد نهاية النشر قد مضى. يرجى اختيار موعد في المستقبل.' : 'The publication end has passed. Please choose a future date and time.')}</p>}
              </>}
            </section>}
            <section className={`bg-white rounded-2xl border border-slate-200 p-4 space-y-3 ${formSurface}`}>
              <h2 className="flex items-center gap-2 font-extrabold text-sm"><ImagePlus className="w-5 h-5 text-emerald-700" aria-hidden="true" />{tier === 'free'
                ? (ar ? '4. صورة الإعلان (اختيارية)' : '4. Ad image (optional)')
                : (ar ? '4. صورة أو فيديو الإعلان (اختياري)' : '4. Advertisement image or video (optional)')}</h2>
              <div className="flex items-center gap-2">
              <input ref={fileInput} type="file" hidden onChange={async event => {
                const input = event.currentTarget;
                const next = input.files?.[0];
                if (!next || contentError === 'ad_external_link' || checkingVideo) return;
                const acceptedTypes = input.accept.split(',');
                input.value = '';
                const selection = ++imageSelection.current;
                preparation.current?.abort();
                const controller = new AbortController();
                preparation.current = controller;
                submission.current = null;
                setSendError('');
                editUpload.current = null;
                if (!editId) setReusedMedia(undefined);
                setVideoProgress(null);
                setImage(null); setMediaError('generic'); setCompressionNotice(false);
                const isVideo = next.type.startsWith('video/');
                if ((tier === 'free' && isVideo) || (!isVideo && next.size > 5 * 1024 * 1024) || !acceptedTypes.includes(next.type)) { setImageStatus('error'); return; }
                setImageStatus('compressing');
                if (isVideo) setVideoProgress('checking');
                try {
                  const result = isVideo
                    ? await compressAdVideo(next, progress => {
                      if (selection === imageSelection.current) setVideoProgress(progress);
                    }, controller.signal, videoLimit)
                    : await compressAdImage(next, controller.signal);
                  let selected = result;
                  if (isVideo && result !== next) {
                    try { await validateAdVideoDuration(result, videoLimit); }
                    catch { selected = next; }
                  }
                  if (selection === imageSelection.current) { setImage(selected); setImageStatus('ready'); }
                } catch (error) {
                  if (selection === imageSelection.current) {
                    const code = error instanceof Error ? error.message : '';
                    if (code === 'video_compression_unavailable') { setImage(next); setCompressionNotice(true); setImageStatus('ready'); return; }
                    setMediaError(code === 'video_too_long' || code === 'video_too_large' ? code : 'generic');
                    setImageStatus('error');
                  }
                }
              }} />
                <div className={`grid min-w-0 flex-1 grid-cols-1 gap-2 ${tier !== 'free' ? 'sm:grid-cols-2' : ''}`}>
                  {(tier === 'free' ? ['image'] as const : ['image', 'video'] as const).map(kind => {
                    const Icon = kind === 'image' ? ImagePlus : Video;
                    return <button key={kind} type="button" disabled={contentError === 'ad_external_link' || checkingVideo} onClick={() => openMediaPicker(kind)}

                      className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-2 text-sm font-bold text-emerald-900 hover:bg-emerald-100 focus-visible:outline-2 focus-visible:outline-emerald-700 disabled:opacity-50">
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      {kind === 'image' ? (ar ? 'تحميل صورة' : 'Upload image') : (ar ? 'تحميل فيديو' : 'Upload video')}
                    </button>;
                  })}
                </div>
                {(imageStatus !== 'idle' || reusedMedia) && <button type="button" onClick={removeMedia}
                  aria-label={ar ? 'إلغاء وإزالة الملف' : 'Cancel and remove media'}
                  title={ar ? 'إلغاء وإزالة الملف' : 'Cancel and remove media'}
                  className="grid size-11 shrink-0 place-items-center rounded-xl border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50">
                  <X className="size-5" aria-hidden="true" />
                </button>}
              </div>
              {editId && <p className={`text-xs text-slate-500 ${formMuted}`}>{requestingEdit
                ? (ar ? 'الملف الجديد هيترفع لما تبعت طلب التعديل.' : 'New media uploads when you submit the edit request.')
                : (ar ? 'رفع الملف الجديد يبدأ عند حفظ التعديلات.' : 'New media uploads when you save the changes.')}</p>}
              {!editId && <p className={`text-xs text-slate-500 ${formMuted}`}>{tier === 'free'
                ? (ar ? 'صورة واحدة بحد أقصى ٥ ميجابايت. الرفع يبدأ عند الإرسال للمراجعة.' : 'One image up to 5 MB. It uploads when you submit for review.')
                : ar ? 'الصور حتى ٥ ميجابايت، والفيديو حتى ٢٥ ميجابايت. الملف بيتجهّز على جهازك، والرفع يبدأ عند الإرسال للمراجعة.' : 'Images up to 5 MB. Videos up to 25 MB. Files are prepared on your device and uploaded when you submit for review.'}</p>}
              {tier !== 'free' && <p className="text-xs text-slate-600 dark:text-slate-300">{videoLimitMessage}</p>}
              {imageStatus === 'compressing' && (videoProgress === null
                ? <p role="status" className={`text-xs text-slate-600 ${formMuted}`}>{ar ? 'جاري تجهيز الصورة...' : 'Preparing the image…'}</p>
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
              {imageStatus === 'ready' && <p role="status" className={`text-xs text-emerald-700 dark:text-emerald-300`}>{ar ? 'الملف جاهز للمعاينة.' : 'File is ready for preview.'}</p>}
              {compressionNotice && <p className="text-xs text-amber-800">{ar ? 'المتصفح لا يدعم ضغط الفيديو؛ المعاينة تستخدم الملف الأصلي على جهازك.' : 'This browser cannot compress video; the local preview uses the original file.'}</p>}
              {imageStatus === 'error' && <p role="alert" className={`text-xs text-red-700 dark:text-red-300`}>{mediaError === 'video_too_long' ? videoLimitMessage : mediaError === 'video_too_large' ? (ar ? 'حجم الفيديو أكبر من 25 ميجابايت. اختار ملفًا أصغر.' : 'The video exceeds 25 MB. Choose a smaller file.') : (ar ? 'تعذر تجهيز الملف. تأكد من الحجم ونوع الملف ودعم المتصفح.' : 'Could not prepare the file. Check its size, type and browser support.')}</p>}
              {previewUrl && (previewType === 'video' ? <AdVideoPlayer src={previewUrl} poster={poster} label={ar ? 'معاينة فيديو الإعلان' : 'Advertisement video preview'} className="w-full max-h-48 object-contain rounded-xl bg-slate-50" /> : <img src={previewUrl} alt={ar ? 'معاينة الصورة' : 'Image preview'} className="w-full max-h-48 object-contain rounded-xl bg-slate-50" />)}


            </section>
            <button type="submit" disabled={imageStatus === 'compressing' || imageStatus === 'error' || (!editId && tier === 'vip' && !validVipDurationDays(vipDurationDays)) || checkingVideo || !!contentError} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold py-3 flex justify-center items-center gap-2"><Megaphone className="w-5 h-5" />{ar ? 'مراجعة الإعلان' : 'Review advertisement'}</button>
            </fieldset>}
          </form>
        )}
      </main>
    </div>
  );
}
