import { ReactNode } from 'react';
import { Home, Calendar, Wallet, LayoutGrid, Settings } from 'lucide-react';
import { ActiveTab, Language } from '../types';
import { translations } from '../data/translations';

interface BottomNavProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  lang: Language;
}

export function BottomNav({ activeTab, onChangeTab, lang }: BottomNavProps) {
  const t = translations[lang];

  const navItems: { id: ActiveTab; label: string; icon: ReactNode }[] = [
    {
      id: 'home',
      label: t.navHome,
      icon: <Home className="w-5 h-5" />,
    },
    {
      id: 'transactions',
      label: t.navTransactions,
      icon: <Calendar className="w-5 h-5" />,
    },
    {
      id: 'accounts',
      label: t.navAccounts,
      icon: <Wallet className="w-5 h-5" />,
    },
    {
      id: 'categories',
      label: t.navCategories,
      icon: <LayoutGrid className="w-5 h-5" />,
    },
    {
      id: 'settings',
      label: t.navSettings,
      icon: <Settings className="w-5 h-5" />,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-100 py-1.5 px-3">
      <div className="max-w-md mx-auto flex items-center justify-between">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              id={`nav-item-${item.id}`}
              type="button"
              onClick={() => onChangeTab(item.id)}
              className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition-all cursor-pointer ${
                isActive
                  ? 'text-emerald-700 font-bold'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <div
                className={`p-1.5 rounded-2xl transition-colors ${
                  isActive ? 'bg-emerald-50 text-emerald-600' : 'text-slate-400'
                }`}
              >
                {item.icon}
              </div>
              <span className="text-[10px] mt-0.5 tracking-tight font-bold">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
