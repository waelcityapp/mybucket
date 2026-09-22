import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Database,
  RotateCcw,
  ShieldCheck,
} from 'lucide-react';
import { AuthUser, Language } from '../../types';
import { translations } from '../../data/translations';

interface AdminViewProps {
  lang: Language;
  user: AuthUser;
  onBack: () => void;
  onResetDemoData: () => void;
  onZeroAllBalances: () => void;
}

export function AdminView({
  lang,
  user,
  onBack,
  onResetDemoData,
  onZeroAllBalances,
}: AdminViewProps) {
  const t = translations[lang];
  const [confirmation, setConfirmation] = useState<'zero' | 'reset' | null>(null);

  const showConfirmation = (type: 'zero' | 'reset') => {
    setConfirmation(type);
    window.setTimeout(() => setConfirmation(null), 3000);
  };

  const handleZeroBalances = () => {
    onZeroAllBalances();
    showConfirmation('zero');
  };

  const handleReset = () => {
    onResetDemoData();
    showConfirmation('reset');
  };

  return (
    <div className="space-y-5 pb-20">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onBack}
          aria-label={lang === 'ar' ? 'العودة إلى الإعدادات' : 'Back to settings'}
          className="mt-0.5 w-9 h-9 rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 flex items-center justify-center cursor-pointer shrink-0"
        >
          {lang === 'ar' ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
        </button>
        <div>
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-amber-600" />
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              {lang === 'ar' ? 'لوحة الإدارة' : 'Admin dashboard'}
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            {lang === 'ar' ? 'صفحة خاصة بحساب الأدمن فقط' : 'Restricted to the administrator account'}
          </p>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-amber-700 shrink-0" />
        <div className="min-w-0">
          <div className="text-xs font-extrabold text-amber-900">
            {lang === 'ar' ? 'تم التحقق من حساب الأدمن' : 'Administrator verified'}
          </div>
          <div className="text-[11px] text-amber-800 truncate" dir="ltr">{user.email}</div>
        </div>
      </div>

      <section className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
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

        {confirmation ? (
          <div className="p-2.5 bg-emerald-50 text-emerald-800 text-xs font-bold rounded-xl flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>
              {confirmation === 'zero'
                ? (lang === 'ar' ? 'تم تصفير جميع الأرصدة بنجاح' : 'All balances set to zero successfully')
                : (lang === 'ar' ? 'تمت استعادة البيانات الافتراضية بنجاح' : 'Demo data reset successfully')}
            </span>
          </div>
        ) : null}
      </section>

      <section className="bg-slate-100/70 border border-slate-200/60 rounded-2xl p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
          <Database className="w-4 h-4 text-slate-500" />
          <span>{t.devDiagnostics}</span>
        </div>
        <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-xs font-medium flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{t.storageEnforcementBadge}</span>
        </div>
        <div className="space-y-1 bg-white p-3 rounded-xl border border-slate-200 font-mono text-[11px] text-slate-600" dir="ltr">
          <div>Active Auth: <strong>Admin ({user.email})</strong></div>
          <div>Firestore Database: <strong>ai-studio-mybucket-8e5dde08...</strong></div>
          <div>Storage Mode: Structured Firestore Documents Only</div>
        </div>
        <p className="text-[11px] text-slate-400">{t.devNote}</p>
      </section>
    </div>
  );
}
