import { ArrowDownRight, ArrowUpRight, ArrowLeftRight, Search, PlusCircle } from 'lucide-react';
import { TransactionType, Language } from '../types';
import { translations } from '../data/translations';

interface QuickActionsProps {
  lang: Language;
  onOpenAddModal: (preselectedType?: TransactionType) => void;
  onOpenSearchModal: () => void;
}

export function QuickActions({ lang, onOpenAddModal, onOpenSearchModal }: QuickActionsProps) {
  const t = translations[lang];

  return (
    <div className="w-full space-y-2">
      {/* 4 Quick Action Buttons: مصروف, دخل, تحويل, استعلام */}
      <div className="grid grid-cols-4 gap-2">
        {/* 1. مصروف */}
        <button
          id="btn-quick-expense"
          type="button"
          onClick={() => onOpenAddModal('expense')}
          className="py-2.5 px-1.5 sm:px-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-2xl transition-all active:scale-[0.98] cursor-pointer shadow-xs flex flex-col sm:flex-row items-center justify-center gap-1 font-black text-xs sm:text-sm group"
        >
          <ArrowDownRight className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
          <span className="tracking-tight">{t.quickExpense}</span>
        </button>

        {/* 2. دخل */}
        <button
          id="btn-quick-income"
          type="button"
          onClick={() => onOpenAddModal('income')}
          className="py-2.5 px-1.5 sm:px-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-2xl transition-all active:scale-[0.98] cursor-pointer shadow-xs flex flex-col sm:flex-row items-center justify-center gap-1 font-black text-xs sm:text-sm group"
        >
          <ArrowUpRight className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
          <span className="tracking-tight">{t.quickIncome}</span>
        </button>

        {/* 3. تحويل */}
        <button
          id="btn-quick-transfer"
          type="button"
          onClick={() => onOpenAddModal('transfer')}
          className="py-2.5 px-1.5 sm:px-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-2xl transition-all active:scale-[0.98] cursor-pointer shadow-xs flex flex-col sm:flex-row items-center justify-center gap-1 font-black text-xs sm:text-sm group"
        >
          <ArrowLeftRight className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
          <span className="tracking-tight">{t.quickTransfer}</span>
        </button>

        {/* 4. استعلام */}
        <button
          id="btn-quick-inquiry"
          type="button"
          onClick={onOpenSearchModal}
          className="py-2.5 px-1.5 sm:px-2 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-2xl transition-all active:scale-[0.98] cursor-pointer shadow-xs flex flex-col sm:flex-row items-center justify-center gap-1 font-black text-xs sm:text-sm group"
        >
          <Search className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
          <span className="tracking-tight">{t.quickInquiry || (lang === 'ar' ? 'استعلام' : 'Inquiry')}</span>
        </button>
      </div>

      {/* Manual Full Add Button with light green background and white text */}
      <button
        id="btn-add-transaction-manually"
        type="button"
        onClick={() => onOpenAddModal('expense')}
        className="w-full py-2.5 px-4 bg-emerald-500/90 hover:bg-emerald-600 active:bg-emerald-700 text-white rounded-2xl transition-all active:scale-[0.99] cursor-pointer shadow-xs flex items-center justify-center gap-2 group font-bold text-xs sm:text-sm"
      >
        <PlusCircle className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
        <span className="tracking-tight">
          {t.addTransactionManually}
        </span>
      </button>
    </div>
  );
}

