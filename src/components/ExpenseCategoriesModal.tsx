import React, { useState, useEffect } from 'react';
import {
  X,
  Plus,
  Pencil,
  Trash2,
  Check,
  Tag,
  Search,
  Sparkles,
  AlertCircle,
  FolderPlus,
  RefreshCw,
} from 'lucide-react';
import { Category, Language } from '../types';
import { translations } from '../data/translations';
import { aiLearnedMemory } from '../services/ai/aiLearnedMemory';

interface ExpenseCategoriesModalProps {
  isOpen: boolean;
  categories: Category[];
  lang: Language;
  onClose: () => void;
  onUpdateCategories: (updatedCategories: Category[]) => void;
}

// Default base IDs that came with the app initially
const DEFAULT_EXPENSE_CAT_IDS = new Set([
  'cat_food',
  'cat_groceries',
  'cat_transport',
  'cat_bills',
  'cat_shopping',
  'cat_health',
]);

const MAX_ADDITIONAL_CATEGORIES = 10;

// Curated Emojis for quick and distinct spending item customization
const AVAILABLE_EMOJIS = [
  '🍔', '🛒', '🚗', '🧾', '🛍️', '💊', '📚', '🍿', '🔧', '🎁',
  '🎮', '🤲', '✈️', '💻', '🐾', '📺', '💡', '⚽', '🏠', '☕',
  '💈', '👶', '🏋️', '🎨', '👔', '🚕', '🍕', '🩺', '🎟️', '📦'
];

// Curated Palette of Modern Colors
const AVAILABLE_COLORS = [
  '#f97316', // Orange
  '#06b6d4', // Cyan
  '#6366f1', // Indigo
  '#ef4444', // Red / Rose
  '#ec4899', // Pink
  '#14b8a6', // Teal
  '#10b981', // Emerald
  '#3b82f6', // Blue
  '#8b5cf6', // Purple
  '#f59e0b', // Amber
  '#64748b', // Slate
  '#84cc16', // Lime
];

// Quick suggestion templates for rapid 1-click additions
const QUICK_SUGGESTIONS = [
  { nameAr: 'دروس وتعليم', name: 'Education & Courses', emoji: '📚', color: '#6366f1' },
  { nameAr: 'ترفيه وخروجات', name: 'Entertainment & Outings', emoji: '🍿', color: '#f59e0b' },
  { nameAr: 'صيانة وتصليحات', name: 'Maintenance & Repairs', emoji: '🔧', color: '#64748b' },
  { nameAr: 'هدايا ومناسبات', name: 'Gifts & Occasions', emoji: '🎁', color: '#ec4899' },
  { nameAr: 'ألعاب وهوايات', name: 'Games & Hobbies', emoji: '🎮', color: '#8b5cf6' },
  { nameAr: 'صدقات وتبرعات', name: 'Charity & Donations', emoji: '🤲', color: '#10b981' },
  { nameAr: 'سفر ورحلات', name: 'Travel & Trips', emoji: '✈️', color: '#06b6d4', },
  { nameAr: 'أجهزة وإلكترونيات', name: 'Gadgets & Tech', emoji: '💻', color: '#3b82f6' },
  { nameAr: 'حيوانات أليفة', name: 'Pets & Vet', emoji: '🐾', color: '#f97316' },
  { nameAr: 'اشتراكات وخدمات', name: 'Subscriptions & Streaming', emoji: '📺', color: '#ef4444' },
];

