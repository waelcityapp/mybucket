import { useState } from 'react';
import { X, Smartphone, Copy, Check, ExternalLink, QrCode, Cloud, ShieldCheck } from 'lucide-react';
import { Language, AuthUser } from '../types';
import { translations } from '../data/translations';

interface MobileLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  user: AuthUser | null;
  onLogin: () => void;
}

export function MobileLinkModal({
  isOpen,
  onClose,
  lang,
  user,
  onLogin,
}: MobileLinkModalProps) {
  const t = translations[lang];
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // App URLs from metadata
  const sharedUrl = 'https://ais-pre-kmvu3thnicxc3bfxa677c2-497491106818.europe-west1.run.app';
  const devUrl = 'https://ais-dev-kmvu3thnicxc3bfxa677c2-497491106818.europe-west1.run.app';
  const [selectedUrlType, setSelectedUrlType] = useState<'shared' | 'dev'>('dev');

  const activeUrl = selectedUrlType === 'dev' ? devUrl : sharedUrl;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(activeUrl)}`;

  const handleCopy = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
      <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl border border-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Smartphone className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-extrabold text-slate-900 text-sm tracking-tight">
                {t.mobileLinkTitle}
              </h2>
              <p className="text-[11px] text-slate-500">
                {lang === 'ar' ? 'تابع محفظتك لحظة بلحظة من هاتفك' : 'Track your wallet live on mobile'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-200/60 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* URL Switcher Pills */}
          <div className="flex rounded-xl bg-slate-100 p-1 gap-1">
            <button
              type="button"
              onClick={() => setSelectedUrlType('dev')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedUrlType === 'dev'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {lang === 'ar' ? 'رابط التطوير المباشر (Dev)' : 'Direct Dev Link'}
            </button>
            <button
              type="button"
              onClick={() => setSelectedUrlType('shared')}
              className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                selectedUrlType === 'shared'
                  ? 'bg-white text-emerald-800 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {lang === 'ar' ? 'رابط المشاركة (Shared)' : 'Shared App Link'}
            </button>
          </div>

          {/* QR Code section */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col items-center text-center">
            <div className="w-44 h-44 bg-white p-2.5 rounded-xl shadow-xs border border-slate-200 flex items-center justify-center">
              <img
                src={qrCodeUrl}
                alt="Scan to open on Mobile"
                className="w-full h-full object-contain"
              />
            </div>
            <p className="text-xs font-bold text-slate-700 mt-3 flex items-center gap-1.5">
              <QrCode className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                {lang === 'ar'
                  ? 'وجّه كاميرا هاتفك نحو الرمز للمتابعة فوراً'
                  : 'Scan with your phone camera to open'}
              </span>
            </p>
          </div>

          {/* Direct Link & Copy */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block">
              {lang === 'ar' ? 'الرابط النشط حالياً:' : 'Active Link:'}
            </label>
            <div className="flex items-center gap-2 bg-slate-100/90 border border-slate-200 rounded-xl p-2 px-3">
              <span className="text-xs text-slate-600 truncate font-mono select-all flex-1 text-left ltr" dir="ltr">
                {activeUrl}
              </span>
              <button
                type="button"
                onClick={() => handleCopy(activeUrl)}
                className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-2xs"
              >
                {copied ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>{t.copied}</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>{t.copyLink}</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Why link might not open tip */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-900 space-y-1">
            <span className="font-bold flex items-center gap-1">
              ⚠️ {lang === 'ar' ? 'لو الرابط لا يفتح على هاتفك:' : 'If the link doesn’t open:'}
            </span>
            <p className="leading-relaxed">
              {lang === 'ar'
                ? '1. جرّب التبديل إلى "رابط التطوير المباشر (Dev)" أعلاه، وتأكد أنك مسجل في متصفح الهاتف بنفس حساب Google صاحب المشروع.'
                : '1. Switch to "Direct Dev Link" above and make sure you are logged in on your phone browser with your Google account.'}
            </p>
            <p className="leading-relaxed">
              {lang === 'ar'
                ? '2. أو اضغط على زر "Share" (مشاركة) في الشريط العلوي لواجهة AI Studio لجعل رابط المعاينة متاحاً عاماً.'
                : '2. Or click the "Share" button at the top of AI Studio to make the preview publicly accessible.'}
            </p>
          </div>

          {/* Google Account Sync Card */}
          <div className="rounded-2xl p-3.5 border border-emerald-200 bg-emerald-50/50 space-y-2">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                <Cloud className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-extrabold text-emerald-950">
                {lang === 'ar' ? 'المزامنة مع حساب Google' : 'Sync with Google Account'}
              </span>
            </div>

            {user ? (
              <div className="text-xs text-slate-600 space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span className="font-semibold text-slate-800">
                    {lang === 'ar' ? 'أنت مسجل حالياً بحساب:' : 'Currently signed in as:'}
                  </span>
                </div>
                <p className="font-medium text-emerald-800 bg-white/70 py-1 px-2 rounded-lg border border-emerald-100 truncate">
                  {user.email}
                </p>
                <p className="text-[11px] text-slate-500">
                  {lang === 'ar'
                    ? 'عند فتح الرابط في هاتفك وسجّلت بنفس هذا الحساب، ستظهر جميع حساباتك ومصاريفك متزامنة لحظياً.'
                    : 'When you open the link on mobile and sign in with this account, all data will sync instantly.'}
                </p>
              </div>
            ) : (
              <div className="space-y-2 text-xs">
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  {lang === 'ar'
                    ? 'لربط البيانات بين الكمبيوتر والهاتف، سجّل دخولك بحساب Google. سيتم حفظ كل معاملة في السحابة فورياً.'
                    : 'To sync data between PC and mobile, sign in with your Google account. All transactions will be backed up.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    onLogin();
                    onClose();
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-bold rounded-xl shadow-2xs transition-colors cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    />
                  </svg>
                  <span>{t.signInWithGoogle}</span>
                </button>
              </div>
            )}
          </div>

          {/* Instructions to install PWA on Phone */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 text-slate-600 text-xs space-y-1.5">
            <span className="font-bold text-slate-800 block">
              {lang === 'ar' ? '💡 لتجربة مثل التطبيق الحقيقي على الهاتف:' : '💡 For an app-like mobile experience:'}
            </span>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600">
              {lang === 'ar' ? (
                <>
                  <li><strong>على iPhone (Safari):</strong> اضغط زر المشاركة (Share) ثم اختر <em>"إضافة إلى الشاشة الرئيسية" (Add to Home Screen)</em>.</li>
                  <li><strong>على Android (Chrome):</strong> اضغط الثلاث نقاط أعلى المتصفح ثم اختر <em>"تثبيت التطبيق" أو "إضافة للشاشة الرئيسية"</em>.</li>
                </>
              ) : (
                <>
                  <li><strong>iPhone (Safari):</strong> Tap the Share button and select <em>"Add to Home Screen"</em>.</li>
                  <li><strong>Android (Chrome):</strong> Tap the menu (3 dots) and select <em>"Install App" or "Add to Home screen"</em>.</li>
                </>
              )}
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between">
          <a
            href={activeUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
          >
            <span>{lang === 'ar' ? 'فتح في نافذة جديدة' : 'Open in new tab'}</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
          >
            {lang === 'ar' ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
