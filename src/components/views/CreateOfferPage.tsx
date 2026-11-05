import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowRight, ArrowLeft, ImagePlus, Megaphone, CheckCircle2, ShieldAlert } from 'lucide-react';
import type { Language } from '../../types';

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
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState(false);
  const imageUrl = useMemo(() => image ? URL.createObjectURL(image) : null, [image]);
  useEffect(() => () => { if (imageUrl) URL.revokeObjectURL(imageUrl); }, [imageUrl]);
  const categoryName = categories.find(item => item.id === category);
  const handleReview = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
            {imageUrl && <img src={imageUrl} alt={ar ? 'صورة الإعلان المختارة' : 'Selected ad image'} className="w-full max-h-56 object-contain bg-slate-50 rounded-xl" />}
            <div className="flex justify-between text-xs gap-3"><strong>{tier === 'free' ? (ar ? 'إعلان مجاني' : 'Free') : (ar ? 'إعلان مميز' : 'Featured')}</strong><span className="text-slate-500">{ar ? categoryName?.ar : categoryName?.en}</span></div>
            <h2 className="text-lg font-extrabold break-words">{title}</h2>
            <p className="text-sm text-slate-700 whitespace-pre-wrap break-words">{description}</p>
            <p className="text-xs text-slate-600">{ar ? 'المعلن:' : 'Advertiser:'} {merchant}</p>
            {contact && <p className="text-xs text-slate-600 break-all">{ar ? 'وسيلة التواصل:' : 'Contact:'} {contact}</p>}
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
                <textarea id="offer-desc" rows={5} required maxLength={3000} value={description} onChange={event => setDescription(event.target.value)} className={field} placeholder={ar ? 'اكتب تفاصيل الإعلان وشروط العرض إن وجدت' : 'Describe the advertisement and any conditions'} />
              </div>
              <div><label htmlFor="offer-merchant" className={label}>{ar ? 'اسم المعلن أو النشاط' : 'Advertiser or business name'}</label>
                <input id="offer-merchant" required maxLength={100} value={merchant} onChange={event => setMerchant(event.target.value)} className={field} />
              </div>
              <div><label htmlFor="offer-contact" className={label}>{ar ? 'وسيلة التواصل (اختياري)' : 'Contact details (optional)'}</label>
                <input id="offer-contact" maxLength={200} value={contact} onChange={event => setContact(event.target.value)} className={field} />
              </div>
            </section>
            <section className="bg-white rounded-2xl border border-slate-200 p-4 space-y-3">
              <label htmlFor="offer-image" className="flex items-center gap-2 font-extrabold text-sm"><ImagePlus className="w-5 h-5 text-emerald-700" />{ar ? '3. صورة الإعلان (اختياري)' : '3. Advertisement image (optional)'}</label>
              <input id="offer-image" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => {
                const next = event.target.files?.[0] ?? null;
                setImage(next && next.size <= 5 * 1024 * 1024 ? next : null);
              }} className="block w-full text-xs text-slate-600 file:me-3 file:border-0 file:rounded-lg file:bg-emerald-50 file:text-emerald-800 file:font-bold file:px-3 file:py-2" />
              <p className="text-xs text-slate-500">{ar ? 'معاينة محلية فقط — PNG أو JPG أو WebP حتى 5 ميجابايت. لن تُرفع الصورة.' : 'Local preview only — PNG, JPG or WebP up to 5 MB. No upload.'}</p>
              {imageUrl && <img src={imageUrl} alt={ar ? 'معاينة الصورة' : 'Image preview'} className="w-full max-h-48 object-contain rounded-xl bg-slate-50" />}
            </section>
            <button type="submit" className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold py-3 flex justify-center items-center gap-2"><Megaphone className="w-5 h-5" />{ar ? 'مراجعة الإعلان' : 'Review advertisement'}</button>
          </form>
        )}
      </main>
    </div>
  );
}
