import { useState, useEffect, FormEvent } from 'react';
import { X, Check, FolderKanban, Crown, Plus, ShieldCheck } from 'lucide-react';
import { FinancialAccount, Language } from '../types';

interface ExtraAccountModalProps {
  isOpen: boolean;
  account: FinancialAccount | null;
  lang: Language;
  onClose: () => void;
  onSave: (accountId: string, newNameAr: string, newBalance: number) => void;
}

export function ExtraAccountModal({
  isOpen,
  account,
  lang,
  onClose,
  onSave,
}: ExtraAccountModalProps) {
  const [nameAr, setNameAr] = useState('');
  const [balanceStr, setBalanceStr] = useState('');
  const [showUpgradeNotice, setShowUpgradeNotice] = useState(false);

  useEffect(() => {
    if (account && isOpen) {
      setNameAr(account.nameAr || account.name || (lang === 'ar' ? 'حسابات أخرى' : 'Other Accounts'));
      setBalanceStr(String(account.balance));
      setShowUpgradeNotice(false);
    }
  }, [account, isOpen, lang]);

  if (!isOpen || !account) return null;

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const finalName = nameAr.trim() || (lang === 'ar' ? 'حسابات أخرى' : 'Other Accounts');
    const parsedBalance = parseFloat(balanceStr) || 0;
    onSave(account.id, finalName, parsedBalance);
    onClose();
  };

  const quickSuggestions = [
    'حساب ادخار شخصي',
    'حساب استثماري / بورصة',
    'حساب تجاري / بيزنس',
    'خزينة مالية خاصة',
    'حساب طوارئ',
    'حساب ذهب / فضة',
    'حساب توفير عملات أجنبية',
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 overflow-hidden max-h-[92vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shadow-2xs">
              <FolderKanban className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                {lang === 'ar' ? 'إدارة حسابات أخرى' : 'Other Accounts Settings'}
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                {lang === 'ar' ? 'تعديل اسم الحساب ورصيده الحالي' : 'Edit account name & current balance'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-4 h-4 stroke-[2.5]" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-5">
          {/* Main Edit Form */}
          <form onSubmit={handleSubmit} id="extraAccountForm" className="space-y-4">
            
            {/* 1. اسم الحساب مع التوضيح والمثال */}
            <div className="bg-indigo-50/40 border border-indigo-100/90 rounded-2xl p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-black text-indigo-900">
                  {lang === 'ar' ? 'اسم الحساب' : 'Account Name'}
                </label>
                <span className="text-[11px] font-bold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-md">
                  {lang === 'ar' ? 'عدل اسم الحساب كما تريد' : 'Customizable'}
                </span>
              </div>

              <p className="text-[12px] text-slate-600 font-medium leading-relaxed">
                {lang === 'ar' 
                  ? 'عدل اسم الحساب كما تريد (مثال: حساب ادخار شخصي، حساب استثماري، حساب تجاري، خزينة، حساب طوارئ...)'
                  : 'Customize account name as you wish (e.g. Savings, Investment, Business, Vault, Emergency Fund...)'}
              </p>

              <div className="relative">
                <input
                  type="text"
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: حساب ادخار شخصي' : 'e.g. Personal Savings'}
                  className="w-full bg-white border border-indigo-200 rounded-xl px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-hidden focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 transition-all placeholder:text-slate-400 font-sans"
                  required
                />
              </div>

              {/* اقتراحات سريعة */}
              {lang === 'ar' && (
                <div className="pt-1">
                  <span className="text-[11px] text-slate-500 font-bold block mb-1.5">
                    اقتراحات سريعة للاختيار:
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {quickSuggestions.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setNameAr(item)}
                        className={`text-[11px] px-2.5 py-1 rounded-lg font-bold border transition-all cursor-pointer ${
                          nameAr === item
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50'
                        }`}
                      >
                        {item}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 2. الرصيد الحالي */}
            <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-4 flex items-center justify-between shadow-2xs">
              <div>
                <span className="text-[11px] font-bold text-slate-500 block uppercase tracking-wider">
                  {lang === 'ar' ? 'الرصيد الحالي' : 'Current Balance'}
                </span>
                <span className="text-xs font-bold text-slate-700 block mt-0.5">
                  {nameAr || (lang === 'ar' ? 'حسابات أخرى' : 'Other Accounts')}
                </span>
              </div>
              <div className="text-end">
                <div className="text-xl sm:text-2xl font-black text-indigo-700 font-mono tracking-tight">
                  {account.balance.toLocaleString()}
                </div>
                <div className="text-[11px] font-bold text-slate-500 font-mono">
                  {account.currency}
                </div>
              </div>
            </div>

            {/* 3. تعديل الرصيد */}
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                {lang === 'ar' ? 'تعديل الرصيد' : 'Edit Balance'} ({account.currency})
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="any"
                  value={balanceStr}
                  onChange={(e) => setBalanceStr(e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-lg font-black text-slate-900 focus:bg-white focus:border-indigo-500 focus:outline-hidden transition-colors"
                />
                <span className="absolute end-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400 font-mono">
                  {account.currency}
                </span>
              </div>

              {/* خيارات سريعة للرصيد */}
              <div className="flex flex-wrap items-center gap-1.5 pt-2">
                <span className="text-[11px] font-bold text-slate-400">
                  {lang === 'ar' ? 'خيارات سريعة:' : 'Presets:'}
                </span>
                <button
                  type="button"
                  onClick={() => setBalanceStr('0')}
                  className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors cursor-pointer"
                >
                  0 ({lang === 'ar' ? 'تصفير' : 'Zero'})
                </button>
                {[500, 1000, 2000, 5000, 10000].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setBalanceStr(String(val))}
                    className="text-xs px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-lg transition-colors cursor-pointer"
                  >
                    +{val.toLocaleString()}
                  </button>
                ))}
              </div>
            </div>

            {/* زر حفظ التعديلات */}
            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl cursor-pointer transition-colors"
              >
                {lang === 'ar' ? 'إلغاء' : 'Cancel'}
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5 transition-colors active:scale-95"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{lang === 'ar' ? 'حفظ التعديلات' : 'Save Changes'}</span>
              </button>
            </div>
          </form>

          {/* Divider */}
          <div className="relative py-1">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-3 text-slate-400 font-bold">
                {lang === 'ar' ? 'ثانياً' : 'Secondary'}
              </span>
            </div>
          </div>

          {/* ثانياً: إضافة حساب آخر */}
          <div className="bg-gradient-to-br from-indigo-50/60 via-slate-50 to-amber-50/50 border border-slate-200 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
                  <Crown className="w-4 h-4" />
                </div>
                <span className="text-xs font-black text-slate-900">
                  {lang === 'ar' ? 'إضافة حساب آخر' : 'Add Another Account'}
                </span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-amber-200/80 text-amber-900 px-2 py-0.5 rounded-full">
                Plus / Pro
              </span>
            </div>

            <p className="text-xs text-slate-600 font-medium leading-relaxed mb-3">
              {lang === 'ar'
                ? 'هل تريد إضافة حسابات إضافية متخصصة ومستقلة (مثل حسابات ادخار، حسابات تجارية، استثمارية، أو خزائن مالية)؟'
                : 'Create dedicated extra accounts for savings, business, investments, or vaults.'}
            </p>

            <button
              type="button"
              onClick={() => setShowUpgradeNotice(!showUpgradeNotice)}
              className="w-full py-2.5 px-4 bg-white hover:bg-indigo-50 border border-indigo-300/80 hover:border-indigo-400 text-indigo-900 font-black text-xs rounded-xl shadow-2xs flex items-center justify-center gap-2 transition-all cursor-pointer active:scale-98"
            >
              <Plus className="w-4 h-4 text-indigo-600 stroke-[3]" />
              <span>{lang === 'ar' ? '+ إضافة حساب آخر' : '+ Add Another Account'}</span>
            </button>

            {/* رسالة الترقية المطلوبة (Plus / Pro) */}
            {showUpgradeNotice && (
              <div className="mt-3 bg-white border-2 border-indigo-300 rounded-2xl p-4 shadow-md animate-in slide-in-from-top-2 duration-200">
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                    <Crown className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-slate-900 leading-snug">
                      {lang === 'ar' ? 'ترقية الخطة لإضافة حسابات إضافية' : 'Plan Upgrade Required'}
                    </h4>
                    <p className="text-xs font-bold text-indigo-950 mt-1 leading-relaxed bg-indigo-50 p-2.5 rounded-xl border border-indigo-200">
                      {lang === 'ar'
                        ? 'يجب الانتقال إلى الخطة Plus حيث يمكنك إنشاء 3 حسابات أو الخطة Pro حتى 10 حسابات'
                        : 'Upgrade to Plus plan (up to 3 accounts) or Pro plan (up to 10 accounts).'}
                    </p>
                  </div>
                </div>

                {/* مقارنة الخطط */}
                <div className="grid grid-cols-2 gap-2.5 my-3">
                  {/* الخطة Plus */}
                  <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3 text-center">
                    <span className="inline-block text-[10px] font-black uppercase text-indigo-800 bg-indigo-100 px-2 py-0.5 rounded-full mb-1">
                      خطة PLUS
                    </span>
                    <div className="text-base font-black text-indigo-950">
                      3 حسابات
                    </div>
                    <div className="text-[11px] text-indigo-800 font-medium mt-0.5">
                      {lang === 'ar' ? 'إنشاء حتى 3 حسابات منفصلة' : 'Up to 3 separate accounts'}
                    </div>
                  </div>

                  {/* الخطة Pro */}
                  <div className="bg-amber-50/90 border border-amber-400 rounded-xl p-3 text-center">
                    <span className="inline-block text-[10px] font-black uppercase text-amber-900 bg-amber-200 px-2 py-0.5 rounded-full mb-1">
                      خطة PRO
                    </span>
                    <div className="text-base font-black text-amber-950">
                      10 حسابات
                    </div>
                    <div className="text-[11px] text-amber-900 font-medium mt-0.5">
                      {lang === 'ar' ? 'إنشاء حتى 10 حسابات متعددة' : 'Up to 10 multiple accounts'}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-medium">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                    <span>{lang === 'ar' ? 'مزامنة سحابية كاملة' : 'Full cloud sync'}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowUpgradeNotice(false)}
                    className="text-xs font-bold text-slate-500 hover:text-slate-800 px-3 py-1 rounded-lg cursor-pointer"
                  >
                    {lang === 'ar' ? 'إغلاق التنبيه' : 'Close notice'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
