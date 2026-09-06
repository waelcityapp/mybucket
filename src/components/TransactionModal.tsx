import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  ArrowDown,
  ArrowUpRight,
  ArrowLeftRight,
  Calendar as CalendarIcon,
  Clock,
  Check,
  ChevronDown,
  AlertTriangle,
  Sparkles,
  ArrowRightLeft,
  Mic,
  MicOff,
  Send,
  Loader2,
  CheckCircle2,
  Volume2,
} from 'lucide-react';
import {
  FinancialAccount,
  Category,
  Transaction,
  TransactionType,
  Language,
  CurrencyCode,
} from '../types';
import { translations } from '../data/translations';
import {
  getCurrentLocalDate,
  getCurrentLocalTime,
  toDateTimeISO,
  formatDateTimeDisplay,
} from '../utils/dateTime';
import { CategoryAutocomplete } from './CategoryAutocomplete';
import { aiClient } from '../services/ai/aiClient';
import {
  matchCategoryFromText,
  matchAccountFromText,
  matchDescriptionEdit,
  matchAmountEdit,
  matchTransactionType,
  matchTransferAccountsFromText,
} from '../utils/entityMatcher';

interface TransactionModalProps {
  isOpen: boolean;
  initialType?: TransactionType;
  initialValues?: Partial<Transaction> | null;
  missingFields?: string[];
  accounts: FinancialAccount[];
  categories: Category[];
  lang: Language;
  onClose: () => void;
  onSaveTransaction: (tx: Omit<Transaction, 'id' | 'createdAt'>) => void;
  onAddCategory?: (category: Category) => void;
}

