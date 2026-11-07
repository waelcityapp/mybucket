import { ReactNode } from 'react';
import { Home, Calendar, Wallet, LayoutGrid, Settings, Search } from 'lucide-react';
import { ActiveTab, Language } from '../types';
import { translations } from '../data/translations';

interface BottomNavProps {
  activeTab: ActiveTab;
  onChangeTab: (tab: ActiveTab) => void;
  lang: Language;
}

export function BottomNav({ activeTab, onChangeTab, lang }: BottomNavProps) {
  const t = translations[lang];

  const navItems: { id: ActiveTab; label: string; icon: ReactNode; centerPrimary?: boolean }[] = [
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
      id: 'search',
      label: t.navSearch,
      icon: <Search className="w-6 h-6" />,
      centerPrimary: true
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
    <nav className="fixed inset-x-0 bottom-0 z-30 bg-white/95 backdrop-blur-md border-t border-slate-100 pt-1.5 px-3 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="max-w-md mx-auto flex items-end justify-between relative">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          
          if (item.centerPrimary) {
            return (
              <button
                key={item.id}
                id={`nav-item-${item.id}`}
                type="button"
                onClick={() => onChangeTab(item.id)}
                className="flex flex-col items-center justify-center flex-1 cursor-pointer group relative -mt-5"
              >
                <div className="bg-white p-1.5 rounded-full shadow-sm border border-slate-100 mb-1">
                  <div
                    className={`p-3 rounded-full transition-all duration-300 ${
                      isActive 
                        ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/30 scale-110' 
                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                    }`}
                  >
                    {item.icon}
                  </div>
                </div>
                <span className={`text-[10px]  font-bold transition-colors ${isActive ? 'text-emerald-600' : 'text-slate-500'}`}>
                  {item.label}
                </span>
                {isActive && <div className="absolute -bottom-1.5 w-8 h-1 bg-emerald-600 rounded-t-md" />}
              </button>
            );
          }

          return (
            <button
              key={item.id}
              id={`nav-item-${item.id}`}
              type="button"
              onClick={() => onChangeTab(item.id)}
              className={`flex flex-col items-center justify-center py-2 px-1 flex-1 transition-all cursor-pointer relative ${
                isActive
                  ? 'text-emerald-600 font-bold'
                  : 'text-slate-400 hover:text-slate-600 font-medium'
              }`}
            >
              <div
                className={`mb-1 transition-transform ${
                  isActive ? 'scale-110' : ''
                }`}
              >
                {item.icon}
              </div>
              <span className="text-[10px]  font-bold">
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
