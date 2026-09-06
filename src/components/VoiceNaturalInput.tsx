import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, Sparkles, Loader2, HelpCircle } from 'lucide-react';
import { Language, FinancialAccount, Category, Transaction, CurrencyCode } from '../types';
import { translations } from '../data/translations';
import { aiClient } from '../services/ai/aiClient';
import { AIFinancialQuery, AIInterpretationResult, AICorrection } from '../services/ai/types';

interface VoiceNaturalInputProps {
  lang: Language;
  accounts: FinancialAccount[];
  categories: Category[];
  onTransactionDraft: (draft: Partial<Transaction>, missingFields: string[]) => void;
  onFinancialQuery: (query: AIFinancialQuery, questionText: string) => void;
  onAICorrection?: (correction: AICorrection) => void;
}

// Typing helper for Web Speech API
interface SpeechRecognitionEventLike {
  results: {
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
}

interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onstart: () => void;
  onend: () => void;
  onerror: (event: unknown) => void;
  onresult: (event: SpeechRecognitionEventLike) => void;
}

export function VoiceNaturalInput({
  lang,
  accounts,
  categories,
  onTransactionDraft,
  onFinancialQuery,
  onAICorrection,
}: VoiceNaturalInputProps) {
  const t = translations[lang];
  const isAr = lang === 'ar';

  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Unified AI Processing Pipeline
   * Both Voice STT and Typed Input go through this exact same function!
   */
  const processInputWithAI = async (rawText: string) => {
    const text = rawText.trim();
    if (!text) return;

    setIsProcessingAI(true);
    setStatusMessage(isAr ? 'جاري الفهم بالذكاء الاصطناعي...' : 'Understanding with Gemini AI...');

    try {
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Cairo';
      const now = new Date();
      // Format local ISO
      const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString();

      const result: AIInterpretationResult = await aiClient.interpret({
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
      });

      // Handle Result based on classified INTENT
      if (result.intent === 'FINANCIAL_QUERY') {
        setStatusMessage(null);
        onFinancialQuery(
          result.query || { metric: 'total_spent', period: 'all_time', transactionType: 'expense' },
          text
        );
      } else if (result.intent === 'CREATE_TRANSACTION' && result.transaction) {
        setStatusMessage(null);
        const tx = result.transaction;

        // Build transaction draft
        const draft: Partial<Transaction> = {
          type: tx.type || 'expense',
          amount: tx.amount || undefined,
          currency: (tx.currency as CurrencyCode) || accounts[0]?.currency || 'EGP',
          accountId: tx.accountId || undefined,
          toAccountId: tx.toAccountId || undefined,
          categoryId: tx.categoryId || undefined,
          description: tx.description || (isAr ? 'معاملة جديدة' : 'New Transaction'),
          date: tx.date || localISO.slice(0, 10),
          time: tx.time || localISO.slice(11, 16),
        };

        onTransactionDraft(draft, tx.missingFields || []);
      } else if (result.intent === 'CORRECT_PROPOSAL' && result.correction) {
        setStatusMessage(null);
        if (onAICorrection) {
          onAICorrection(result.correction);
        }
      } else {
        // UNKNOWN or needs clarification
        const clarification =
          result.clarificationNeeded ||
          (isAr
            ? 'لم أتمكن من فهم العملية بدقة، يمكنك كتابة مثل: "دفعت 150 سوبرماركت من الكاش" أو "صرفت كام الأسبوع ده؟"'
            : 'Could not understand clearly. Try e.g. "Paid 150 grocery from Cash" or "How much did I spend this week?"');
        setStatusMessage(clarification);
        setTimeout(() => setStatusMessage(null), 6000);
      }
    } catch (err) {
      console.error('AI processing error:', err);
      setStatusMessage(
        isAr
          ? 'تعذر الاتصال بالمساعد الذكي، يرجى المحاولة مرة ثانية'
          : 'Could not reach AI assistant, please try again'
      );
      setTimeout(() => setStatusMessage(null), 4000);
    } finally {
      setIsProcessingAI(false);
      setInputText('');
    }
  };

  // Initialize Speech Recognition if supported
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition() as SpeechRecognitionLike;
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = lang === 'ar' ? 'ar-EG' : 'en-US';

        recognition.onstart = () => {
          setIsListening(true);
          setSpeechError(null);
        };

        recognition.onresult = (event: SpeechRecognitionEventLike) => {
          const transcript = event.results[0][0]?.transcript;
          if (transcript) {
            setInputText(transcript);
            // Route spoken sentence directly into unified AI pipeline
            processInputWithAI(transcript);
          }
        };

        recognition.onerror = () => {
          setIsListening(false);
          setSpeechError(t.speechNotSupported);
          setTimeout(() => setSpeechError(null), 4000);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } catch {
        // Speech recognition not permitted in this context
      }
    }
  }, [lang, accounts, categories, t.speechNotSupported]);

  const handleToggleMic = () => {
    if (isProcessingAI) return;

    if (!recognitionRef.current) {
      if (inputRef.current) {
        inputRef.current.focus();
      }
      setSpeechError(t.speechNotSupported);
      setTimeout(() => setSpeechError(null), 3500);
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch {
        setIsListening(false);
      }
    } else {
      try {
        recognitionRef.current.lang = lang === 'ar' ? 'ar-EG' : 'en-US';
        recognitionRef.current.start();
      } catch {
        setIsListening(false);
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || isProcessingAI) return;
    processInputWithAI(inputText);
  };

  const handleExampleClick = (example: string) => {
    if (isProcessingAI) return;
    setInputText(example);
    processInputWithAI(example);
  };

  return (
    <div className="space-y-2">
      {/* Primary Big Voice / Text Card with Gemini AI styling */}
      <form
        onSubmit={handleFormSubmit}
        className={`bg-white rounded-3xl border transition-all shadow-xs p-4 sm:p-5 flex items-center justify-between gap-3 ${
          isListening
            ? 'border-emerald-500 ring-4 ring-emerald-500/10'
            : isProcessingAI
            ? 'border-indigo-400 ring-4 ring-indigo-400/10'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        {/* Left/Middle Content Area: Input & Sub-example */}
        <div className="flex-1 min-w-0">
          <input
            ref={inputRef}
            type="text"
            disabled={isProcessingAI}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isListening
                ? t.listening
                : isProcessingAI
                ? isAr
                  ? 'جاري التحليل الذكي مع Gemini...'
                  : 'Analyzing with Gemini AI...'
                : isAr
                ? 'اكتب أو قل أي عملية أو سؤال مالي...'
                : 'Type or speak any transaction or question...'
            }
            className="w-full text-sm sm:text-base font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-hidden bg-transparent tracking-tight disabled:opacity-60"
          />
          <p className="text-[11px] sm:text-xs text-slate-400 font-medium mt-1 truncate">
            {isListening ? (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                {t.listening}
              </span>
            ) : isProcessingAI ? (
              <span className="text-indigo-600 font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3 animate-spin text-indigo-500 inline-block" />
                {isAr ? 'الذكاء الاصطناعي يفهم مقصدك...' : 'AI is processing your intent...'}
              </span>
            ) : (
              <span className="flex items-center gap-1 text-slate-400">
                <Sparkles className="w-3 h-3 text-emerald-500" />
                <span>
                  {isAr
                    ? 'مثال: "صرفت كام الأسبوع ده؟" أو "دفعت 350 بنزين من الكاش"'
                    : 'e.g. "How much did I spend this week?" or "Paid 350 for fuel from Cash"'}
                </span>
              </span>
            )}
          </p>
        </div>

        {/* Right Side: Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          {inputText.trim().length > 0 && !isProcessingAI && (
            <button
              type="submit"
              className="w-10 h-10 rounded-full bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-center transition-transform active:scale-95 cursor-pointer shadow-xs"
              title={isAr ? 'إرسال' : 'Send'}
            >
              <Send className="w-4 h-4" />
            </button>
          )}

          <button
            type="button"
            disabled={isProcessingAI}
            onClick={handleToggleMic}
            className={`w-12 h-12 rounded-full flex items-center justify-center text-white transition-all cursor-pointer shadow-md disabled:opacity-50 ${
              isListening
                ? 'bg-rose-500 animate-pulse ring-4 ring-rose-500/20 shadow-rose-500/30'
                : isProcessingAI
                ? 'bg-indigo-600 shadow-indigo-500/25'
                : 'bg-emerald-500 hover:bg-emerald-600 active:scale-95 shadow-emerald-500/25'
            }`}
            title={isAr ? 'تحدث للمساعد المالي' : 'Speak to AI Financial Assistant'}
          >
            {isProcessingAI ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isListening ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>
        </div>
      </form>

      {/* Clarification or Status Banner */}
      {statusMessage && (
        <div className="text-xs text-indigo-900 bg-indigo-50/90 border border-indigo-200/90 px-3.5 py-2 rounded-2xl flex items-center gap-2 animate-in fade-in">
          <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
          <span className="font-medium">{statusMessage}</span>
        </div>
      )}

      {/* Speech Hint / Error if any */}
      {speechError && (
        <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>{speechError}</span>
        </div>
      )}

      {/* Quick Example Pills to test instant Gemini understanding */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-[11px] text-slate-500">
        <span className="text-slate-400 font-medium shrink-0">
          {isAr ? 'جرّب الذكاء الاصطناعي:' : 'Try AI:'}
        </span>
        <button
          type="button"
          disabled={isProcessingAI}
          onClick={() =>
            handleExampleClick(
              isAr ? 'دفعت 350 جنيه بنزين من الكاش الساعة 4 ونص' : 'Paid 350 for fuel from Cash at 4:30 PM'
            )
          }
          className="px-2.5 py-1 rounded-full bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-700 transition-colors whitespace-nowrap cursor-pointer shadow-2xs font-medium"
        >
          {isAr ? '⛽ 350 بنزين من الكاش 4:30' : '⛽ 350 fuel from cash'}
        </button>
        <button
          type="button"
          disabled={isProcessingAI}
          onClick={() =>
            handleExampleClick(isAr ? 'أنا صرفت كام الأسبوع ده؟' : 'How much did I spend this week?')
          }
          className="px-2.5 py-1 rounded-full bg-indigo-50/70 border border-indigo-200 text-indigo-800 hover:bg-indigo-100 transition-colors whitespace-nowrap cursor-pointer shadow-2xs font-bold"
        >
          {isAr ? '🔍 صرفت كام الأسبوع ده؟' : '🔍 Spent this week?'}
        </button>
        <button
          type="button"
          disabled={isProcessingAI}
          onClick={() =>
            handleExampleClick(
              isAr ? 'استلمت 20 ألف جنيه مرتب على حساب البنك' : 'Received 20k salary to Bank'
            )
          }
          className="px-2.5 py-1 rounded-full bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-700 transition-colors whitespace-nowrap cursor-pointer shadow-2xs font-medium"
        >
          {isAr ? '💼 20 ألف مرتب على البنك' : '💼 20k salary to Bank'}
        </button>
        <button
          type="button"
          disabled={isProcessingAI}
          onClick={() =>
            handleExampleClick(isAr ? 'حولت 500 جنيه من البنك للكاش' : 'Transferred 500 from Bank to Cash')
          }
          className="px-2.5 py-1 rounded-full bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-700 transition-colors whitespace-nowrap cursor-pointer shadow-2xs font-medium"
        >
          {isAr ? '⇄ 500 تحويل من البنك للكاش' : '⇄ 500 Bank to Cash'}
        </button>
        <button
          type="button"
          disabled={isProcessingAI}
          onClick={() =>
            handleExampleClick(isAr ? 'دفعت 300 جنيه في مطعم' : 'Paid 300 in a restaurant')
          }
          className="px-2.5 py-1 rounded-full bg-amber-50/80 border border-amber-200 text-amber-800 hover:bg-amber-100 transition-colors whitespace-nowrap cursor-pointer shadow-2xs font-medium"
          title={isAr ? 'تجربة حقل حساب مفقود' : 'Test missing account field'}
        >
          {isAr ? '⚠️ 300 بمطعم (بدون تحديد حساب)' : '⚠️ 300 restaurant (missing account)'}
        </button>
      </div>
    </div>
  );
}