export function TransactionModal({
  isOpen,
  initialType = 'expense',
  initialValues,
  missingFields = [],
  accounts,
  categories,
  lang,
  onClose,
  onSaveTransaction,
  onAddCategory,
}: TransactionModalProps) {
  const t = translations[lang];
  const isAr = lang === 'ar';

  // Form Fields State (Shared Draft Model for both manual & AI)
  const [type, setType] = useState<TransactionType>(initialType);
  const [amount, setAmount] = useState<string>('');
  const [currency, setCurrency] = useState<CurrencyCode>('EGP');
  const [accountId, setAccountId] = useState<string>('');
  const [toAccountId, setToAccountId] = useState<string>('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [description, setDescription] = useState<string>('');

  // Date and Time Fields
  const [date, setDate] = useState<string>(getCurrentLocalDate());
  const [time, setTime] = useState<string>(getCurrentLocalTime());
  const [showDateTimeEditor, setShowDateTimeEditor] = useState<boolean>(false);

  // Dropdown UI states
  const [showAccountDropdown, setShowAccountDropdown] = useState<boolean>(false);
  const [showToAccountDropdown, setShowToAccountDropdown] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [isAiProposal, setIsAiProposal] = useState<boolean>(false);

  // Voice & AI Edit within Modal States
  const [voiceInputText, setVoiceInputText] = useState<string>('');
  const [isVoiceListening, setIsVoiceListening] = useState<boolean>(false);
  const [isProcessingVoiceEdit, setIsProcessingVoiceEdit] = useState<boolean>(false);
  const [aiVoiceNotice, setAiVoiceNotice] = useState<string | null>(null);
  const [aiVoiceNoticeType, setAiVoiceNoticeType] = useState<'save_warning' | 'success' | 'info' | null>(null);
  const [highlightSaveBtn, setHighlightSaveBtn] = useState<boolean>(false);
  const [fieldUpdated, setFieldUpdated] = useState<string | null>(null);

  const saveButtonRef = useRef<HTMLButtonElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const voiceInputRef = useRef<HTMLInputElement | null>(null);

  // Synchronize on modal open or when initialValues change
  useEffect(() => {
    if (isOpen) {
      if (initialValues) {
        setIsAiProposal(true);
        if (initialValues.type) setType(initialValues.type);
        if (initialValues.amount !== undefined && initialValues.amount !== null) {
          setAmount(String(initialValues.amount));
        } else {
          setAmount('');
        }
        if (initialValues.currency) setCurrency(initialValues.currency);

        // Strict Account Handling: Do NOT guess account if missing!
        if (initialValues.accountId) {
          setAccountId(initialValues.accountId);
        } else {
          setAccountId('');
        }

        if (initialValues.toAccountId) {
          setToAccountId(initialValues.toAccountId);
        } else {
          setToAccountId('');
        }

        if (initialValues.categoryId) {
          setCategoryId(initialValues.categoryId);
        } else {
          // If no category passed, auto-select first category matching the type
          const matched = categories.find((c) => c.type === (initialValues.type === 'income' ? 'income' : 'expense'));
          setCategoryId(matched?.id || '');
        }

        if (initialValues.description) {
          setDescription(initialValues.description);
        } else {
          setDescription('');
        }

        if (initialValues.date) setDate(initialValues.date);
        if (initialValues.time) setTime(initialValues.time);
      } else {
        // Manual entry initialization
        setIsAiProposal(false);
        setType(initialType);
        setAmount('');
        setDescription('');
        setDate(getCurrentLocalDate());
        setTime(getCurrentLocalTime());
        
        if (accounts.length > 0) {
          setAccountId(accounts[0].id);
          setCurrency(accounts[0].currency);
        } else {
          setAccountId('');
        }

        if (accounts.length > 1) {
          setToAccountId(accounts[1].id);
        } else {
          setToAccountId('');
        }

        const defaultCat = categories.find((c) => c.type === (initialType === 'income' ? 'income' : 'expense'));
        setCategoryId(defaultCat?.id || '');
      }

      setError('');
      setShowDateTimeEditor(false);
      setShowAccountDropdown(false);
      setShowToAccountDropdown(false);
    }
  }, [isOpen, initialType, initialValues, accounts, categories]);

  if (!isOpen) return null;

  const selectedAccount = accounts.find((a) => a.id === accountId);
  const selectedToAccount = accounts.find((a) => a.id === toAccountId);
  const selectedCategory = categories.find((c) => c.id === categoryId);

  const parsedAmount = parseFloat(amount);

  // Type switch handler - also updates default category for that type
  const handleTypeChange = (newType: TransactionType) => {
    setType(newType);
    setError('');
    if (newType !== 'transfer') {
      const matchCat = categories.find((c) => c.type === (newType === 'income' ? 'income' : 'expense'));
      if (matchCat) {
        setCategoryId(matchCat.id);
      }
    } else {
      // Transfer: Ensure destination account is set and distinct from source account
      if (!toAccountId || toAccountId === accountId) {
        const otherAcc = accounts.find((a) => a.id !== accountId);
        if (otherAcc) {
          setToAccountId(otherAcc.id);
        }
      }
    }
  };

  // Swap Source and Destination Accounts in Transfer
  const handleSwapTransferAccounts = () => {
    const temp = accountId;
    setAccountId(toAccountId);
    setToAccountId(temp);
  };

  // Stop Speech Recognition
  const stopListening = () => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) {
        console.warn('Error stopping speech recognition in modal:', e);
      }
      recognitionRef.current = null;
    }
    setIsVoiceListening(false);
  };

  // Start Speech Recognition with Arabic ar-EG or English
  const startListening = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setAiVoiceNotice(
        isAr
          ? 'المتصفح لا يدعم التسجيل الصوتي المباشر، يمكنك كتابة التعديل في الخانة.'
          : 'Speech recognition is not supported in this browser. You can type instead.'
      );
      setAiVoiceNoticeType('info');
      voiceInputRef.current?.focus();
      return;
    }

    try {
      stopListening();
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = isAr ? 'ar-EG' : 'en-US';

      recognition.onstart = () => {
        setIsVoiceListening(true);
        setAiVoiceNotice(null);
      };

      recognition.onresult = (event: any) => {
        let transcript = '';
        for (let i = 0; i < event.results.length; i++) {
          transcript += event.results[i][0].transcript;
        }
        setVoiceInputText(transcript);
      };

      recognition.onerror = (err: any) => {
        console.warn('Speech recognition error in modal:', err);
        setIsVoiceListening(false);
      };

      recognition.onend = () => {
        setIsVoiceListening(false);
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (e) {
      console.error('Failed to start speech recognition in modal:', e);
      setIsVoiceListening(false);
    }
  };

  // Text-to-Speech audio response (e.g. for "من فضلك اضغط على زر تأكيد وحفظ")
  const speakFeedback = (msg: string) => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(msg);
        utterance.lang = isAr ? 'ar-SA' : 'en-US';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('SpeechSynthesis error:', e);
      }
    }
  };

  // Process Voice/Text Edit with Gemini AI
  const handleProcessVoiceEdit = async (explicitText?: string) => {
    const text = (explicitText !== undefined ? explicitText : voiceInputText).trim();
    if (!text) return;

    stopListening();
    setIsProcessingVoiceEdit(true);
    setAiVoiceNotice(null);
    setHighlightSaveBtn(false);

    // CRITICAL DIRECTIVE:
    // If the customer asks to save or confirm the transaction by voice (e.g. "احفظ العملية", "سجلها", "تأكيد", "save", etc.):
    // The assistant MUST NOT save automatically, but tell the user: "من فضلك اضغط على زر تأكيد وحفظ"
    const isSaveIntent = /احفظ|سجل|أكد|اكد|تمام احفظ|تأكيد|حفظ العملية|احفظها|سجلها|اعتمد|اعتمدها|save|confirm/i.test(text);

    if (isSaveIntent) {
      setIsProcessingVoiceEdit(false);
      setVoiceInputText('');
      const warningMsg = isAr ? 'من فضلك اضغط على زر تأكيد وحفظ' : 'Please click on the Confirm & Save button';
      setAiVoiceNotice(warningMsg);
      setAiVoiceNoticeType('save_warning');
      setHighlightSaveBtn(true);
      speakFeedback(warningMsg);

      setTimeout(() => {
        saveButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 100);
      return;
    }

    try {
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Cairo';
      const now = new Date();
      const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString();

      const result = await aiClient.interpret({
        text,
        accounts: accounts.map((a) => ({
          id: a.id,
          name: a.name,
          nameAr: a.nameAr,
          type: a.type,
          currency: a.currency,
        })),
        categories: categories.map((c) => ({
          id: c.id,
          name: c.name,
          nameAr: c.nameAr,
          type: c.type,
        })),
        currentDateTime: localISO,
        userTimezone,
        lang,
        currentProposal: {
          type,
          amount: parseFloat(amount) || null,
          currency,
          accountId: accountId || null,
          toAccountId: toAccountId || null,
          categoryId: categoryId || null,
          description: description || null,
          date,
          time,
        },
      });

      if (result.intent === 'SAVE_REQUEST') {
        const warningMsg = isAr ? 'من فضلك اضغط على زر تأكيد وحفظ' : 'Please click on the Confirm & Save button';
        setAiVoiceNotice(warningMsg);
        setAiVoiceNoticeType('save_warning');
        setHighlightSaveBtn(true);
        speakFeedback(warningMsg);
        setVoiceInputText('');
        setTimeout(() => {
          saveButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 100);
        return;
      }

      const changesSummary: string[] = [];

      if (result.transaction) {
        const t = result.transaction;

        // 1. Transaction Type (مصروف، دخل، تحويل)
        let resolvedType: TransactionType | null =
          (t.type as TransactionType) ||
          (result.correction?.fieldToUpdate === 'type' ? (result.correction.newValue as TransactionType) : null);
        if (!resolvedType) {
          const matched = matchTransactionType(text);
          if (matched) resolvedType = matched;
        }

        if (resolvedType && resolvedType !== type) {
          setType(resolvedType);
          setFieldUpdated('type');
          changesSummary.push(
            isAr
              ? `النوع: ${resolvedType === 'expense' ? 'مصروف' : resolvedType === 'income' ? 'دخل' : 'تحويل'}`
              : `Type: ${resolvedType}`
          );
        }

        // 2. Amount
        if (typeof t.amount === 'number' && t.amount > 0) {
          setAmount(String(t.amount));
          setFieldUpdated('amount');
          changesSummary.push(isAr ? `المبلغ: ${t.amount}` : `Amount: ${t.amount}`);
        }

        // 3. Description / Notes
        if (t.description !== null && t.description !== undefined && t.description !== description) {
          setDescription(t.description);
          setFieldUpdated('description');
          changesSummary.push(isAr ? `الملاحظات: "${t.description}"` : `Note: "${t.description}"`);
        }

        // 4. Source Account
        let resolvedAccountId = t.accountId || (result.correction?.fieldToUpdate === 'accountId' ? result.correction.newValue : null);
        if (!resolvedAccountId) {
          const matchedAcc = matchAccountFromText(text, accounts);
          if (matchedAcc) resolvedAccountId = matchedAcc.id;
        }

        if (resolvedAccountId) {
          const acc = accounts.find((a) => a.id === resolvedAccountId);
          if (acc) {
            setAccountId(acc.id);
            setCurrency(acc.currency);
            setFieldUpdated('accountId');
            changesSummary.push(isAr ? `الحساب: ${acc.nameAr}` : `Account: ${acc.name}`);
          }
        }

        // 5. Destination Account for Transfers
        let resolvedToAccountId = t.toAccountId;
        const currentActiveType = resolvedType || type;
        if (currentActiveType === 'transfer') {
          if (!resolvedToAccountId) {
            const transferAccs = matchTransferAccountsFromText(text, accounts, resolvedAccountId || accountId);
            if (transferAccs.toAccount) {
              resolvedToAccountId = transferAccs.toAccount.id;
            }
          }
          if (!resolvedToAccountId || resolvedToAccountId === (resolvedAccountId || accountId)) {
            const otherAcc = accounts.find((a) => a.id !== (resolvedAccountId || accountId));
            if (otherAcc) {
              resolvedToAccountId = otherAcc.id;
            }
          }
        }

        if (resolvedToAccountId && resolvedToAccountId !== toAccountId) {
          const toAcc = accounts.find((a) => a.id === resolvedToAccountId);
          if (toAcc) {
            setToAccountId(toAcc.id);
            setFieldUpdated('toAccountId');
            changesSummary.push(isAr ? `إلى حساب: ${toAcc.nameAr}` : `To Account: ${toAcc.name}`);
          }
        }

        // 6. Category
        let resolvedCategoryId = t.categoryId || (result.correction?.fieldToUpdate === 'categoryId' ? result.correction.newValue : null);
        if (!resolvedCategoryId) {
          const matchedCat = matchCategoryFromText(text, categories);
          if (matchedCat) resolvedCategoryId = matchedCat.id;
        }

        // If type changed and no category was explicitly specified in text, adapt category to compatible type
        const activeType = resolvedType || type;
        if (!resolvedCategoryId && resolvedType && resolvedType !== 'transfer') {
          const currentCat = categories.find((c) => c.id === categoryId);
          if (!currentCat || currentCat.type !== (activeType === 'income' ? 'income' : 'expense')) {
            const compatibleCat = categories.find((c) => c.type === (activeType === 'income' ? 'income' : 'expense'));
            if (compatibleCat) {
              resolvedCategoryId = compatibleCat.id;
            }
          }
        }

        if (resolvedCategoryId) {
          const cat = categories.find((c) => c.id === resolvedCategoryId);
          if (cat) {
            setCategoryId(cat.id);
            setFieldUpdated('categoryId');
            changesSummary.push(isAr ? `التصنيف: ${cat.nameAr}` : `Category: ${cat.name}`);
          }
        }

        // 7. Date
        if (t.date && t.date !== date) {
          setDate(t.date);
          setFieldUpdated('date');
          changesSummary.push(isAr ? `التاريخ: ${t.date}` : `Date: ${t.date}`);
        }

        // 8. Time
        if (t.time && t.time !== time) {
          setTime(t.time);
          setFieldUpdated('time');
        }
      }

      setVoiceInputText('');
      setError('');

      if (changesSummary.length > 0) {
        const successMsg = isAr
          ? `تم التعديل: ${changesSummary.join(' • ')}`
          : `Updated: ${changesSummary.join(' • ')}`;
        setAiVoiceNotice(successMsg);
        setAiVoiceNoticeType('success');
      } else if (result.rawInterpretationSummary) {
        setAiVoiceNotice(result.rawInterpretationSummary);
        setAiVoiceNoticeType('success');
      } else {
        setAiVoiceNotice(isAr ? 'تم تطبيق التعديل بنجاح' : 'Edit applied successfully');
        setAiVoiceNoticeType('success');
      }

      setTimeout(() => {
        setFieldUpdated(null);
      }, 3500);
    } catch (err) {
      console.error('Failed to process voice edit:', err);
      setAiVoiceNotice(isAr ? 'حدث خطأ في معالجة التعديل' : 'Error processing edit');
      setAiVoiceNoticeType('save_warning');
    } finally {
      setIsProcessingVoiceEdit(false);
    }
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setError('');

    // 1. Validate Amount
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError(isAr ? 'يرجى إدخال مبلغ صحيح أكبر من الصفر' : 'Please enter a valid amount greater than 0');
      return;
    }

    // 2. Validate Source Account
    if (!accountId) {
      setError(
        type === 'transfer'
          ? isAr
            ? 'يرجى اختيار حساب المصدر (من حساب)'
            : 'Please select a source account'
          : isAr
          ? 'يرجى اختيار الحساب المالي'
          : 'Please select a financial account'
      );
      return;
    }

    // 3. Validate Transfer Destination Account
    if (type === 'transfer') {
      if (!toAccountId) {
        setError(isAr ? 'يرجى اختيار حساب الوجهة (إلى حساب)' : 'Please select a destination account');
        return;
      }
      if (accountId === toAccountId) {
        setError(isAr ? 'لا يمكن التحويل لنفس الحساب' : 'Cannot transfer to the same account');
        return;
      }
    }

    // 4. Validate Category for Expense / Income
    if (type !== 'transfer' && !categoryId && categories.length > 0) {
      const matchCat = categories.find((c) => c.type === (type === 'income' ? 'income' : 'expense'));
      if (matchCat) {
        setCategoryId(matchCat.id);
      }
    }

    const isoString = toDateTimeISO(date, time);

    let finalDesc = description.trim();
    if (!finalDesc) {
      if (type === 'transfer') {
        finalDesc = isAr
          ? `تحويل إلى ${selectedToAccount ? selectedToAccount.nameAr : 'حساب'}`
          : `Transfer to ${selectedToAccount ? selectedToAccount.name : 'Account'}`;
      } else if (selectedCategory) {
        finalDesc = isAr ? selectedCategory.nameAr : selectedCategory.name;
      } else {
        finalDesc = type === 'income' ? (isAr ? 'دخل' : 'Income') : isAr ? 'مصروف' : 'Expense';
      }
    }

    onSaveTransaction({
      type,
      amount: parsedAmount,
      currency: selectedAccount ? selectedAccount.currency : currency,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : undefined,
      categoryId: type !== 'transfer' ? categoryId : undefined,
      description: finalDesc,
      date,
      time,
      dateTime: isoString,
    });

    onClose();
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-US', {
      maximumFractionDigits: 2,
    }).format(num);
  };

  const getAccountDisplayName = (acc?: FinancialAccount) => {
    if (!acc) return '';
    return isAr ? acc.nameAr : acc.name;
  };

  const getCategoryDisplayName = (cat?: Category) => {
    if (!cat) return '';
    return isAr ? cat.nameAr : cat.name;
  };

  const isMissingAccount = !accountId || missingFields.includes('accountId');

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="bg-white w-full max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[88vh]"
        role="dialog"
        aria-modal="true"
      >
        {/* Unified Form Top Bar */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white">
          <div className="flex items-center gap-2">
            <h3 className="font-black text-slate-900 text-sm sm:text-base tracking-tight">
              {isAr ? 'إضافة عملية جديدة' : 'New Transaction'}
            </h3>
            {isAiProposal && (
              <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                <Sparkles className="w-3 h-3 text-indigo-500" />
                <span>{isAr ? 'مقترح ذكي' : 'AI Draft'}</span>
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-slate-100 text-slate-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-2xl flex items-center gap-2 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Missing Account Warning Notice (from AI utterance) */}
          {isMissingAccount && isAiProposal && (
            <div className="p-3 rounded-2xl bg-amber-50/90 border border-amber-300 flex items-start gap-2.5 text-xs text-amber-900 animate-in fade-in">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-bold text-amber-950">
                  {isAr ? 'يرجى اختيار الحساب المالي' : 'Please choose an account'}
                </div>
                <div className="text-[11px] text-amber-800">
                  {isAr
                    ? 'لم يتم تحديد الحساب في جملتك، اختر الحساب أدناه لحفظ العملية.'
                    : 'Account was not specified. Please pick the account to complete.'}
                </div>
              </div>
            </div>
          )}

          {/* Voice & AI Dynamic Edit Bar inside Modal */}
          <div className="bg-gradient-to-r from-indigo-50/95 via-sky-50/70 to-indigo-50/95 border border-indigo-200/90 rounded-2xl p-3 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-950">
                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                <span>{isAr ? 'تعديل العملية بالصوت والذكاء الاصطناعي' : 'Edit with Voice & AI'}</span>
              </div>
              <span className="text-[10px] text-indigo-700 font-bold bg-indigo-100/90 px-2 py-0.5 rounded-full">
                {isAr ? 'تحدث لتعديل أي حقل' : 'Speak to edit any field'}
              </span>
            </div>

            {/* Active Speech / Edit Input with Mic & Send Buttons */}
            <div className="flex items-center gap-1.5">
              {/* Microphone Button */}
              <button
                type="button"
                onClick={isVoiceListening ? stopListening : startListening}
                className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all shrink-0 cursor-pointer shadow-xs ${
                  isVoiceListening
                    ? 'bg-rose-600 text-white animate-pulse ring-4 ring-rose-200'
                    : 'bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white'
                }`}
                title={isVoiceListening ? (isAr ? 'إيقاف الاستماع' : 'Stop Listening') : (isAr ? 'تحدث للتعديل' : 'Speak to Edit')}
              >
                {isVoiceListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              {/* Live Text Field */}
              <div className="relative flex-1">
                <input
                  ref={voiceInputRef}
                  type="text"
                  value={voiceInputText}
                  onChange={(e) => setVoiceInputText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleProcessVoiceEdit();
                    }
                  }}
                  placeholder={
                    isVoiceListening
                      ? isAr
                        ? 'جاري الاستماع... تحدث الآن، واضغط إرسال'
                        : 'Listening... Speak now and press Send'
                      : isAr
                      ? 'تحدث أو اكتب: "خليها صرف"، "المبلغ 500"...'
                      : 'Speak or type: "make it expense", "500"...'
                  }
                  className="w-full bg-white border border-indigo-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 rounded-xl py-2 px-3 text-xs text-slate-800 placeholder:text-indigo-300 outline-none transition-all shadow-2xs"
                />
              </div>

              {/* Send / Apply Button */}
              <button
                type="button"
                disabled={isProcessingVoiceEdit || (!voiceInputText.trim() && !isVoiceListening)}
                onClick={() => handleProcessVoiceEdit()}
                className="h-10 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1 transition-all shrink-0 cursor-pointer shadow-xs active:scale-95"
              >
                {isProcessingVoiceEdit ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">{isAr ? 'إرسال' : 'Send'}</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick Suggestion Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5 text-[11px]">
              <span className="text-[10px] text-indigo-400 font-semibold shrink-0">
                {isAr ? 'أمثلة سريعة:' : 'Quick:'}
              </span>
              <button
                type="button"
                onClick={() => handleProcessVoiceEdit(isAr ? 'معلش خليه تحويل' : 'Make it transfer')}
                className="px-2 py-0.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 text-blue-800 rounded-lg shrink-0 font-medium cursor-pointer transition-colors shadow-2xs"
              >
                {isAr ? 'معلش خليه تحويل' : 'Make transfer'}
              </button>
              <button
                type="button"
                onClick={() => handleProcessVoiceEdit(isAr ? 'لا خلي العملية صرف مش دخل' : 'Make it expense')}
                className="px-2 py-0.5 bg-white/90 hover:bg-white border border-indigo-100 text-indigo-800 rounded-lg shrink-0 font-medium cursor-pointer transition-colors shadow-2xs"
              >
                {isAr ? 'لا خليها صرف مش دخل' : 'Make expense'}
              </button>
              <button
                type="button"
                onClick={() => handleProcessVoiceEdit(isAr ? 'غير خانة الملاحظات إلى مشوار سريع' : 'Change notes to quick trip')}
                className="px-2 py-0.5 bg-white/90 hover:bg-white border border-indigo-100 text-indigo-800 rounded-lg shrink-0 font-medium cursor-pointer transition-colors shadow-2xs"
              >
                {isAr ? 'غير الملاحظات' : 'Change notes'}
              </button>
              <button
                type="button"
                onClick={() => handleProcessVoiceEdit(isAr ? 'خلي المبلغ 500' : 'Change amount to 500')}
                className="px-2 py-0.5 bg-white/90 hover:bg-white border border-indigo-100 text-indigo-800 rounded-lg shrink-0 font-medium cursor-pointer transition-colors shadow-2xs"
              >
                {isAr ? 'المبلغ 500' : 'Amount 500'}
              </button>
              <button
                type="button"
                onClick={() => handleProcessVoiceEdit(isAr ? 'احفظ العملية' : 'Save transaction')}
                className="px-2 py-0.5 bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-900 rounded-lg shrink-0 font-bold cursor-pointer transition-colors shadow-2xs"
                title={isAr ? 'تجربة قاعدة تأكيد الحفظ يدوياً' : 'Test manual save confirmation'}
              >
                {isAr ? 'احفظ العملية' : 'Save'}
              </button>
            </div>

            {/* AI Voice Feedback Banner */}
            {aiVoiceNotice && (
              <div
                className={`p-2.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 animate-in fade-in ${
                  aiVoiceNoticeType === 'save_warning'
                    ? 'bg-amber-500 text-white shadow-sm ring-2 ring-amber-300'
                    : aiVoiceNoticeType === 'success'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'bg-indigo-600 text-white shadow-sm'
                }`}
              >
                <div className="flex items-center gap-2">
                  {aiVoiceNoticeType === 'save_warning' ? (
                    <AlertTriangle className="w-4 h-4 shrink-0 text-amber-100" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-100" />
                  )}
                  <span>{aiVoiceNotice}</span>
                </div>
                {aiVoiceNoticeType === 'save_warning' && (
                  <button
                    type="button"
                    onClick={() => {
                      saveButtonRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      saveButtonRef.current?.focus();
                    }}
                    className="px-2.5 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-[11px] font-black cursor-pointer shrink-0"
                  >
                    {isAr ? 'انتقل لزر الحفظ ⬇' : 'Go to Save ⬇'}
                  </button>
                )}
              </div>
            )}

            {/* Important AI Disclaimer Notice */}
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-amber-50/95 border border-amber-200/90 text-amber-950 text-xs leading-relaxed shadow-2xs">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-xs leading-relaxed font-medium">
                <strong className="font-black text-amber-900 ml-1">
                  {isAr ? 'تنبيه هام:' : 'Important Notice:'}
                </strong>
                {isAr
                  ? 'قد يخطئ الذكاء الاصطناعي في الفهم وإجابة استفساراتكم، لذا يرجى مراجعة كل شيء يدوياً قبل الحفظ.'
                  : 'AI may make mistakes in understanding and answering your queries, so please review everything manually before saving.'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-3.5">
            {/* 1. Transaction Type Segmented Toggle (مصروف, دخل, تحويل) */}
            <div className={`grid grid-cols-3 gap-2 bg-slate-100/80 p-1 rounded-2xl transition-all duration-300 ${
              fieldUpdated === 'type' ? 'ring-2 ring-indigo-500 bg-indigo-50/70 scale-[1.01]' : ''
            }`}>
              {/* Expense */}
              <button
                type="button"
                onClick={() => handleTypeChange('expense')}
                className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer text-xs font-bold ${
                  type === 'expense'
                    ? 'bg-rose-500 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <ArrowDown className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{t.quickExpense}</span>
              </button>

              {/* Income */}
              <button
                type="button"
                onClick={() => handleTypeChange('income')}
                className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer text-xs font-bold ${
                  type === 'income'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{t.quickIncome}</span>
              </button>

              {/* Transfer */}
              <button
                type="button"
                onClick={() => handleTypeChange('transfer')}
                className={`py-2 px-2 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer text-xs font-bold ${
                  type === 'transfer'
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                }`}
              >
                <ArrowLeftRight className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{t.quickTransfer}</span>
              </button>
            </div>

            {/* 2. Amount Input ("المبلغ") with currency badge */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                {t.labelAmount}
              </label>
              <div className={`flex items-center rounded-2xl border bg-white p-1.5 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/10 shadow-2xs transition-all duration-300 ${
                fieldUpdated === 'amount' ? 'border-indigo-500 ring-2 ring-indigo-300 bg-indigo-50/30' : 'border-slate-200'
              }`}>
                <div className="px-3 py-1.5 bg-slate-100 rounded-xl text-xs font-mono font-bold text-slate-700 border border-slate-200/70 shrink-0">
                  {selectedAccount?.currency || currency}
                </div>
                <input
                  type="number"
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  autoFocus={!amount}
                  className="flex-1 text-right px-2.5 text-xl font-black text-slate-900 focus:outline-hidden"
                />
              </div>
            </div>

            {/* 3. Account Selectors (Single Account for Expense/Income, Two Accounts for Transfer) */}
            {type !== 'transfer' ? (
              /* Single Account for Expense / Income */
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 block">
                  {t.labelAccount}
                </label>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                    className={`w-full flex items-center justify-between p-2.5 sm:p-3 rounded-2xl border text-xs font-bold transition-colors cursor-pointer shadow-2xs ${
                      isMissingAccount
                        ? 'border-amber-400 bg-amber-50/60 hover:bg-amber-100/60 text-amber-900 ring-2 ring-amber-400/20'
                        : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-800'
                    }`}
                  >
                    {selectedAccount ? (
                      <div className="flex items-center gap-2">
                        <span className="text-base">
                          {selectedAccount.type === 'cash'
                            ? '💰'
                            : selectedAccount.type === 'bank'
                            ? '🏛️'
                            : selectedAccount.type === 'card'
                            ? '💳'
                            : selectedAccount.type === 'wallet'
                            ? '📱'
                            : selectedAccount.type === 'other'
                            ? '🔄'
                            : selectedAccount.type === 'custom'
                            ? '💼'
                            : '💲'}
                        </span>
                        <span>{getAccountDisplayName(selectedAccount)}</span>
                        <span className="text-[11px] text-slate-400 font-mono">
                          ({selectedAccount.currency})
                        </span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-amber-700 font-bold">
                        <AlertTriangle className="w-4 h-4 text-amber-600" />
                        <span>{isAr ? 'اضغط لاختيار الحساب (مطلوب)' : 'Select account (required)'}</span>
                      </div>
                    )}
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  </button>

                  {showAccountDropdown && (
                    <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white rounded-2xl border border-slate-200 shadow-xl p-1.5 space-y-1">
                      {accounts.map((acc) => (
                        <button
                          key={acc.id}
                          type="button"
                          onClick={() => {
                            setAccountId(acc.id);
                            setCurrency(acc.currency);
                            setShowAccountDropdown(false);
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                            acc.id === accountId
                              ? 'bg-emerald-50 text-emerald-900'
                              : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <span>
                              {acc.type === 'cash'
                                ? '💰'
                                : acc.type === 'bank'
                                ? '🏛️'
                                : acc.type === 'card'
                                ? '💳'
                                : acc.type === 'wallet'
                                ? '📱'
                                : acc.type === 'other'
                                ? '🔄'
                                : acc.type === 'custom'
                                ? '💼'
                                : '💲'}
                            </span>
                            <span>{getAccountDisplayName(acc)}</span>
                          </div>
                          <span className="font-mono text-slate-400">
                            {formatNumber(acc.balance)} {acc.currency}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Two Accounts for Transfer (From & To) */
              <div className="space-y-2.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 relative">
                  {/* From Account */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">
                      {t.labelFromAccount}
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                        className="w-full flex items-center justify-between p-2.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 transition-colors cursor-pointer shadow-2xs"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-sm">
                            {selectedAccount?.type === 'cash'
                              ? '💰'
                              : selectedAccount?.type === 'bank'
                              ? '🏛️'
                              : selectedAccount?.type === 'card'
                              ? '💳'
                              : selectedAccount?.type === 'wallet'
                              ? '📱'
                              : selectedAccount?.type === 'other'
                              ? '🔄'
                              : selectedAccount?.type === 'custom'
                              ? '💼'
                              : '💲'}
                          </span>
                          <span className="truncate">{getAccountDisplayName(selectedAccount) || (isAr ? 'اختر المصدر' : 'Select Source')}</span>
                        </div>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </button>

                      {showAccountDropdown && (
                        <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white rounded-2xl border border-slate-200 shadow-xl p-1.5 space-y-1">
                          {accounts.map((acc) => (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => {
                                setAccountId(acc.id);
                                setShowAccountDropdown(false);
                              }}
                              className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                                acc.id === accountId ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <span>{getAccountDisplayName(acc)}</span>
                              <span className="font-mono text-slate-400 text-[11px]">{acc.currency}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* To Account */}
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700 block">
                      {t.labelToAccount}
                    </label>
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setShowToAccountDropdown(!showToAccountDropdown)}
                        className="w-full flex items-center justify-between p-2.5 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-800 transition-colors cursor-pointer shadow-2xs"
                      >
                        <div className="flex items-center gap-1.5 truncate">
                          <span className="text-sm">
                            {selectedToAccount?.type === 'cash'
                              ? '💰'
                              : selectedToAccount?.type === 'bank'
                              ? '🏛️'
                              : selectedToAccount?.type === 'card'
                              ? '💳'
                              : selectedToAccount?.type === 'wallet'
                              ? '📱'
                              : selectedToAccount?.type === 'other'
                              ? '🔄'
                              : selectedToAccount?.type === 'custom'
                              ? '💼'
                              : '💲'}
                          </span>
                          <span className="truncate">{getAccountDisplayName(selectedToAccount) || (isAr ? 'اختر الوجهة' : 'Select Dest')}</span>
                        </div>
                        <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      </button>

                      {showToAccountDropdown && (
                        <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white rounded-2xl border border-slate-200 shadow-xl p-1.5 space-y-1">
                          {accounts.map((acc) => (
                            <button
                              key={acc.id}
                              type="button"
                              onClick={() => {
                                setToAccountId(acc.id);
                                setShowToAccountDropdown(false);
                              }}
                              className={`w-full flex items-center justify-between p-2 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                                acc.id === toAccountId ? 'bg-blue-50 text-blue-900' : 'hover:bg-slate-50 text-slate-700'
                              }`}
                            >
                              <span>{getAccountDisplayName(acc)}</span>
                              <span className="font-mono text-slate-400 text-[11px]">{acc.currency}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Swap button */}
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={handleSwapTransferAccounts}
                    className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-full text-[11px] font-bold transition-colors cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3 h-3" />
                    <span>{isAr ? 'تبديل الحسابين' : 'Swap Accounts'}</span>
                  </button>
                </div>
              </div>
            )}

            {/* 4. Category Autocomplete (for Expense and Income) */}
            {type !== 'transfer' && (
              <CategoryAutocomplete
                categories={categories}
                selectedCategoryId={categoryId}
                transactionType={type}
                lang={lang}
                onSelectCategory={(id) => setCategoryId(id)}
                onAddNewCategory={onAddCategory}
              />
            )}

            {/* 5. Description / Note ("الوصف / ملاحظة") */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700 block">
                {t.labelDescription}
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  selectedCategory
                    ? getCategoryDisplayName(selectedCategory)
                    : t.descPlaceholder
                }
                className={`w-full p-2.5 sm:p-3 rounded-2xl border bg-white text-xs font-semibold text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:border-emerald-500 shadow-2xs transition-all duration-300 ${
                  fieldUpdated === 'description' ? 'border-indigo-500 ring-2 ring-indigo-300 bg-indigo-50/30' : 'border-slate-200'
                }`}
              />
            </div>

            {/* 6. Date and Time with Derived Weekday & Interactive Editor */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-700 block">
                  {t.dateTimeLabel}
                </label>
                <button
                  type="button"
                  onClick={() => setShowDateTimeEditor(!showDateTimeEditor)}
                  className="text-[11px] text-emerald-600 font-bold hover:underline cursor-pointer"
                >
                  {showDateTimeEditor
                    ? isAr
                      ? 'إخفاء التعديل'
                      : 'Hide'
                    : isAr
                    ? 'تعديل التاريخ والوقت'
                    : 'Edit Date & Time'}
                </button>
              </div>

              {/* Display Card for Date and Time */}
              <div
                onClick={() => setShowDateTimeEditor(!showDateTimeEditor)}
                className="w-full flex items-center justify-between p-2.5 sm:p-3 rounded-2xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors cursor-pointer shadow-2xs"
              >
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <CalendarIcon className="w-4 h-4 text-slate-500" />
                  <span>{formatDateTimeDisplay(date, time, undefined, lang)}</span>
                </div>
                <Clock className="w-4 h-4 text-slate-400" />
              </div>

              {/* Expanded Interactive Date & Time Picker */}
              {showDateTimeEditor && (
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-2.5 sm:p-3 space-y-2 animate-in fade-in duration-150">
                  <div className="grid grid-cols-2 gap-2">
                    {/* Date Picker */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 mb-1 block">
                        {t.labelDate}
                      </label>
                      <input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-full p-2 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-hidden"
                      />
                    </div>

                    {/* Time Picker */}
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 mb-1 block">
                        {t.labelTime}
                      </label>
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="w-full p-2 bg-white rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-hidden"
                      />
                    </div>
                  </div>

                  {/* Quick Presets for Date and Time */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5 text-[11px]">
                    <span className="text-slate-400 shrink-0 font-medium">
                      {isAr ? 'سريع:' : 'Quick:'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setDate(getCurrentLocalDate());
                        setTime(getCurrentLocalTime());
                      }}
                      className="px-2 py-0.5 bg-white border border-slate-200 hover:border-emerald-500 rounded-lg text-slate-700 font-medium cursor-pointer"
                    >
                      {isAr ? 'الآن' : 'Now'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        now.setHours(now.getHours() - 1);
                        setTime(
                          `${String(now.getHours()).padStart(2, '0')}:${String(
                            now.getMinutes()
                          ).padStart(2, '0')}`
                        );
                      }}
                      className="px-2 py-0.5 bg-white border border-slate-200 hover:border-emerald-500 rounded-lg text-slate-700 font-medium cursor-pointer"
                    >
                      {isAr ? 'منذ ساعة' : '1h ago'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        now.setDate(now.getDate() - 1);
                        const y = now.getFullYear();
                        const m = String(now.getMonth() + 1).padStart(2, '0');
                        const d = String(now.getDate()).padStart(2, '0');
                        setDate(`${y}-${m}-${d}`);
                      }}
                      className="px-2 py-0.5 bg-white border border-slate-200 hover:border-emerald-500 rounded-lg text-slate-700 font-medium cursor-pointer"
                    >
                      {isAr ? 'أمس' : 'Yesterday'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons: "✓ تأكيد وحفظ العملية" & "إلغاء" */}
            <div className="pt-2 space-y-2">
              {/* Highlight Save Directional Callout when voice save is requested */}
              {highlightSaveBtn && (
                <div className="p-3 bg-amber-500 text-white rounded-2xl text-xs font-black text-center shadow-lg animate-bounce flex items-center justify-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-100" />
                  <span>{isAr ? 'من فضلك اضغط على زر تأكيد وحفظ أدناه 👇' : 'Please click Confirm & Save below 👇'}</span>
                </div>
              )}

              <button
                ref={saveButtonRef}
                type="submit"
                className={`w-full py-3.5 px-4 active:scale-[0.99] text-white text-xs sm:text-sm font-black rounded-2xl flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md ${
                  highlightSaveBtn
                    ? 'ring-4 ring-amber-400 ring-offset-2 animate-pulse scale-[1.02] shadow-xl'
                    : ''
                } ${
                  !selectedAccount || (type === 'transfer' && !selectedToAccount)
                    ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                    : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/20'
                }`}
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>
                  {!selectedAccount
                    ? isAr
                      ? 'يرجى اختيار الحساب أولاً'
                      : 'Please select an account first'
                    : type === 'transfer' && !selectedToAccount
                    ? isAr
                      ? 'يرجى اختيار حساب الوجهة'
                      : 'Please select destination account'
                    : t.confirmAndAddTransaction}
                </span>
              </button>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 text-xs font-bold text-slate-400 hover:text-slate-700 transition-colors cursor-pointer text-center"
              >
                {t.btnCancel}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
