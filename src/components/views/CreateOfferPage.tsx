import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, ArrowLeft, ImagePlus, Megaphone, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { Language } from '../../types';
import { compressAdImage } from '../../utils/adImageCompression';
import { compressAdVideo } from '../../utils/adVideoCompression';
import { AdVideoPlayer } from '../AdVideoPlayer';
import { AdCreativeCard } from '../AdCreativeCard';
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
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [dateError, setDateError] = useState<'order' | 'past' | null>(null);
  const [image, setImage] = useState<File | null>(null);
  const [imageStatus, setImageStatus] = useState<'idle' | 'compressing' | 'ready' | 'error'>('idle');
  const [mediaError, setMediaError] = useState<'generic' | 'video_too_long' | 'video_too_large'>('generic');
  const [compressionNotice, setCompressionNotice] = useState(false);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'verifying' | 'success' | 'error'>('idle');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState('');
  const [pendingUpload, setPendingUpload] = useState<UploadedAdMedia | null>(null);
  const [verifiedUpload, setVerifiedUpload] = useState<{ secureUrl: string; publicId: string } | null>(null);
  const imageSelection = useRef(0);
  const [preview, setPreview] = useState(false);
  const [reviewPreview, setReviewPreview] = useState(false);
  const imageUrl = useMemo(() => image ? URL.createObjectURL(image) : null, [image]);
  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);
  const categoryName = categories.find(item => item.id === category);
  const isAdmin = auth.currentUser?.email?.trim().toLowerCase() === 'waelvts@gmail.com';
  const uploadTest = async () => {
    const user = auth.currentUser;
    if (!image || !user || user.email?.trim().toLowerCase() !== 'waelvts@gmail.com' || uploadState === 'uploading' || uploadState === 'verifying') return;
    const gateway = async (action: string, payload: Record<string, unknown>) => {
      const response = await fetch('/api/gateway', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + await user.getIdToken() }, body: JSON.stringify({ action, payload }) });
      const result = await response.json();
      if (!response.ok || !result?.ok) throw new Error(typeof result?.error === 'string' ? result.error : 'upload_failed');
      return result.data;
    };
    setUploadState('uploading'); setUploadProgress(0); setUploadError('');
    try {
      let uploaded = pendingUpload;
      if (!uploaded) {
        const resourceType = image.type.startsWith('video/') ? 'video' : 'image';
        const signed = await gateway('admin.ads.testUploadSign', { resourceType, bytes: image.size }) as SignedAdUpload;
        uploaded = await uploadAdMedia(image, signed, setUploadProgress);
        setPendingUpload(uploaded);
      }
      setUploadState('verifying');
      const data = await gateway('admin.ads.testUploadConfirm', { publicId: uploaded.publicId, resourceType: uploaded.resourceType, version: uploaded.version, responseSignature: uploaded.responseSignature });
      if (typeof data?.secureUrl !== 'string' || data?.publicId !== uploaded.publicId) throw new Error('upload_failed');
      setVerifiedUpload({ secureUrl: data.secureUrl, publicId: data.publicId });
      setUploadState('success');
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      setUploadError(code === 'ad_upload_not_configured'
        ? (ar ? 'إعدادات Cloudinary غير مكتملة على الخادم.' : 'Cloudinary server configuration is incomplete.')
        : (ar ? 'تعذر الرفع أو التأكد منه. حاول مرة أخرى.' : 'Upload or verification failed. Please try again.'));
      setUploadState('error');
    }
  };
  const handleReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const start = Date.parse(startsAt), end = Date.parse(endsAt);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) { setDateError('order'); return; }
    if (end <= Date.now()) { setDateError('past'); return; }
    setDateError(null);
    if (title.trim() && description.trim() && category && merchant.trim()) setPreview(true);
  };
  const label = 'block text-xs font-extrabold text-slate-700 mb-1.5';
  const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500';
  const BackIcon = ar ? ArrowRight : ArrowLeft;
  return (
    <div dir={ar ? 'rtl' : 'ltr'} className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-xl mx-auto px-4 py-4 flex items-center gap-3">
          <button type="button" onClick={preview ? () => setPreview(false) : onBack}
            className="w-11 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 inline-flex items-center justify-center shrink-0"
            aria-label={ar ? 'العودة' : 'Back'}><BackIcon className="w-5 h-5" /></button>
          <div className="min-w-0">
            <h1 className="font-extrabold text-lg">{preview ? (ar ? 'مراجعة الإعلان' : 'Review advertisement') : (ar ? 'إنشاء إعلان' : 'Create advertisement')}</h1>
            <p className="text-xs text-slate-500">My Bucket</p>
          </div>
        </div>
      </header>
      <main className="max-w-xl mx-auto px-4 py-5 pb-20 space-y-5">
        <div className="bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl p-3 flex items-start gap-2">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-xs leading-relaxed">{ar
            ? 'هذه صفحة تجهيز ومراجعة الإعلان فقط. الحفظ والإرسال والموافقة والنشر والدفع لم تُفعَّل بعد؛ لن يتم نشر أي إعلان من هذه الصفحة.'
            : 'This is a draft and review screen only. Saving, submitting, approval, publishing and payments are not enabled; no advertisement will be published.'}</p>
        </div>
        {preview ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-4">
            <div className="flex items-center gap-2"><CheckCircle2 className="w-5 h-5 text-emerald-600" /><h2 className="font-extrabold">{ar ? 'معاينة الإعلان قبل الإرسال' : 'Preview before submission'}</h2></div>
            <div className="grid grid-cols-2 gap-2" aria-label={ar ? 'طريقة المعاينة' : 'Preview mode'}>
              <button type="button" aria-pressed={!reviewPreview} onClick={() => setReviewPreview(false)} className={`rounded-xl border px-3 py-2 text-xs font-bold ${!reviewPreview ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-600'}`}>{ar ? 'شكل الإعلان' : 'Advertisement'}</button>
              <button type="button" aria-pressed={reviewPreview} onClick={() => setReviewPreview(true)} className={`rounded-xl border px-3 py-2 text-xs font-bold ${reviewPreview ? 'border-emerald-600 bg-emerald-50 text-emerald-800' : 'border-slate-200 text-slate-600'}`}>{ar ? 'شكل مراجعة الإدارة' : 'Admin review'}</button>
            </div>
            {reviewPreview && <p className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">{ar ? 'تصميم تجريبي لشاشة المراجعة. الموافقة والرفض غير مفعّلين بعد.' : 'Review screen demonstration. Approval and rejection are not enabled yet.'}</p>}
            {imageUrl && image?.type.startsWith('video/') && <p className="text-xs text-slate-500">{ar ? 'تجربة مشاهدة الزائر: 3 مرات يوميًا على هذا المتصفح.' : 'Visitor playback demo: 3 plays per day in this browser.'}</p>}
            <AdCreativeCard lang={lang} title={title} description={description} merchant={merchant} contact={contact} category={ar ? categoryName?.ar : categoryName?.en} mediaUrl={imageUrl} mediaType={image?.type.startsWith('video/') ? 'video' : 'image'} videoQuotaId="local-ad-preview-demo" />
            {reviewPreview && <div className="rounded-xl bg-emerald-50 border border-emerald-100 p-3 text-xs font-bold text-emerald-900">{ar ? 'نوع الإعلان:' : 'Advertisement type:'} {tier === 'free' ? (ar ? 'مجاني' : 'Free') : (ar ? 'مميز' : 'Featured')}</div>}
            <p className="text-xs text-slate-600">{ar ? 'بداية العرض:' : 'Starts:'} {new Date(startsAt).toLocaleString(ar ? 'ar-EG' : 'en-GB')}</p>
            <p className="text-xs text-slate-600">{ar ? 'نهاية العرض:' : 'Ends:'} {new Date(endsAt).toLocaleString(ar ? 'ar-EG' : 'en-GB')}</p>
            {reviewPreview && <div className="grid grid-cols-2 gap-2"><button type="button" disabled className="rounded-xl bg-emerald-100 text-emerald-800 opacity-60 py-2 text-xs font-bold">{ar ? 'موافقة' : 'Approve'}</button><button type="button" disabled className="rounded-xl bg-red-100 text-red-800 opacity-60 py-2 text-xs font-bold">{ar ? 'رفض' : 'Reject'}</button></div>}
            <button type="button" onClick={() => setPreview(false)} className="w-full rounded-xl border border-emerald-600 text-emerald-700 py-3 text-sm font-bold">{ar ? 'تعديل الإعلان' : 'Edit advertisement'}</button>
            <p className="text-center text-xs text-slate-500">{ar ? 'إرسال الإعلان للنشر غير متاح حاليًا' : 'Submission is not yet available'}</p>
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
              <h2 className="font-extrabold text-sm">{ar ? '3. مدة العرض' : '3. Advertisement schedule'}</h2>
              <p className="text-xs text-slate-500">{ar ? 'المواعيد حسب توقيت جهازك. الإعلان لا يظهر إلا بعد موافقة الإدارة.' : 'Times use your device time zone. The advertisement appears only after admin approval.'}</p>
              <div><label htmlFor="offer-start" className={label}>{ar ? 'بداية العرض' : 'Start'}</label>
                <input id="offer-start" type="datetime-local" required value={startsAt} onChange={event => { setStartsAt(event.target.value); setDateError(null); }} className={field} />
              </div>
              <div><label htmlFor="offer-end" className={label}>{ar ? 'نهاية العرض' : 'End'}</label>
                <input id="offer-end" type="datetime-local" required value={endsAt} onChange={event => { setEndsAt(event.target.value); setDateError(null); }} className={field} />
              </div>
              {dateError && <p role="alert" className="text-xs font-bold text-red-700">{dateError === 'order' ? (ar ? 'يجب أن يكون موعد نهاية الإعلان بعد موعد بدايته.' : 'The advertisement end must be after its start.') : (ar ? 'موعد نهاية الإعلان قد مضى. يرجى اختيار موعد في المستقبل.' : 'The advertisement end has passed. Please choose a future date and time.')}</p>}
            </section>
            <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <label htmlFor="offer-image" className="flex items-center gap-2 font-extrabold text-sm"><ImagePlus className="w-5 h-5 text-emerald-700" />{ar ? '4. صورة أو فيديو الإعلان (اختياري)' : '4. Advertisement image or video (optional)'}</label>
              <input id="offer-image" type="file" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime" disabled={uploadState === 'uploading' || uploadState === 'verifying'} onChange={async event => {
                const next = event.target.files?.[0] ?? null;
                const selection = ++imageSelection.current;
                setImage(null); setMediaError('generic'); setCompressionNotice(false); setUploadState('idle'); setUploadError(''); setPendingUpload(null); setVerifiedUpload(null);
                if (!next) { setImageStatus('idle'); return; }
                const isVideo = next.type.startsWith('video/');
                if ((!isVideo && next.size > 5 * 1024 * 1024) || !['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'].includes(next.type)) { setImageStatus('error'); return; }
                setImageStatus('compressing');
                try {
                  const result = isVideo ? await compressAdVideo(next) : await compressAdImage(next);
                  if (selection === imageSelection.current) { setImage(result); setImageStatus('ready'); }
                } catch (error) {
                  if (selection === imageSelection.current) {
                    const code = error instanceof Error ? error.message : '';
                    if (code === 'video_compression_unavailable') { setImage(next); setCompressionNotice(true); setImageStatus('ready'); return; }
                    setMediaError(code === 'video_too_long' || code === 'video_too_large' ? code : 'generic');
                    setImageStatus('error');
                  }
                }
              }} className="block w-full text-xs text-slate-600 file:me-3 file:border-0 file:rounded-lg file:bg-emerald-50 file:text-emerald-800 file:font-bold file:px-3 file:py-2" />
              <p className="text-xs text-slate-500">{ar ? 'للتجربة: الصور حتى 5 ميجابايت، والفيديو حتى 25 ميجابايت ودقيقة واحدة. تجهيز الفيديو قد يستغرق مدة تشغيله.' : 'For this preview: images up to 5 MB; videos up to 25 MB and one minute. Video preparation may take its full duration.'}</p>
              {imageStatus === 'compressing' && <p role="status" className="text-xs text-slate-600">{ar ? 'جاري تجهيز الملف...' : 'Preparing file...'}</p>}
              {imageStatus === 'ready' && <p role="status" className="text-xs text-emerald-700">{ar ? 'الملف جاهز للمعاينة.' : 'File is ready for preview.'}</p>}
              {compressionNotice && <p className="text-xs text-amber-800">{ar ? 'المتصفح لا يدعم ضغط الفيديو؛ المعاينة تستخدم الملف الأصلي على جهازك.' : 'This browser cannot compress video; the local preview uses the original file.'}</p>}
              {imageStatus === 'error' && <p role="alert" className="text-xs text-red-700">{mediaError === 'video_too_long' ? (ar ? 'مدة الفيديو أكتر من دقيقة. اختار فيديو مدته دقيقة أو أقل.' : 'The video is longer than one minute. Choose a video of one minute or less.') : mediaError === 'video_too_large' ? (ar ? 'حجم الفيديو أكبر من 25 ميجابايت. اختار ملفًا أصغر.' : 'The video exceeds 25 MB. Choose a smaller file.') : (ar ? 'تعذر تجهيز الملف. تأكد من الحجم ونوع الملف ودعم المتصفح.' : 'Could not prepare the file. Check its size, type and browser support.')}</p>}
              {imageUrl && (image?.type.startsWith('video/') ? <AdVideoPlayer src={imageUrl} label={ar ? 'معاينة فيديو الإعلان' : 'Advertisement video preview'} className="w-full max-h-48 object-contain rounded-xl bg-slate-50" /> : <img src={imageUrl} alt={ar ? 'معاينة الصورة' : 'Image preview'} className="w-full max-h-48 object-contain rounded-xl bg-slate-50" />)}
              {isAdmin && image && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 space-y-3">
                <p className="text-xs font-bold text-emerald-900">{ar ? 'اختبار رفع للإدارة فقط' : 'Admin-only upload test'}</p>
                <p className="text-xs leading-relaxed text-emerald-800">{ar ? 'يرفع الملف فعليًا إلى Cloudinary. لن يُحفظ الإعلان في Firebase أو يُرسل للمراجعة بعد، والملف التجريبي سيبقى في Cloudinary.' : 'Uploads the file to Cloudinary. The ad is not yet saved to Firebase or submitted for review; the test file remains in Cloudinary.'}</p>
                {uploadState !== 'success' && <button type="button" onClick={() => void uploadTest()} disabled={uploadState === 'uploading' || uploadState === 'verifying'} className="w-full rounded-xl bg-emerald-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{pendingUpload ? (ar ? 'إعادة التأكد من الرفع' : 'Retry verification') : (ar ? 'رفع تجريبي إلى Cloudinary' : 'Test upload to Cloudinary')}</button>}
                {uploadState === 'uploading' && <div role="status" className="text-xs text-emerald-900">{ar ? 'جاري رفع الملف' : 'Uploading file'}: {uploadProgress}%<progress max={100} value={uploadProgress} className="mt-2 block w-full" /></div>}
                {uploadState === 'verifying' && <p role="status" className="text-xs text-emerald-900">{ar ? 'اكتمل إرسال الملف، جاري التأكد منه...' : 'File sent; verifying...'}</p>}
                {uploadState === 'success' && verifiedUpload && <div role="status" className="space-y-2 text-xs text-emerald-900"><p className="font-bold">{ar ? 'تم الرفع والتأكد من الملف بنجاح.' : 'Upload and verification succeeded.'}</p><label className="block">{ar ? 'رابط الملف المحمي:' : 'Protected file URL:'}<input readOnly value={verifiedUpload.secureUrl} dir="ltr" className="mt-1 w-full rounded-lg border border-emerald-200 bg-white p-2 text-xs" /></label><p className="break-all" dir="ltr">{verifiedUpload.publicId}</p></div>}
                {uploadError && <p role="alert" className="text-xs text-red-700">{uploadError}</p>}
              </div>}

            </section>
            <button type="submit" disabled={imageStatus === 'compressing'} className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-extrabold py-3 flex justify-center items-center gap-2"><Megaphone className="w-5 h-5" />{ar ? 'مراجعة الإعلان' : 'Review advertisement'}</button>
          </form>
        )}
      </main>
    </div>
  );
}
