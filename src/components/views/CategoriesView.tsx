import { Coffee, Briefcase, ShoppingCart, Receipt, ShoppingBag, HeartPulse, Coins, TrendingUp, MoreHorizontal, Car } from 'lucide-react';
import { Category, Transaction, Language } from '../../types';
import { translations } from '../../data/translations';

interface CategoriesViewProps {
  categories: Category[];
  transactions: Transaction[];
  lang: Language;
}

export function CategoriesView({ categories, transactions, lang }: CategoriesViewProps) {
  const t = translations[lang];

  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const incomeCategories = categories.filter((c) => c.type === 'income');

  const getCategoryIcon = (iconName: string) => {
    switch (iconName) {
      case 'Coffee':
        return <Coffee className="w-5 h-5" />;
      case 'Briefcase':
        return <Briefcase className="w-5 h-5" />;
      case 'ShoppingCart':
        return <ShoppingCart className="w-5 h-5" />;
      case 'Receipt':
        return <Receipt className="w-5 h-5" />;
      case 'ShoppingBag':
        return <ShoppingBag className="w-5 h-5" />;
      case 'HeartPulse':
        return <HeartPulse className="w-5 h-5" />;
      case 'Coins':
        return <Coins className="w-5 h-5" />;
      case 'TrendingUp':
        return <TrendingUp className="w-5 h-5" />;
      case 'Car':
        return <Car className="w-5 h-5" />;
      default:
        return <MoreHorizontal className="w-5 h-5" />;
    }
  };

  const getCategoryTotal = (catId: string) => {
    return transactions
      .filter((tx) => tx.categoryId === catId)
      .reduce((sum, tx) => sum + tx.amount, 0);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-US', {
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
          {t.categoriesTitle}
        </h1>
        <p className="text-xs text-slate-500">
          {lang === 'ar' ? 'تصنيف مصاريفك ودخلك لتنظيم ميزانيتك تلقائياً' : 'Organize your spending and income automatically'}
        </p>
      </div>

      {/* Expense Categories */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
          <span>{t.expenseCategories}</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {expenseCategories.map((cat) => {
            const total = getCategoryTotal(cat.id);
            return (
              <div
                key={cat.id}
                className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs flex flex-col justify-between"
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                    style={{ backgroundColor: cat.color }}
                  >
                    {getCategoryIcon(cat.icon)}
                  </div>
                  <span className="text-xs font-bold text-slate-800 truncate">
                    {lang === 'ar' ? cat.nameAr : cat.name}
                  </span>
                </div>
                <div className="text-xs font-bold text-slate-500">
                  <span>{formatNumber(total)}</span>
                  <span className="text-[10px] font-normal text-slate-400"> EGP</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Income Categories */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
          <span>{t.incomeCategories}</span>
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {incomeCategories.map((cat) => {
            const total = getCategoryTotal(cat.id);
            return (
              <div
                key={cat.id}
                className="bg-white border border-slate-200/80 rounded-2xl p-3.5 shadow-2xs flex flex-col justify-between"
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-white"
                    style={{ backgroundColor: cat.color }}
                  >
                    {getCategoryIcon(cat.icon)}
                  </div>
                  <span className="text-xs font-bold text-slate-800 truncate">
                    {lang === 'ar' ? cat.nameAr : cat.name}
                  </span>
                </div>
                <div className="text-xs font-bold text-emerald-600">
                  <span>{formatNumber(total)}</span>
                  <span className="text-[10px] font-normal text-emerald-500"> EGP</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
