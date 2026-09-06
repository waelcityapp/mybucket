import React, { useState } from 'react';
import {
  Crown,
  FileSpreadsheet,
  FileText,
  Share2,
  Mail,
  Printer,
  X,
  Sparkles,
  CheckCircle2,
  Lock,
  Download,
  Send,
  HelpCircle,
  FileCheck,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { Language } from '../types';

export type ExportFormat = 'excel' | 'pdf' | 'whatsapp' | 'email' | 'print';

interface ProExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  lang: Language;
  title?: string;
  subtitle?: string;
  itemCount?: number;
  totalAmount?: number;
  periodLabel?: string;
  initialFormat?: ExportFormat;
}

export function ProExportModal({
  isOpen,
  onClose,
  lang,
  title,
  subtitle,
  itemCount,
  totalAmount,
  periodLabel,
  initialFormat = 'excel',
}: ProExportModalProps) {
  const isAr = lang === 'ar';
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>(initialFormat);
  const [showNotification, setShowNotification] = useState(false);

  if (!isOpen) return null;

  const formatNumber = (num?: number) => {
    if (num === undefined || num === null) return '0.00';
    return new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-US', {
      maximumFractionDigits: 2,
    }).format(num);
  };

  const exportOptions: {
    id: ExportFormat;
    nameAr: string;
    nameEn: string;
    ext: string;
    icon: any;
    color: string;
    badge: string;
    descAr: string;
    descEn: string;
  }[] = [
    {
      id: 'excel',
      nameAr: 'تصدير إكسيل (Excel)',
      nameEn: 'Export Excel Spreadsheet',
      ext: '.XLSX / .CSV',
      icon: FileSpreadsheet,
      color: 'bg-emerald-600 text-white',
      badge: isAr ? 'الأكثر طلباً' : 'Popular',
      descAr: 'جدول حسابي متكامل بصيغة XLSX مع معادلات الجمع الآلي وتصنيف الأعمدة بالتواريخ والحسابات.',
      descEn: 'Complete XLSX spreadsheet with automated sum formulas, categorized columns, dates, and accounts.',
    },
    {
      id: 'pdf',
      nameAr: 'تقرير PDF رسمي منسق',
      nameEn: 'Official Formatted PDF',
      ext: '.PDF',
      icon: FileText,
      color: 'bg-rose-600 text-white',
      badge: isAr ? 'جاهز للطباعة' : 'Print Ready',
      descAr: 'كشف حساب رسمي أنيق مع ترويسة وشعار مخصص ورسوم بيانية وتفقيط المبالغ المالية.',
      descEn: 'Elegant official financial statement with custom header, logo, charts, and spelled out totals.',
    },
    {
      id: 'whatsapp',
      nameAr: 'مشاركة كشف الحساب عبر WhatsApp',
      nameEn: 'Share via WhatsApp',
      ext: 'Chat / PDF Link',
      icon: Share2,
      color: 'bg-emerald-500 text-white',
      badge: isAr ? 'مباشر' : 'Instant',
      descAr: 'إرسال ملخص الاستفسار أو الكشف المالي مباشرة عبر محادثة واتساب بضغطة زر واحدة.',
      descEn: 'Send the financial inquiry summary or statement directly via WhatsApp chat in one click.',
    },
    {
      id: 'email',
      nameAr: 'إرسال تقرير مجدول بالبريد',
      nameEn: 'Send via Email',
      ext: 'Email / Attachment',
      icon: Mail,
      color: 'bg-blue-600 text-white',
      badge: isAr ? 'تلقائي' : 'Automated',
      descAr: 'إرسال الملف المالي مرفقاً بصيغة PDF أو Excel إلى بريدك أو بريد المحاسب فورياً.',
      descEn: 'Send financial file attached as PDF or Excel to your email or accountant instantly.',
    },
    {
      id: 'print',
      nameAr: 'طباعة مباشرة وفاتورة A4',
      nameEn: 'Direct Print (A4 Format)',
      ext: 'Print / Paper',
      icon: Printer,
      color: 'bg-slate-800 text-white',
      badge: isAr ? 'مقاس A4' : 'A4 Size',
      descAr: 'تنسيق طباعة ذكي متجاوب مع الطابعات الحرارية وطابعات المكاتب A4.',
      descEn: 'Smart printing layout compatible with thermal printers and standard office A4.',
    },
  ];

  const handleRequestPro = () => {
    setShowNotification(true);
    setTimeout(() => {
      setShowNotification(false);
    }, 4500);
  };

  const currentOption = exportOptions.find((o) => o.id === selectedFormat) || exportOptions[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200"
      dir={isAr ? 'rtl' : 'ltr'}
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-lg rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header with Golden PRO Theme */}
        <div className="relative p-5 bg-gradient-to-br from-amber-500 via-amber-600 to-amber-700 text-white overflow-hidden shrink-0">
          {/* Background Decorative Pattern */}
          <div className="absolute -top-12 -left-12 w-36 h-36 bg-white/10 rounded-full blur-xl pointer-events-none" />
          <div className="absolute -bottom-8 -right-8 w-32 h-32 bg-amber-400/20 rounded-full blur-lg pointer-events-none" />

          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center text-amber-200 shadow-inner shrink-0">
                <Crown className="w-7 h-7 text-amber-100 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-lg font-black text-white tracking-wide">
                    {isAr ? 'تصدير التقارير وكشوف الحسابات' : 'Export Reports & Statements'}
                  </h2>
                  <span className="inline-flex items-center gap-1 bg-white text-amber-800 text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-xs uppercase tracking-wider">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    {isAr ? 'الخطة البرو PRO' : 'PRO Plan'}
                  </span>
                </div>
                <p className="text-xs text-amber-100/90 font-medium mt-0.5">
                  {subtitle ||
                    (isAr
                      ? 'ميزة حصرية لتصدير ومشاركة نتائج البحث والاستفسارات'
                      : 'Exclusive feature to export & share financial statements')}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
              aria-label="Close"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          {/* Current Inquired Context Pills */}
          {(itemCount !== undefined || totalAmount !== undefined || periodLabel) && (
            <div className="mt-4 pt-3 border-t border-white/20 flex items-center justify-between gap-2 flex-wrap text-xs font-bold text-amber-50">
              {title && (
                <div className="bg-black/20 px-2.5 py-1 rounded-xl truncate max-w-[200px]">
                  📌 {title}
                </div>
              )}
              {periodLabel && (
                <div className="bg-black/20 px-2.5 py-1 rounded-xl">
                  🗓️ {periodLabel}
                </div>
              )}
              {itemCount !== undefined && (
                <div className="bg-black/20 px-2.5 py-1 rounded-xl">
                  🔢 {itemCount} {isAr ? 'عملية' : 'txs'}
                </div>
              )}
              {totalAmount !== undefined && (
                <div className="bg-black/20 px-2.5 py-1 rounded-xl">
                  💰 {formatNumber(totalAmount)} EGP
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Body & Format Options */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Format Selector Grid */}
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
              <span>{isAr ? 'اختر صيغة أو وسيلة التصدير المطلوبة:' : 'Select Export Format or Channel:'}</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {exportOptions.map((opt) => {
                const isSelected = selectedFormat === opt.id;
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSelectedFormat(opt.id)}
                    className={`relative p-3 rounded-2xl border text-right sm:text-start flex items-center gap-3 transition-all cursor-pointer ${
                      isSelected
                        ? 'border-amber-500 bg-amber-50/50 shadow-xs ring-2 ring-amber-400/30'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${opt.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-black text-slate-900 truncate">
                          {isAr ? opt.nameAr : opt.nameEn}
                        </span>
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded-md shrink-0">
                          {opt.badge}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-slate-400 block mt-0.5">
                        {opt.ext}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected Format Highlight Box */}
          <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-3.5 space-y-2">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${currentOption.color}`}>
                {React.createElement(currentOption.icon, { className: 'w-4 h-4' })}
              </div>
              <div className="text-xs font-black text-slate-800">
                {isAr ? currentOption.nameAr : currentOption.nameEn}
              </div>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              {isAr ? currentOption.descAr : currentOption.descEn}
            </p>
          </div>

          {/* PRO Feature Notice Alert */}
          <div className="p-4 bg-gradient-to-r from-amber-50 via-amber-100/60 to-amber-50 rounded-2xl border border-amber-200/80 space-y-2.5">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0">
                <Lock className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-xs font-black text-amber-900">
                {isAr
                  ? 'تنبيه: التصدير متاح حصرياً لمشتركي باقة MyBucket PRO 👑'
                  : 'Notice: Exporting is exclusive to MyBucket PRO Subscribers 👑'}
              </h3>
            </div>
            <p className="text-xs text-amber-800 leading-relaxed font-medium">
              {isAr
                ? 'تتيح لك الخطة البرو استخراج وتصدير تقارير محاسبية غير محدودة، ومشاركتها مع المحاسبين والشركاء، وحفظ نسخ احتياطية بضغطة زر.'
                : 'The PRO Plan allows unlimited financial exports, statement sharing with accountants, and offline Excel/PDF backups.'}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1 text-[11px] font-bold text-amber-950">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{isAr ? 'تصدير غير محدود بصيغ Excel و PDF' : 'Unlimited Excel & PDF exports'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{isAr ? 'مشاركة فورية عبر WhatsApp و Email' : 'Instant WhatsApp & Email sharing'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{isAr ? 'تقارير ضريبية ومحاسبية معتمدة' : 'Official accounting statements'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>{isAr ? 'حفظ نسخ احتياطية أوفلاين دائمة' : 'Permanent offline backups'}</span>
              </div>
            </div>
          </div>

          {/* Toast Notification when clicking Request */}
          {showNotification && (
            <div className="p-3 bg-emerald-600 text-white rounded-xl text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in duration-150">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>
                  {isAr
                    ? 'تم تسجيل اهتمامك بالترقية للباقة البرو! سيتواصل معك فريق الدعم فور الإطلاق.'
                    : 'Interest registered! Support will notify you upon PRO launch.'}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
          >
            {isAr ? 'إلغاء / رجوع' : 'Cancel / Back'}
          </button>

          <button
            type="button"
            onClick={handleRequestPro}
            className="flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-500 hover:from-amber-600 to-amber-600 hover:to-amber-700 text-white rounded-xl text-xs font-black shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 transition-transform active:scale-95 cursor-pointer"
          >
            <Crown className="w-4 h-4 text-amber-200" />
            <span>{isAr ? 'ترقية الآن إلى الخطة البرو (PRO) ⭐️' : 'Upgrade to PRO Plan ⭐️'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
