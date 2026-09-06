import { useState, useRef, useEffect } from 'react';
import { Globe, Smartphone, Cloud, LogOut, Check, ChevronDown } from 'lucide-react';
import { Language, AuthUser } from '../types';
import { translations } from '../data/translations';

interface HeaderProps {
  lang: Language;
  onToggleLanguage: () => void;
  user: AuthUser | null;
  onLogin: () => void;
  onLogout: () => void;
  onOpenMobileLink: () => void;
}

export function Header({
  lang,
  onToggleLanguage,
  user,
  onLogin,
  onLogout,
  onOpenMobileLink,
}: HeaderProps) {
  const t = translations[lang];
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="bg-white/95 backdrop-blur-md sticky top-0 z-20 px-3 sm:px-6 py-2.5 border-b border-slate-100">
      <div className="max-w-md sm:max-w-xl mx-auto flex items-center justify-between gap-2">
        {/* Left: Mobile Link Quick Button */}
        <button
          id="btn-header-mobile"
          type="button"
          onClick={onOpenMobileLink}
          aria-label={t.mobileLinkTitle}
          title={lang === 'ar' ? 'افتح التطبيق على الموبايل' : 'Open on Mobile'}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-50 hover:bg-emerald-100/80 border border-emerald-200 text-emerald-800 text-xs font-bold transition-all cursor-pointer shadow-2xs"
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-600 animate-pulse" />
          <span className="hidden xs:inline text-[11px] font-bold">
            {lang === 'ar' ? 'الموبايل' : 'Mobile'}
          </span>
        </button>

        {/* Center: Bucket Logo + Brand Title + Subtitle */}
        <div className="flex flex-col items-center justify-center text-center">
          <div className="flex items-center gap-1.5">
            {/* Minimalist Green Bucket Icon */}
            <div className="w-6 h-6 sm:w-7 sm:h-7 rounded-xl bg-emerald-500 flex items-center justify-center text-white shadow-xs">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-3.5 h-3.5 sm:w-4 sm:h-4"
              >
                <path d="M5 9h14l-1.5 11h-11L5 9z" />
                <path d="M8 9V6a4 4 0 0 1 8 0v3" />
              </svg>
            </div>
            <span className="font-extrabold text-slate-900 tracking-tight text-base sm:text-lg leading-none">
              {t.appName}
            </span>
          </div>
          <span className="text-[9px] sm:text-[10px] text-slate-400 font-medium tracking-tight mt-0.5">
            {t.headerSubtitle}
          </span>
        </div>

        {/* Right: Language Pill + Google Account Auth */}
        <div className="flex items-center gap-1.5">
          {/* Language Toggle */}
          <button
            id="btn-lang-toggle"
            type="button"
            onClick={onToggleLanguage}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-full border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-semibold transition-all cursor-pointer shadow-2xs"
            title={lang === 'en' ? 'التحويل إلى اللغة العربية' : 'Switch to English'}
          >
            <Globe className="w-3 h-3 text-blue-500" />
            <span>{lang === 'en' ? 'عربي' : 'EN'}</span>
          </button>

          {/* User Auth: Google Button or Avatar Dropdown */}
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                id="btn-user-avatar"
                type="button"
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center gap-1 p-0.5 rounded-full hover:ring-2 hover:ring-emerald-400 border border-emerald-200 bg-emerald-50 transition-all cursor-pointer"
                title={user.email || 'Google User'}
              >
                {user.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt={user.displayName || 'Google User'}
                    className="w-7 h-7 rounded-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-emerald-600 text-white font-bold text-xs flex items-center justify-center">
                    {(user.displayName || user.email || 'U')[0].toUpperCase()}
                  </div>
                )}
                {/* Online Sync Indicator Dot */}
                <span className="absolute bottom-0 end-0 w-2.5 h-2.5 bg-emerald-500 border-2 border-white rounded-full"></span>
              </button>

              {/* Dropdown Menu */}
              {isUserMenuOpen && (
                <div
                  className={`absolute ${
                    lang === 'ar' ? 'left-0' : 'right-0'
                  } top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200 p-3 z-50 text-right animate-in fade-in`}
                >
                  <div className="flex items-center gap-2.5 pb-2.5 border-b border-slate-100">
                    {user.photoURL ? (
                      <img
                        src={user.photoURL}
                        alt=""
                        className="w-9 h-9 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-emerald-600 text-white font-bold text-sm flex items-center justify-center">
                        {(user.displayName || user.email || 'U')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0 text-start">
                      <div className="font-bold text-xs text-slate-900 truncate">
                        {user.displayName || (lang === 'ar' ? 'مستخدم مسجل' : 'Signed User')}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate">{user.email}</div>
                    </div>
                  </div>

                  {/* Sync Status Badge */}
                  <div className="my-2 p-2 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center gap-2 text-start">
                    <Cloud className="w-4 h-4 text-emerald-600 shrink-0" />
                    <div>
                      <div className="text-[11px] font-bold text-emerald-950">
                        {t.cloudSyncActive}
                      </div>
                      <div className="text-[9px] text-emerald-700">
                        {lang === 'ar' ? 'متزامن مع هاتفك والكمبيوتر' : 'Synced to your phone & PC'}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onOpenMobileLink();
                      }}
                      className="w-full flex items-center justify-between p-2 rounded-xl hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors cursor-pointer"
                    >
                      <span className="flex items-center gap-2">
                        <Smartphone className="w-3.5 h-3.5 text-emerald-600" />
                        <span>{t.mobileLinkTitle}</span>
                      </span>
                      <span className="text-[10px] text-emerald-600 font-bold">QR</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        onLogout();
                      }}
                      className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-rose-50 text-xs font-bold text-rose-600 transition-colors cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>{t.signOut}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            /* Google Sign-In Button */
            <button
              id="btn-google-login"
              type="button"
              onClick={onLogin}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border border-slate-200 hover:border-slate-300 bg-white hover:bg-slate-50 text-slate-700 text-xs font-bold transition-all cursor-pointer shadow-2xs"
              title={t.signInWithGoogle}
            >
              {/* Google G SVG */}
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
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
              <span className="hidden xs:inline text-[11px] font-bold">
                {lang === 'ar' ? 'دخول بجوجل' : 'Sign in'}
              </span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
