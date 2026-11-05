import { useEffect, useState } from 'react';
import { Check, ClipboardCopy, Download, ExternalLink, Globe, Share2, Smartphone, X } from 'lucide-react';
import { Language, AuthUser } from '../types';

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};
interface MobileLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  user: AuthUser | null;
  onLogin: () => void;
}
const installedDisplayMode = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export function MobileLinkModal({ isOpen, onClose, lang, user, onLogin }: MobileLinkModalProps) {
  const isAr = lang === 'ar';
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(installedDisplayMode);
  const [copied, setCopied] = useState(false);
  const [prompting, setPrompting] = useState(false);
  const [notice, setNotice] = useState('');
  const appUrl = window.location.origin + '/';
  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // Keep the browser install offer until the user explicitly asks to install.
  // iOS does not expose beforeinstallprompt: instructions are always available.
  useEffect(() => {
    const onInstallReady = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
      setNotice('');
    };
    window.addEventListener('beforeinstallprompt', onInstallReady);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onInstallReady);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!isOpen) return null;

  const install = async () => {
    if (!promptEvent || prompting) return;
    setPrompting(true);
    setNotice('');
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === 'dismissed') {
        setNotice(isAr ? 'يمكنك التثبيت لاحقًا من قائمة المتصفح.' : 'You can install later from the browser menu.');
      }
      setPromptEvent(null);
    } catch {
      setNotice(isAr ? 'استخدم قائمة المتصفح ثم اختر تثبيت التطبيق.' : 'Use the browser menu and select Install app.');
      setPromptEvent(null);
    } finally {
      setPrompting(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
    } catch {
      setNotice(isAr ? 'يمكنك نسخ الرابط المعروض يدويًا.' : 'You can copy the displayed link manually.');
    }
  };

  return (
    <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-label={isAr ? 'تثبيت My Bucket على الموبايل' : 'Install My Bucket'} dir={isAr ? 'rtl' : 'ltr'} className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <header className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
          <div className="flex items-center gap-3">
            <img src="/icons/mybucket-192.png" alt="" className="h-12 w-12 shrink-0 rounded-xl" />
            <div>
              <h2 className="text-lg font-black text-slate-900">{isAr ? 'ثبّت My Bucket على موبايلك' : 'Install My Bucket'}</h2>
              <p className="mt-1 text-xs leading-5 text-slate-500">{isAr ? 'أيقونة على الشاشة الرئيسية تفتح التطبيق مباشرة.' : 'Add a home-screen icon to open the app directly.'}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={isAr ? 'إغلاق' : 'Close'} className="rounded-full bg-slate-100 p-2 text-slate-600 hover:bg-slate-200"><X className="h-4 w-4" /></button>
        </header>

        <div className="space-y-4 p-4">
          {installed ? (
            <div role="status" className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
              <Check className="h-5 w-5" />
              {isAr ? 'أنت تستخدم النسخة المثبّتة بالفعل.' : 'You are already using the installed app.'}
            </div>
          ) : (
            <>
              {promptEvent && (
                <button type="button" disabled={prompting} onClick={() => void install()} className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-4 py-3 text-sm font-black text-white hover:bg-emerald-800 disabled:opacity-60">
                  <Download className="h-5 w-5" />{prompting ? (isAr ? 'جارٍ فتح التثبيت...' : 'Opening install prompt...') : (isAr ? 'تثبيت التطبيق الآن' : 'Install app now')}
                </button>
              )}
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-800"><Smartphone className="h-4 w-4 text-emerald-700" />{isAr ? 'على أندرويد' : 'On Android'}</h3>
                <p className="mt-2 text-xs leading-6 text-slate-700">{isAr ? 'افتح التطبيق باستخدام Chrome، واضغط قائمة الثلاث نقاط (⋮)، ثم اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية».' : 'Open the site in Chrome, tap the three-dot menu (⋮), then choose Install app or Add to Home screen.'}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                <h3 className="flex items-center gap-2 text-sm font-extrabold text-slate-800"><Share2 className="h-4 w-4 text-emerald-700" />{isAr ? 'على آيفون' : 'On iPhone'}</h3>
                <p className="mt-2 text-xs leading-6 text-slate-700">{isAr ? 'افتح التطبيق في Safari، واضغط زر المشاركة، ثم «إضافة إلى الشاشة الرئيسية». فعّل «فتح كتطبيق» إن ظهر، ثم اضغط «إضافة».' : 'Open in Safari, tap Share, choose Add to Home Screen, enable Open as Web App when shown, then tap Add.'}</p>
                {isIOS && <span className="mt-2 inline-block text-[11px] font-bold text-emerald-800">{isAr ? 'الآيفون لا يدعم زر التثبيت التلقائي؛ استخدم المشاركة.' : 'On iPhone, use the Share menu to install.'}</span>}
              </div>
            </>
          )}
          {notice && <p role="status" className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{notice}</p>}
          <div className="space-y-2 rounded-xl border border-slate-200 p-3">
            <p className="flex items-center gap-1.5 text-xs font-bold text-slate-700"><Globe className="h-4 w-4 text-emerald-700"/>{isAr ? 'رابط الموقع الحالي' : 'Current website link'}</p>
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-left font-mono text-xs text-slate-600" dir="ltr">{appUrl}</span>
              <button type="button" onClick={() => void copy()} className="flex shrink-0 items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100">
                {copied ? <Check className="h-3.5 w-3.5" /> : <ClipboardCopy className="h-3.5 w-3.5" />}
                {copied ? (isAr ? 'نُسخ' : 'Copied') : (isAr ? 'نسخ' : 'Copy')}
              </button>
            </div>
          </div>
          <details className="rounded-xl border border-slate-200 bg-white p-3">
            <summary className="cursor-pointer text-xs font-bold text-slate-700">
              {isAr ? 'عرض رمز QR لفتح الموقع على موبايل آخر' : 'Show QR code to open on another phone'}
            </summary>
            <div className="mt-3 flex justify-center">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(appUrl)}`}
                alt={isAr ? 'رمز QR لرابط My Bucket' : 'QR code for My Bucket website'}
                width={180}
                height={180}
                loading="lazy"
                className="rounded-lg border border-slate-200 bg-white p-2"
              />
            </div>
            <p className="mt-2 text-center text-[10px] text-slate-500">{isAr ? 'امسح الرمز بالكاميرا، ثم اتبع خطوات تثبيت التطبيق.' : 'Scan with your phone, then follow the installation steps.'}</p>
          </details>
          <p className="text-center text-[11px] leading-5 text-slate-500">{isAr ? 'التثبيت مجاني. بياناتك تظل محفوظة في حساب Google وتحتاج الإنترنت للمزامنة؛ لا نحفظ البيانات المالية دون اتصال.' : 'Installation is free. Your Google account data stays in the cloud; an internet connection is needed for syncing. Financial data is not cached offline.'}</p>
          {!user && <button type="button" onClick={() => {onClose();onLogin();}} className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">{isAr ? 'تسجيل الدخول بجوجل' : 'Sign in with Google'}</button>}
        </div>
        <footer className="flex justify-between gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
          <a href={appUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800">{isAr ? 'فتح الموقع' : 'Open website'}<ExternalLink className="h-3.5 w-3.5" /></a>
          <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100">{isAr ? 'إغلاق' : 'Close'}</button>
        </footer>
      </section>
    </div>
  );
}
