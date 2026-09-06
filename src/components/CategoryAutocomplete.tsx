import React, { useState, useRef, useEffect } from 'react';
import { Category, Language, TransactionType } from '../types';
import { Search, Plus, Check, ChevronDown, Tag } from 'lucide-react';

interface CategoryAutocompleteProps {
  categories: Category[];
  selectedCategoryId?: string;
  transactionType: TransactionType;
  lang: Language;
  onSelectCategory: (categoryId: string) => void;
  onAddNewCategory?: (newCategory: Category) => void;
}

export function CategoryAutocomplete({
  categories,
  selectedCategoryId,
  transactionType,
  lang,
  onSelectCategory,
  onAddNewCategory,
}: CategoryAutocompleteProps) {
  const isAr = lang === 'ar';
  const targetCategoryType = transactionType === 'income' ? 'income' : 'expense';
  
  // Filter categories matching the current transaction type
  const availableCategories = categories.filter((c) => c.type === targetCategoryType);
  const selectedCategory = availableCategories.find((c) => c.id === selectedCategoryId);

  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter categories based on search term (Excel-like exact, starts with, contains)
  const trimmedSearch = searchTerm.trim().toLowerCase();
  
  const filteredCategories = availableCategories.filter((cat) => {
    if (!trimmedSearch) return true;
    const nameAr = cat.nameAr.toLowerCase();
    const nameEn = cat.name.toLowerCase();
    return (
      nameAr.includes(trimmedSearch) ||
      nameEn.includes(trimmedSearch)
    );
  });

  // Check if search term exactly matches any existing category
  const hasExactMatch = availableCategories.some(
    (cat) =>
      cat.nameAr.toLowerCase() === trimmedSearch ||
      cat.name.toLowerCase() === trimmedSearch
  );

  const handleSelect = (catId: string) => {
    onSelectCategory(catId);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleCreateNewCategory = () => {
    if (!trimmedSearch) return;

    const newId = `cat_custom_${Date.now()}`;
    // Choose sensible icon and color
    const defaultColor = targetCategoryType === 'income' ? 'emerald' : 'indigo';
    const defaultIcon = targetCategoryType === 'income' ? 'TrendingUp' : 'Tag';

    const newCategory: Category = {
      id: newId,
      name: searchTerm.trim(),
      nameAr: searchTerm.trim(),
      icon: defaultIcon,
      type: targetCategoryType,
      color: defaultColor,
    };

    if (onAddNewCategory) {
      onAddNewCategory(newCategory);
    }
    onSelectCategory(newId);
    setIsOpen(false);
    setSearchTerm('');
  };

  const getCategoryDisplayName = (cat?: Category) => {
    if (!cat) return '';
    return isAr ? cat.nameAr : cat.name;
  };

  // Preset frequent categories for quick 1-tap pills
  const topCategories = availableCategories.slice(0, 5);

  return (
    <div ref={containerRef} className="space-y-1.5 relative">
      <label className="text-xs font-bold text-slate-700 block">
        {isAr ? 'التصنيف' : 'Category'}
      </label>

      {/* Main Selected Display Button / Search Trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            setIsOpen((prev) => !prev);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
          className="w-full flex items-center justify-between p-2.5 sm:p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 transition-colors cursor-pointer shadow-2xs"
        >
          {selectedCategory ? (
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-slate-100 flex items-center justify-center text-sm">
                {selectedCategory.nameAr.includes('مواصلات') || selectedCategory.name.toLowerCase().includes('transport')
                  ? '⛽'
                  : selectedCategory.nameAr.includes('طعام') || selectedCategory.name.toLowerCase().includes('food')
                  ? '🍔'
                  : selectedCategory.nameAr.includes('سوبر') || selectedCategory.name.toLowerCase().includes('grocery')
                  ? '🛒'
                  : selectedCategory.nameAr.includes('راتب') || selectedCategory.name.toLowerCase().includes('salary')
                  ? '💼'
                  : selectedCategory.nameAr.includes('قهوة') || selectedCategory.name.toLowerCase().includes('coffee')
                  ? '☕'
                  : '🏷️'}
              </span>
              <span>{getCategoryDisplayName(selectedCategory)}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-slate-400 font-medium">
              <Tag className="w-4 h-4 text-slate-400" />
              <span>{isAr ? 'اختر تصنيفاً أو ابحث...' : 'Select or search category...'}</span>
            </div>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Overlay with Live Autocomplete Search */}
        {isOpen && (
          <div className="absolute top-full left-0 right-0 z-40 mt-1 bg-white rounded-2xl border border-slate-200 shadow-xl p-2 space-y-2 animate-in fade-in duration-100">
            {/* Search Input Box */}
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-200/80 focus-within:border-emerald-500 focus-within:bg-white transition-all">
              <Search className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={isAr ? 'اكتب للبحث أو لإضافة تصنيف جديد...' : 'Type to search or add new category...'}
                className="w-full text-xs font-semibold text-slate-800 bg-transparent focus:outline-hidden placeholder:text-slate-400"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="text-slate-400 hover:text-slate-600 text-xs font-bold px-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* List of Filtered Categories */}
            <div className="max-h-48 overflow-y-auto space-y-1 pr-0.5">
              {filteredCategories.length > 0 ? (
                filteredCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelect(cat.id)}
                    className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                      cat.id === selectedCategoryId
                        ? 'bg-emerald-50 text-emerald-900 border border-emerald-200/60'
                        : 'hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm">
                        {cat.nameAr.includes('مواصلات')
                          ? '⛽'
                          : cat.nameAr.includes('طعام')
                          ? '🍔'
                          : cat.nameAr.includes('سوبر')
                          ? '🛒'
                          : cat.nameAr.includes('راتب')
                          ? '💼'
                          : cat.nameAr.includes('قهوة')
                          ? '☕'
                          : '🏷️'}
                      </span>
                      <span>{getCategoryDisplayName(cat)}</span>
                    </div>
                    {cat.id === selectedCategoryId && (
                      <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                    )}
                  </button>
                ))
              ) : (
                <div className="py-2 px-3 text-center text-xs text-slate-400 font-medium">
                  {isAr ? 'لا يوجد تصنيف مطابق' : 'No matching category found'}
                </div>
              )}

              {/* Option to create a new category if search text has no exact match */}
              {trimmedSearch.length > 0 && !hasExactMatch && (
                <button
                  type="button"
                  onClick={handleCreateNewCategory}
                  className="w-full flex items-center gap-2 p-2.5 rounded-xl text-xs font-bold bg-indigo-50/80 hover:bg-indigo-100 text-indigo-900 border border-indigo-200 transition-colors cursor-pointer mt-1"
                >
                  <div className="w-5 h-5 rounded-full bg-indigo-200/80 flex items-center justify-center text-indigo-700 shrink-0">
                    <Plus className="w-3.5 h-3.5 stroke-[3]" />
                  </div>
                  <div className="text-right truncate flex-1">
                    <span>{isAr ? '+ إنشاء تصنيف جديد: ' : '+ Create new category: '}</span>
                    <span className="underline font-black font-mono">"{searchTerm.trim()}"</span>
                  </div>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Quick 1-tap category chips below */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 no-scrollbar text-[11px]">
        {topCategories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelectCategory(cat.id)}
            className={`px-2.5 py-1 rounded-xl transition-all cursor-pointer whitespace-nowrap font-medium border ${
              cat.id === selectedCategoryId
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800 font-bold shadow-2xs'
                : 'bg-white border-slate-200/80 text-slate-600 hover:border-slate-300 hover:bg-slate-50'
            }`}
          >
            {getCategoryDisplayName(cat)}
          </button>
        ))}
      </div>
    </div>
  );
}