export function ExpenseCategoriesModal({
  isOpen,
  categories,
  lang,
  onClose,
  onUpdateCategories,
}: ExpenseCategoriesModalProps) {
  const t = translations[lang];

  const [searchQuery, setSearchQuery] = useState('');
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isAddingNew, setIsAddingNew] = useState(false);

  // Add / Edit Form State
  const [formNameAr, setFormNameAr] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [formEmoji, setFormEmoji] = useState('📦');
  const [formColor, setFormColor] = useState('#6366f1');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter only expense categories
  const expenseCategories = categories.filter((c) => c.type === 'expense');
  const additionalCategories = expenseCategories.filter((c) => !DEFAULT_EXPENSE_CAT_IDS.has(c.id));
  const additionalCount = additionalCategories.length;
  const canAddMore = additionalCount < MAX_ADDITIONAL_CATEGORIES;

  useEffect(() => {
    if (!isOpen) {
      setEditingCategory(null);
      setIsAddingNew(false);
      setSearchQuery('');
      setErrorMessage(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Open Edit Mode for an existing category
  const handleStartEdit = (cat: Category) => {
    setEditingCategory(cat);
    setIsAddingNew(false);
    setFormNameAr(cat.nameAr || cat.name);
    setFormNameEn(cat.name || cat.nameAr);
    setFormEmoji(cat.icon && cat.icon.length <= 4 ? cat.icon : '🏷️');
    setFormColor(cat.color || '#6366f1');
    setErrorMessage(null);
  };

  // Open Add Mode
  const handleStartAdd = () => {
    if (!canAddMore) {
      setErrorMessage(
        lang === 'ar'
          ? `عفواً، لقد وصلت للحد الأقصى المسموح (${MAX_ADDITIONAL_CATEGORIES} بنود إضافية). يمكنك تعديل بند حالي أو حذف بند لإضافة غيره.`
          : `Maximum limit reached (${MAX_ADDITIONAL_CATEGORIES} additional items). Please edit or remove an existing item.`
      );
      return;
    }
    setEditingCategory(null);
    setIsAddingNew(true);
    setFormNameAr('');
    setFormNameEn('');
    setFormEmoji('📦');
    setFormColor(AVAILABLE_COLORS[Math.floor(Math.random() * AVAILABLE_COLORS.length)]);
    setErrorMessage(null);
  };

  // Quick fill from suggestions
  const handleSelectQuickSuggestion = (item: typeof QUICK_SUGGESTIONS[0]) => {
    setFormNameAr(item.nameAr);
    setFormNameEn(item.name);
    setFormEmoji(item.emoji);
    setFormColor(item.color);
    setErrorMessage(null);
  };

  // Save Add or Edit
  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanAr = formNameAr.trim();
    if (!cleanAr) {
      setErrorMessage(lang === 'ar' ? 'يرجى كتابة اسم البند' : 'Please enter item name');
      return;
    }

    const cleanEn = formNameEn.trim() || cleanAr;

    if (editingCategory) {
      // Update existing category
      const updatedList = categories.map((cat) => {
        if (cat.id === editingCategory.id) {
          return {
            ...cat,
            nameAr: cleanAr,
            name: cleanEn,
            icon: formEmoji,
            color: formColor,
          };
        }
        return cat;
      });

      onUpdateCategories(updatedList);

      // Teach AI Memory the new category name
      aiLearnedMemory.recordLearning(cleanAr, {
        categoryId: editingCategory.id,
        categoryNameAr: cleanAr,
        type: 'expense',
      });

      setEditingCategory(null);
    } else if (isAddingNew) {
      if (!canAddMore) {
        setErrorMessage(
          lang === 'ar'
            ? `لقد وصلت للحد الأقصى (${MAX_ADDITIONAL_CATEGORIES} بنود إضافية).`
            : `Maximum limit (${MAX_ADDITIONAL_CATEGORIES}) reached.`
        );
        return;
      }

      // Create new custom expense category
      const newId = `cat_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newCategory: Category = {
        id: newId,
        name: cleanEn,
        nameAr: cleanAr,
        icon: formEmoji,
        type: 'expense',
        color: formColor,
      };

      const updatedList = [...categories, newCategory];
      onUpdateCategories(updatedList);

      // Register with AI Memory immediately
      aiLearnedMemory.recordLearning(cleanAr, {
        categoryId: newId,
        categoryNameAr: cleanAr,
        type: 'expense',
      });

      setIsAddingNew(false);
    }

    setErrorMessage(null);
  };

  // Delete an additional custom category
  const handleDeleteCategory = (catId: string) => {
    if (DEFAULT_EXPENSE_CAT_IDS.has(catId)) {
      if (
        !window.confirm(
          lang === 'ar'
            ? 'هذا بند أساسي. هل تريد حذفه من قائمتك؟'
            : 'This is a default category. Are you sure you want to remove it?'
        )
      ) {
        return;
      }
    } else {
      if (
        !window.confirm(
          lang === 'ar'
            ? 'هل أنت متأكد من حذف هذا البند من بنود الصرف؟'
            : 'Are you sure you want to delete this spending category?'
        )
      ) {
        return;
      }
    }

    const updatedList = categories.filter((c) => c.id !== catId);
    onUpdateCategories(updatedList);
    if (editingCategory?.id === catId) {
      setEditingCategory(null);
    }
  };

  // Filter categories by search
  const filteredExpenseCategories = expenseCategories.filter((cat) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (cat.nameAr && cat.nameAr.toLowerCase().includes(q)) ||
      (cat.name && cat.name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white rounded-3xl max-w-xl w-full shadow-2xl border border-slate-100 overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-100/80 flex items-center justify-center text-rose-600 shadow-2xs text-xl">
              🏷️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black text-slate-900 leading-tight">
                  {lang === 'ar' ? 'بنود الصرف' : 'Spending Categories'}
                </h2>
                <span className="text-[11px] font-bold bg-rose-100 text-rose-800 px-2 py-0.5 rounded-full">
                  {expenseCategories.length} {lang === 'ar' ? 'بند' : 'Items'}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                {lang === 'ar'
                  ? 'عرض وتعديل بنود الصرف وإضافة حتى 10 بنود إضافية'
                  : 'Manage spending items & add up to 10 custom items'}
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

        {/* Counter & Quota Bar: "البنود الإضافية: X / 10" */}
        <div className="px-4 sm:px-5 py-3 bg-slate-50/80 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700">
              {lang === 'ar' ? 'البنود الإضافية المضافة:' : 'Additional Items:'}
            </span>
            <span
              className={`font-black px-2 py-0.5 rounded-md text-xs ${
                additionalCount >= MAX_ADDITIONAL_CATEGORIES
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-indigo-100 text-indigo-800'
              }`}
            >
              {additionalCount} / {MAX_ADDITIONAL_CATEGORIES}
            </span>
            {additionalCount >= MAX_ADDITIONAL_CATEGORIES && (
              <span className="text-[11px] text-amber-700 font-medium">
                ({lang === 'ar' ? 'تم الوصول للحد الأقصى' : 'Max limit reached'})
              </span>
            )}
          </div>

          {/* Quick Add Button in Quota Bar */}
          {!isAddingNew && !editingCategory && (
            <button
              type="button"
              onClick={handleStartAdd}
              disabled={!canAddMore}
              className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-xs transition-all cursor-pointer ${
                canAddMore
                  ? 'bg-slate-900 hover:bg-slate-800 text-white active:scale-95'
                  : 'bg-slate-200 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>{lang === 'ar' ? 'إضافة بند صرف جديد' : 'Add Spending Item'}</span>
            </button>
          )}
        </div>

        {/* Scrollable Content Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
          {/* Error Message */}
          {errorMessage && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-3 rounded-2xl text-xs flex items-center gap-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ADD / EDIT FORM PANEL */}
          {(isAddingNew || editingCategory) && (
            <form
              onSubmit={handleSaveForm}
              className="bg-slate-50/90 border-2 border-indigo-200/80 rounded-3xl p-4 sm:p-5 space-y-4 shadow-sm animate-in slide-in-from-top-2 duration-200"
            >
              <div className="flex items-center justify-between border-b border-slate-200/60 pb-3">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded-xl flex items-center justify-center text-base text-white shadow-xs"
                    style={{ backgroundColor: formColor }}
                  >
                    {formEmoji}
                  </div>
                  <h3 className="text-sm font-black text-slate-900">
                    {editingCategory
                      ? lang === 'ar'
                        ? 'تعديل بند الصرف'
                        : 'Edit Spending Category'
                      : lang === 'ar'
                      ? 'إضافة بند صرف جديد'
                      : 'Add New Spending Category'}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNew(false);
                    setEditingCategory(null);
                    setErrorMessage(null);
                  }}
                  className="text-xs font-bold text-slate-500 hover:text-slate-800"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
              </div>

              {/* Quick Suggestion Chips (when adding new) */}
              {isAddingNew && (
                <div className="space-y-1.5">
                  <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    {lang === 'ar' ? 'اقتراحات سريعة بنقرة واحدة:' : 'Quick suggestions (1-click):'}
                  </span>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-white rounded-2xl border border-slate-200/70">
                    {QUICK_SUGGESTIONS.map((item, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelectQuickSuggestion(item)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold bg-slate-50 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200 border border-slate-200/80 px-2 py-1 rounded-xl transition-colors cursor-pointer"
                      >
                        <span>{item.emoji}</span>
                        <span>{item.nameAr}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Input: Category Name in Arabic */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-slate-700">
                  {lang === 'ar' ? 'اسم البند (بالعربية)' : 'Item Name (Arabic)'} *
                </label>
                <input
                  type="text"
                  required
                  value={formNameAr}
                  onChange={(e) => setFormNameAr(e.target.value)}
                  placeholder={lang === 'ar' ? 'مثال: دروس خصوصية، ترفيه، صيانة...' : 'e.g., Courses, Outings...'}
                  className="w-full bg-white border border-slate-300 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-2xl px-3.5 py-2.5 text-xs sm:text-sm font-bold text-slate-900 outline-hidden transition-all"
                  dir="auto"
                />
              </div>

              {/* Emoji Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  {lang === 'ar' ? 'أيقونة البند (اختر رمز تعبيري):' : 'Item Icon / Emoji:'}
                </label>
                <div className="grid grid-cols-10 gap-1.5 p-2 bg-white rounded-2xl border border-slate-200/80 max-h-28 overflow-y-auto">
                  {AVAILABLE_EMOJIS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setFormEmoji(emoji)}
                      className={`h-8 w-full rounded-xl flex items-center justify-center text-base transition-transform cursor-pointer ${
                        formEmoji === emoji
                          ? 'bg-indigo-100 ring-2 ring-indigo-500 scale-110'
                          : 'hover:bg-slate-100'
                      }`}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Selector */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  {lang === 'ar' ? 'لون تمييز البند:' : 'Highlight Color:'}
                </label>
                <div className="flex flex-wrap gap-2 p-2 bg-white rounded-2xl border border-slate-200/80">
                  {AVAILABLE_COLORS.map((col) => (
                    <button
                      key={col}
                      type="button"
                      onClick={() => setFormColor(col)}
                      style={{ backgroundColor: col }}
                      className={`w-7 h-7 rounded-full transition-transform cursor-pointer flex items-center justify-center text-white ${
                        formColor === col ? 'ring-3 ring-offset-2 ring-indigo-600 scale-110' : 'hover:scale-105 opacity-90'
                      }`}
                    >
                      {formColor === col && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNew(false);
                    setEditingCategory(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  {lang === 'ar' ? 'إلغاء' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black shadow-sm transition-transform active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5 stroke-[3]" />
                  <span>{editingCategory ? (lang === 'ar' ? 'حفظ التعديل' : 'Save Changes') : (lang === 'ar' ? 'إضافة البند' : 'Add Item')}</span>
                </button>
              </div>
            </form>
          )}

          {/* Search bar & Category List Header */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                <Tag className="w-3.5 h-3.5 text-slate-500" />
                <span>{lang === 'ar' ? 'قائمة بنود الصرف الحالية' : 'Current Spending Items List'}</span>
                <span className="text-slate-400 font-medium">({filteredExpenseCategories.length})</span>
              </h3>

              {/* Search Box */}
              {expenseCategories.length > 5 && (
                <div className="relative w-36 sm:w-48">
                  <Search className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder={lang === 'ar' ? 'بحث في البنود...' : 'Search items...'}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pr-7 pl-2 py-1 text-[11px] font-medium outline-hidden focus:border-indigo-400 focus:bg-white transition-all"
                  />
                </div>
              )}
            </div>

            {/* Categories Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {filteredExpenseCategories.map((cat) => {
                const isDefault = DEFAULT_EXPENSE_CAT_IDS.has(cat.id);
                const isCustom = !isDefault;

                return (
                  <div
                    key={cat.id}
                    className="bg-white border border-slate-200/80 hover:border-slate-300 rounded-2xl p-3 flex items-center justify-between gap-2 shadow-2xs hover:shadow-xs transition-all group"
                  >
                    {/* Item Avatar & Name */}
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className="w-9 h-9 rounded-2xl flex items-center justify-center text-white text-base font-bold shadow-2xs shrink-0"
                        style={{ backgroundColor: cat.color || '#6366f1' }}
                      >
                        {cat.icon && cat.icon.length <= 4 ? cat.icon : '🏷️'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-bold text-slate-900 truncate block">
                            {lang === 'ar' ? cat.nameAr : cat.name}
                          </span>
                          {isCustom && (
                            <span className="text-[9px] font-extrabold bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.2 rounded-md shrink-0">
                              {lang === 'ar' ? 'إضافي' : 'Custom'}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-slate-400 block truncate">
                          {cat.name !== cat.nameAr ? cat.name : 'بند صرف'}
                        </span>
                      </div>
                    </div>

                    {/* Action Buttons: Edit & Delete */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleStartEdit(cat)}
                        title={lang === 'ar' ? 'تعديل البند' : 'Edit Item'}
                        className="w-7 h-7 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-600 hover:text-indigo-600 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(cat.id)}
                        title={lang === 'ar' ? 'حذف البند' : 'Delete Item'}
                        className="w-7 h-7 rounded-xl bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredExpenseCategories.length === 0 && (
              <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-xs text-slate-500 font-medium">
                  {lang === 'ar' ? 'لا توجد بنود تطابق البحث' : 'No categories match your search'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-medium">
            {lang === 'ar'
              ? 'تنعكس التعديلات والإضافات فورياً في التسجيل الصوتي والذكي واليدوي'
              : 'Changes apply instantly to voice, AI & manual transactions'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-transform active:scale-95 cursor-pointer shadow-xs"
          >
            {lang === 'ar' ? 'إغلاق' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  );
}
