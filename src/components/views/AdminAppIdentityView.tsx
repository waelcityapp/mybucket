import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, ImagePlus, Save, ShieldCheck, RotateCcw, Loader2 } from 'lucide-react';
import type { Language } from '../../types';
import { identityRequest, uploadBrandIcon, type AppIdentity } from '../../services/appIdentityClient';

type Props = { lang: Language; identity: AppIdentity; identityReady: boolean; onSaved: (updated: AppIdentity) => void; onBack: () => void };
const MAX_BYTES = 3 * 1024 * 1024;
const allowedTypes = ['image/png', 'image/jpeg', 'image/webp'];

export function AdminAppIdentityView({ lang, identity, identityReady, onSaved, onBack }: Props) {
  const ar = lang === 'ar';
  const [nameAr, setNameAr] = useState(identity.appNameAr);
  const [nameEn, setNameEn] = useState(identity.appNameEn);
  const [file, setFile] = useState<File | null>(null);
  // Keep a completed upload for a save retry instead of charging Cloudinary again.
  const [pendingPublicId, setPendingPublicId] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [clearIcon, setClearIcon] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (dirty) return;
    setNameAr(identity.appNameAr);
    setNameEn(identity.appNameEn);
  }, [identity.appNameAr, identity.appNameEn, dirty]);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const blob = URL.createObjectURL(file);
    setPreview(blob);
    return () => URL.revokeObjectURL(blob);
  }, [file]);

  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0] || null;
    event.target.value = '';
    setError(''); setSuccess('');
    if (!selected) return;
    if (!allowedTypes.includes(selected.type) || selected.size < 1 || selected.size > MAX_BYTES) {
      setError(ar ? 'اختر PNG أو JPG أو WebP بحجم لا يتجاوز 3 ميجابايت.' : 'Choose a PNG, JPG or WebP image under 3 MB.');
      return;
    }
    setFile(selected); setPendingPublicId(null); setClearIcon(false); setDirty(true);
  };
  const resetIcon = () => {
    setFile(null); setPendingPublicId(null); setClearIcon(true); setDirty(true); setError(''); setSuccess('');
  };
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saving || !identityReady) return;
    if (!nameAr.trim() || !nameEn.trim() || nameAr.trim().length > 48 || nameEn.trim().length > 48) {
      setError(ar ? 'اسم التطبيق مطلوب في اللغتين، بحد أقصى 48 حرفًا.' : 'Enter both names, with a maximum of 48 characters each.');
      return;
    }
    setSaving(true); setError(''); setSuccess('');
    try {
      let iconPublicId = clearIcon ? null : identity.iconPublicId;
      if (file) {
        iconPublicId = pendingPublicId || await uploadBrandIcon(file);
        setPendingPublicId(iconPublicId);
      }
      const updated = await identityRequest<AppIdentity>('admin.identity.save', {
        appNameAr: nameAr.trim(), appNameEn: nameEn.trim(), iconPublicId,
      });
      onSaved(updated);
      setFile(null); setPendingPublicId(null); setClearIcon(false); setDirty(false);
      setSuccess(ar ? 'تم حفظ هوية التطبيق بنجاح. قد تحتاج أيقونة التطبيق المثبّت إلى إعادة تثبيت حسب الجهاز.' : 'App identity saved. Installed app icons may need reinstalling on some devices.');
    } catch (failure) {
      const code = failure instanceof Error ? failure.message : 'unknown_error';
      setError(code === 'identity_media_not_configured'
        ? (ar ? 'إعدادات Cloudinary غير مكتملة في الخادم.' : 'Cloudinary server settings are missing.')
        : code === 'invalid_identity_image'
        ? (ar ? 'الصورة غير مناسبة. اختر صورة واضحة، لا تقل عن 256 بكسل لكل بُعد وبحجم أقل من 3 ميجابايت.' : 'Image must be at least 256px on each side and under 3 MB.')
        : (ar ? 'تعذر حفظ الهوية أو رفع الأيقونة. لم تُحفظ التغييرات؛ جرّب مرة أخرى. (' + code + ')' : 'Could not save the identity or upload the icon. Please retry. (' + code + ')'));
    } finally { setSaving(false); }
  };
  const shownIcon = preview || (clearIcon ? '/icons/mybucket-512.png' : identity.iconUrl || '/icons/mybucket-512.png');
  return (
    <div dir={ar ? 'rtl' : 'ltr'} className="mx-auto max-w-2xl space-y-4 pb-24">
      <div className="flex items-start gap-3">
        <button type="button" onClick={onBack} disabled={saving} aria-label={ar ? 'العودة للوحة الإدارة' : 'Back to admin'} className="rounded-xl border border-slate-200 bg-white p-2.5 text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {ar ? <ArrowRight className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
        </button>
        <div>
          <h1 className="text-xl font-black text-slate-900">{ar ? 'التحكم في هوية التطبيق' : 'App identity'}</h1>
          <p className="mt-1 text-xs text-slate-500">{ar ? 'تغيير الاسم والأيقونة التي تظهر في My Bucket' : 'Edit the app name and icon displayed in My Bucket'}</p>
        </div>
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900">
        <ShieldCheck className="h-4 w-4 shrink-0" />
        {ar ? 'للإدارة فقط · تُحفظ التغييرات على الخادم · صور الهوية في Cloudinary الخاص بـ My Bucket' : 'Admin only · Server-controlled changes · My Bucket Cloudinary'}
      </div>
      {!identityReady && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-800">{ar ? 'تعذر تحميل بيانات الهوية من الخادم. حدّث الصفحة قبل إجراء تغييرات.' : 'Could not load the identity from the server. Refresh the page before editing.'}</p>}
      <form onSubmit={save} className="space-y-4">
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="text-sm font-extrabold text-slate-900">{ar ? 'اسم التطبيق' : 'App name'}</h2>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-slate-600">{ar ? 'الاسم بالعربية' : 'Arabic name'}</span>
            <input type="text" dir="auto" maxLength={48} required value={nameAr} onChange={e => { setNameAr(e.target.value); setDirty(true); setSuccess(''); }} disabled={saving}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:outline-none disabled:opacity-60" />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-bold text-slate-600">{ar ? 'الاسم بالإنجليزية' : 'English name'}</span>
            <input type="text" dir="ltr" maxLength={48} required value={nameEn} onChange={e => { setNameEn(e.target.value); setDirty(true); setSuccess(''); }} disabled={saving}
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-900 focus:border-emerald-500 focus:outline-none disabled:opacity-60" />
          </label>
        </section>
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold text-slate-900">{ar ? 'أيقونة التطبيق' : 'App icon'}</h2>
            <span className="text-[11px] font-medium text-slate-500">PNG · JPG · WebP</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-emerald-200 bg-emerald-50 p-2 shadow-inner">
              <img src={shownIcon} alt={ar ? 'معاينة أيقونة التطبيق' : 'App icon preview'} className="h-full w-full object-contain" />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white hover:bg-emerald-800">
                <ImagePlus className="h-4 w-4" />
                {ar ? 'اختيار أيقونة جديدة' : 'Choose new icon'}
                <input type="file" accept="image/png,image/jpeg,image/webp" disabled={saving} className="sr-only" onChange={chooseFile} />
              </label>
              <button type="button" onClick={resetIcon} disabled={saving} className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-600 underline hover:text-slate-900 disabled:opacity-50">
                <RotateCcw className="h-3.5 w-3.5" />{ar ? 'استعادة الأيقونة الأصلية' : 'Restore original icon'}
              </button>
              <p className="text-[11px] leading-relaxed text-slate-500">{ar ? 'الأفضل صورة مربعة 512×512 بكسل أو أكبر، ولا تتجاوز 3 ميجابايت. يمكنك مراجعتها قبل الحفظ.' : 'Prefer a square image of 512×512 pixels or larger, under 3 MB. Review it before saving.'}</p>
              {file && <p className="text-[11px] font-semibold text-emerald-700 break-all">{file.name} · {Math.round(file.size / 1024)} KB</p>}
              {clearIcon && <p className="text-[11px] text-amber-700">{ar ? 'سيتم استخدام أيقونة My Bucket الأصلية عند الحفظ.' : 'Original My Bucket icon will be restored when saved.'}</p>}
            </div>
          </div>
        </section>
        {error && <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs font-semibold text-rose-800">{error}</p>}
        {success && <p role="status" className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800"><CheckCircle2 className="h-4 w-4 shrink-0" />{success}</p>}
        <button type="submit" disabled={saving || !identityReady || !nameAr.trim() || !nameEn.trim() || !dirty}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 py-3.5 text-sm font-black text-white shadow-sm transition-colors hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? (ar ? 'جاري رفع الصورة وحفظ الهوية...' : 'Uploading and saving...') : (ar ? 'حفظ التغييرات' : 'Save changes')}
        </button>
      </form>
    </div>
  );
}
