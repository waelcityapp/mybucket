import { useState } from 'react';
import {
  Globe,
  RotateCcw,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  Database,
  CheckCircle2,
  Smartphone,
  Cloud,
  LogOut,
  User as UserIcon,
  ExternalLink,
} from 'lucide-react';
import { Language, AuthUser } from '../../types';
import { translations } from '../../data/translations';
import { storageService } from '../../services/storage/storageManager';

interface SettingsViewProps {
  lang: Language;
  onSetLanguage: (lang: Language) => void;
  onResetDemoData: () => void;
  onZeroAllBalances?: () => void;
  user: AuthUser | null;
  onLogin: () => void;
  onLogout: () => void;
  onOpenMobileLink: () => void;
}

export function SettingsView({
  lang,
  onSetLanguage,
  onResetDemoData,
  onZeroAllBalances,
  user,
  onLogin,
  onLogout,
  onOpenMobileLink,
}: SettingsViewProps) {
  const t = translations[lang];
  const [showDevAccordion, setShowDevAccordion] = useState(false);
  const [resetConfirmed, setResetConfirmed] = useState(false);
  const [zeroConfirmed, setZeroConfirmed] = useState(false);

  const activeProvider = storageService.getProvider().name;

  const handleReset = () => {
    onResetDemoData();
    setResetConfirmed(true);
    setTimeout(() => setResetConfirmed(false), 3000);
  };

  const handleZeroBalances = () => {
    if (onZeroAllBalances) {
      onZeroAllBalances();
      setZeroConfirmed(true);
      setTimeout(() => setZeroConfirmed(false), 3000);
    }
  };

  return (
    <div className="space-y-5 pb-20">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
          {t.settingsTitle}
        </h1>
        <p className="text-xs text-slate-500">
          {lang === 'ar' ? 'إدارة حسابك والمزامنة السحابية وتفضيلات التطبيق' : 'Manage your account, cloud sync, and preferences'}
        </p>
      </div>

      {/* 1. Google Account & Cloud Sync Section */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Cloud className="w-4 h-4 text-emerald-600" />
            <span>{t.googleAccount} & {t.cloudSync}</span>
          </div>
          {user ? (
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse"></span>
              {lang === 'ar' ? 'متزامن سحابياً' : 'Cloud Synced'}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600">
              {t.guestMode}
            </span>
          )}
        </div>

        {user ? (
          <div className="space-y-3 pt-1">
            <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-200/80">
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.displayName || 'Google User'}
                  className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-11 h-11 rounded-full bg-emerald-600 text-white font-bold text-base flex items-center justify-center shrink-0">
                  {(user.displayName || user.email || 'U')[0].toUpperCase()}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="font-bold text-xs sm:text-sm text-slate-900 truncate">
                  {user.displayName || (lang === 'ar' ? 'مستخدم Google' : 'Google User')}
                </div>
                <div className="text-[11px] text-slate-500 truncate">{user.email}</div>
                <div className="text-[10px] text-emerald-700 font-semibold mt-0.5 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                  <span>{lang === 'ar' ? 'جميع حساباتك ومصروفاتك محفوظة على السحابة' : 'All accounts and transactions backed up'}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onOpenMobileLink}
                className="flex-1 py-2 px-3 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                <span>{t.mobileLinkTitle}</span>
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="py-2 px-3 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>{t.signOut}</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-slate-600 leading-relaxed">
              {t.notSignedInPrompt}
            </p>
            <button
              id="btn-settings-google-signin"
              type="button"
              onClick={onLogin}
              className="w-full flex items-center justify-center gap-2.5 py-3 px-4 bg-white border border-slate-300 hover:bg-slate-50 hover:border-slate-400 text-slate-800 font-bold text-xs rounded-xl shadow-2xs transition-all cursor-pointer"
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

      {/* 2. Mobile Access & QR Link Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <span>{t.mobileLinkTitle}</span>
          </div>
          <span className="text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-md">
            PWA Mobile
          </span>
        </div>

        <p className="text-xs text-slate-500">
          {t.mobileLinkDesc}
        </p>

        <button
          type="button"
          onClick={onOpenMobileLink}
          className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2 shadow-xs"
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
          <span>{lang === 'ar' ? 'عرض رمز QR ورابط الموبايل' : 'Show Mobile QR & Link'}</span>
        </button>
      </div>

      {/* 3. Language Preference */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <Globe className="w-4 h-4 text-emerald-600" />
          <span>{t.languageLabel}</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => onSetLanguage('ar')}
            className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              lang === 'ar'
                ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-2xs'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.langArabic}
          </button>

          <button
            type="button"
            onClick={() => onSetLanguage('en')}
            className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              lang === 'en'
                ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-2xs'
                : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {t.langEnglish}
          </button>
        </div>
      </div>

      {/* 4. Data Management */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-800">
          <RotateCcw className="w-4 h-4 text-slate-600" />
          <span>{t.dataManagement}</span>
        </div>
        <p className="text-xs text-slate-500">{t.resetNotice}</p>

        <div className="flex flex-col gap-2 pt-1">
          <button
            type="button"
            onClick={handleZeroBalances}
            className="w-full py-2.5 px-4 rounded-xl border border-rose-200 hover:border-rose-300 bg-rose-50/50 hover:bg-rose-50 text-rose-700 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.zeroAllBalances}</span>
          </button>

          <button
            type="button"
            onClick={handleReset}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{t.resetDemoData}</span>
          </button>
        </div>

        {zeroConfirmed && (
          <div className="p-2.5 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{lang === 'ar' ? 'تم تصفير جميع الأرصدة بنجاح' : 'All balances set to zero successfully'}</span>
          </div>
        )}

        {resetConfirmed && (
          <div className="p-2.5 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>{lang === 'ar' ? 'تمت استعادة البيانات الافتراضية بنجاح' : 'Demo data reset successfully'}</span>
          </div>
        )}
      </div>

      {/* 5. Technical Diagnostics */}
      <div className="bg-slate-100/70 border border-slate-200/60 rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => setShowDevAccordion(!showDevAccordion)}
          className="w-full p-3.5 flex items-center justify-between text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer"
        >
          <span className="flex items-center gap-2">
            <Database className="w-3.5 h-3.5 text-slate-400" />
            <span>{t.devDiagnostics}</span>
          </span>
          {showDevAccordion ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </button>

        {showDevAccordion && (
          <div className="p-4 pt-0 border-t border-slate-200/50 space-y-2.5 text-xs text-slate-600">
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 font-medium flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>{t.storageEnforcementBadge}</span>
            </div>

            <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-200 font-mono text-[11px]">
              <div>Active Auth: <strong>{user ? `Logged in (${user.email})` : 'Anonymous / Local'}</strong></div>
              <div>Firestore Database: <strong>ai-studio-mybucket-8e5dde08...</strong></div>
              <div>Storage Mode: Structured Firestore Documents Only</div>
            </div>

            <p className="text-[11px] text-slate-400">
              {t.devNote}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
