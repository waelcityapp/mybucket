import { ArrowDown, ArrowUp, ArrowLeftRight, Search } from 'lucide-react';
import { TransactionType, Language } from '../types';
import { translations } from '../data/translations';

interface QuickActionsProps {
  lang: Language;
  onOpenAddModal: (preselectedType?: TransactionType) => void;
  onOpenSearchModal: () => void;
}

export function QuickActions({ lang, onOpenAddModal, onOpenSearchModal }: QuickActionsProps) {
  const t = translations[lang];
  const buttonStyle = 'min-w-0 min-h-[64px] sm:min-h-[72px] px-1 py-2 rounded-2xl bg-gradient-to-b from-[#159b66] to-[#007b59] text-white shadow-sm shadow-emerald-900/10 hover:from-[#118c5d] hover:to-[#006d4f] active:scale-[0.98] transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700 flex flex-col items-center justify-center gap-1 font-bold text-xs sm:text-sm';
  const iconStyle = 'flex h-7 w-7 sm:h-8 sm:w-8 shrink-0 items-center justify-center rounded-full';

  return (
    <div className="w-full">
      <div className="grid grid-cols-4 gap-2">
        <button id="btn-quick-expense" type="button" onClick={() => onOpenAddModal('expense')} className={buttonStyle}>
          <span className={`${iconStyle} bg-[#fb7185]`}><ArrowDown size={18} strokeWidth={2.5} aria-hidden="true" /></span>
          <span>{t.quickExpense}</span>
        </button>
        <button id="btn-quick-income" type="button" onClick={() => onOpenAddModal('income')} className={buttonStyle}>
          <span className={`${iconStyle} bg-[#55c95d]`}><ArrowUp size={18} strokeWidth={2.5} aria-hidden="true" /></span>
          <span>{t.quickIncome}</span>
        </button>
        <button id="btn-quick-transfer" type="button" onClick={() => onOpenAddModal('transfer')} className={buttonStyle}>
          <span className={`${iconStyle} bg-[#19ba83]`}><ArrowLeftRight size={18} strokeWidth={2.5} aria-hidden="true" /></span>
          <span>{t.quickTransfer}</span>
        </button>
        <button id="btn-quick-inquiry" type="button" onClick={onOpenSearchModal} className={buttonStyle}>
          <span className={`${iconStyle} bg-[#49c99a]`}><Search size={18} strokeWidth={2.5} aria-hidden="true" /></span>
          <span>{t.quickInquiry || (lang === 'ar' ? 'استعلام' : 'Inquiry')}</span>
        </button>
      </div>
    </div>
  );
}
