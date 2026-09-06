import { PlusCircle } from 'lucide-react';
import { TransactionType, Language } from '../types';
import { translations } from '../data/translations';

interface QuickActionsProps {
  lang: Language;
  onOpenAddModal: (preselectedType?: TransactionType) => void;
}

export function QuickActions({ lang, onOpenAddModal }: QuickActionsProps) {
  const t = translations[lang];

  return (
    <div className="w-full">
      {/* Secondary Manual Action Button - Clean, modern, understated compared to Hero AI Card */}
      <button
        id="btn-add-transaction-manually"
        type="button"
        onClick={() => onOpenAddModal('expense')}
        className="w-full py-2.5 px-4 bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 rounded-2xl transition-all active:scale-[0.99] cursor-pointer shadow-2xs flex items-center justify-center gap-2 text-slate-700 hover:text-slate-900 group"
      >
        <PlusCircle className="w-4 h-4 text-emerald-600 group-hover:scale-110 transition-transform" />
        <span className="text-xs sm:text-sm font-bold tracking-tight">
          {t.addTransactionManually}
        </span>
      </button>
    </div>
  );
}

