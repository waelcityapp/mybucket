import React, { useState, useEffect, useRef } from 'react';
import { Mic, MicOff, Send, Sparkles, Loader2, HelpCircle } from 'lucide-react';
import { Language, FinancialAccount, Category, Transaction, CurrencyCode } from '../types';
import { UserSubscription, UserDailyUsage } from '../types/prototypeSubscription';
import { translations } from '../data/translations';
import { aiClient } from '../services/ai/aiClient';
import { AIFinancialQuery, AIInterpretationResult, AICorrection } from '../services/ai/types';

interface VoiceNaturalInputProps {
  lang: Language;
  accounts: FinancialAccount[];
  categories: Category[];
  userDailyUsage?: UserDailyUsage;
  userSubscription?: UserSubscription | null;
  onTransactionDraft: (draft: Partial<Transaction>, missingFields: string[]) => void;
  onFinancialQuery: (query: AIFinancialQuery, questionText: string) => void;
  onAICorrection?: (correction: AICorrection) => void;
  onAiEntryUsed?: () => void;
  onAiQueryUsed?: () => void;
  onOpenManualAdd?: () => void;
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
  abort?: () => void;
  onstart: () => void;
  onend: () => void;
  onerror: (event: unknown) => void;
  onresult: (event: SpeechRecognitionEventLike) => void;
}

export function VoiceNaturalInput({
  lang,
  accounts,
  categories,
  userDailyUsage,
  userSubscription,
  onTransactionDraft,
  onFinancialQuery,
  onAICorrection,
  onAiEntryUsed,
  onAiQueryUsed,
  onOpenManualAdd,
}: VoiceNaturalInputProps) {
  const t = translations[lang];
  const isAr = lang === 'ar';
  // Speech language is independent from the application UI language.
  const [speechLanguage, setSpeechLanguage] = useState<'ar-EG' | 'en-US'>(lang === 'ar' ? 'ar-EG' : 'en-US');

  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [showSoftLandingModal, setShowSoftLandingModal] = useState<'entry' | 'inquiry' | null>(null);

  const isPaid = userSubscription?.isPaid;
  const maxEntries = userSubscription?.dailyExpenseAiLimit || 15;
  const maxQueries = userSubscription?.dailyInquiryAiLimit || 5;
  const usedEntries = userDailyUsage?.expenseAiCount || 0;
  const usedQueries = userDailyUsage?.inquiryAiCount || 0;

  const entriesRemaining = isPaid ? 999 : Math.max(0, maxEntries - usedEntries);
  const queriesRemaining = isPaid ? 999 : Math.max(0, maxQueries - usedQueries);
  const [speechError, setSpeechError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recordingActiveRef = useRef(false);
  const segmentBaseRef = useRef('');
  const latestSegmentRef = useRef('');
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [pendingVoiceReview, setPendingVoiceReview] = useState(false);
  // Grow with the transcript, then scroll within a generous maximum height.
  // Keep a comfortable minimum font size instead of shrinking indefinitely.
  const transcriptSizeClass = inputText.length > 350
    ? 'text-[13px] sm:text-sm'
    : inputText.length > 180
    ? 'text-sm sm:text-[15px]'
    : 'text-base sm:text-lg';

  useEffect(() => {
    const field = inputRef.current;
    if (!field) return;
    field.style.height = 'auto';
    field.style.height = Math.min(field.scrollHeight, 240) + 'px';
    if (isRecording) field.scrollTop = field.scrollHeight;
  }, [inputText, isRecording]);


  const clearSpeechRestart = () => {
    if (restartTimerRef.current) clearTimeout(restartTimerRef.current);
    restartTimerRef.current = null;
  };

  // Ends only on the user's explicit action. Speech silence never sends to AI.
  const finishVoiceRecording = () => {
    recordingActiveRef.current = false;
    clearSpeechRestart();
    setIsRecording(false);
    setIsListening(false);
    try { recognitionRef.current?.stop(); } catch { /* Already stopped by browser */ }
    setPendingVoiceReview(true);
  };

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
        // Check Daily Inquiry Limit (5/day for trial)
        if (!isPaid && queriesRemaining <= 0) {
          setShowSoftLandingModal('inquiry');
          setStatusMessage(
            isAr
              ? 'لقد استهلكت حد الأسئلة الذكية لليوم (5 استفسارات). يمكنك البحث اليدوي في شاشة التقارير أو الترقية للنسخة الاحترافية.'
              : 'You have reached your daily AI query limit (5 queries). You can review records manually in Reports.'
          );
          setTimeout(() => setStatusMessage(null), 6000);
          return;
        }

        setStatusMessage(null);
        if (onAiQueryUsed) {
          onAiQueryUsed();
        }
        onFinancialQuery(
          result.query || { metric: 'total_spent', period: 'all_time', transactionType: 'expense' },
          text
        );
      } else if (result.intent === 'CREATE_TRANSACTION' && result.transaction) {
        // Check Daily Entry Limit (15/day for trial)
        if (!isPaid && entriesRemaining <= 0) {
          setShowSoftLandingModal('entry');
          setStatusMessage(
            isAr
              ? 'لقد استهلكت حد الإدخال الذكي لليوم (15 عملية). جاري نقلك للإدخال اليدوي المباشر بدون قيود!'
              : 'Daily AI entry limit reached (15 entries). You can continue entering transactions manually!'
          );
          setTimeout(() => setStatusMessage(null), 6000);
          return;
        }

        setStatusMessage(null);
        if (onAiEntryUsed) {
          onAiEntryUsed();
        }
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

  // Keep browser speech recognition in short sessions to avoid duplicate text
  // on Android Chrome. A browser-imposed stop triggers a new session while
  // the user has not pressed the explicit Finish Recording button.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      recognitionRef.current = null;
      return;
    }

    const recognition = new SpeechRecognition() as SpeechRecognitionLike;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = speechLanguage;
    recognitionRef.current = recognition;

    let segmentFinal = '';
    let segmentInterim = '';
    const startRecognition = () => {
      if (!recordingActiveRef.current || recognitionRef.current !== recognition) return;
      try { recognition.start(); }
      catch {
        // Browser may still be closing its previous speech session.
        clearSpeechRestart();
        restartTimerRef.current = setTimeout(startRecognition, 350);
      }
    };

    recognition.onstart = () => {
      segmentFinal = '';
      segmentInterim = '';
      latestSegmentRef.current = '';
      setIsListening(true);
      setSpeechError(null);
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    recognition.onresult = (event: any) => {
      segmentFinal = '';
      segmentInterim = '';
      for (let i = 0; i < event.results.length; i++) {
        const phrase = event.results[i]?.[0]?.transcript || '';
        if (event.results[i]?.isFinal) segmentFinal += phrase;
        else segmentInterim += phrase;
      }
      const segment = (segmentFinal + segmentInterim).trim();
      latestSegmentRef.current = segment;
      if (segment) {
        setInputText([segmentBaseRef.current, segment].filter(Boolean).join(' '));
      }
    };

    recognition.onerror = (event: unknown) => {
      const error = (event as { error?: string })?.error;
      // 'no-speech' and aborted sessions are normal when the user pauses.
      // Permissions / unavailable microphones require explicit intervention.
      if (error === 'not-allowed' || error === 'service-not-allowed' ||
          error === 'audio-capture' || error === 'language-not-supported') {
        recordingActiveRef.current = false;
        clearSpeechRestart();
        setIsRecording(false);
        setSpeechError(t.speechNotSupported);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      const segment = (segmentFinal || latestSegmentRef.current).trim();
      if (segment) {
        // Append this completed session once, then reset for the next one.
        segmentBaseRef.current = [segmentBaseRef.current, segment].filter(Boolean).join(' ');
        setInputText(segmentBaseRef.current);
      }
      latestSegmentRef.current = '';
      segmentFinal = '';
      segmentInterim = '';

      if (recordingActiveRef.current) {
        clearSpeechRestart();
        restartTimerRef.current = setTimeout(startRecognition, 200);
      } else {
        setPendingVoiceReview(Boolean(segmentBaseRef.current.trim()));
      }
    };

    return () => {
      recordingActiveRef.current = false;
      clearSpeechRestart();
      try { recognition.abort?.(); } catch { try { recognition.stop(); } catch {} }
      if (recognitionRef.current === recognition) recognitionRef.current = null;
    };
  }, [speechLanguage, t.speechNotSupported]);

  const handleToggleMic = () => {
    if (isProcessingAI) return;
    if (recordingActiveRef.current) {
      finishVoiceRecording();
      return;
    }
    if (!recognitionRef.current) {
      inputRef.current?.focus();
      setSpeechError(t.speechNotSupported);
      return;
    }
    clearSpeechRestart();
    segmentBaseRef.current = '';
    latestSegmentRef.current = '';
    setInputText('');
    setPendingVoiceReview(false);
    setSpeechError(null);
    recordingActiveRef.current = true;
    setIsRecording(true);
    try { recognitionRef.current.start(); }
    catch {
      // A previous session may still be ending; retry when it closes.
      restartTimerRef.current = setTimeout(() => {
        if (!recordingActiveRef.current) return;
        try { recognitionRef.current?.start(); }
        catch {
          recordingActiveRef.current = false;
          setIsRecording(false);
          setSpeechError(t.speechNotSupported);
        }
      }, 300);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isRecording) {
      finishVoiceRecording();
      return;
    }
    if (!inputText.trim() || isProcessingAI) return;
    setPendingVoiceReview(false);
    void processInputWithAI(inputText);
  };

  const handleExampleClick = (example: string) => {
    if (isProcessingAI || isRecording) return;
    setInputText(example);
    void processInputWithAI(example);
  };

  return (
    <div className="space-y-2">
      {/* Primary Big Voice / Text Card with Gemini AI styling */}
      <form
        onSubmit={handleFormSubmit}
        className={`bg-white rounded-3xl border transition-all shadow-xs p-4 sm:p-5 flex items-center justify-between gap-3 ${
          isRecording
            ? 'border-emerald-500 ring-4 ring-emerald-500/10'
            : isProcessingAI
            ? 'border-indigo-400 ring-4 ring-indigo-400/10'
            : 'border-slate-200 hover:border-slate-300'
        }`}
      >
        {/* Left/Middle Content Area: Input & Sub-example */}
        <div className="flex-1 min-w-0">
          <textarea
            ref={inputRef}
            rows={3}
            disabled={isProcessingAI}
            readOnly={isRecording}
            dir={isAr ? 'rtl' : 'ltr'}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder={
              isRecording
                ? t.listening
                : isProcessingAI
                ? isAr
                  ? 'جاري التحليل الذكي مع Gemini...'
                  : 'Analyzing with Gemini AI...'
                : isAr
                ? 'اكتب أو قل أي عملية أو سؤال مالي...'
                : 'Type or speak any transaction or question...'
            }
            className={`block w-full min-h-[92px] max-h-[240px] resize-none overflow-y-auto whitespace-pre-wrap break-words leading-relaxed font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent disabled:opacity-60 ${transcriptSizeClass}`}
            aria-label={isAr ? 'نص العملية أو السؤال المالي' : 'Transaction or financial question'}
          />
          <p className="text-[11px] sm:text-xs text-slate-400 font-medium mt-1">
            {isRecording ? (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                {isAr ? 'التسجيل مستمر حتى تضغط إنهاء التسجيل؛ يمكنك التوقف والتفكير ثم المتابعة.' : 'Recording continues until you tap Finish recording; pause and resume speaking freely.'}
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
        <div className="flex items-start gap-2 shrink-0 self-start">
          {inputText.trim().length > 0 && !isProcessingAI && !pendingVoiceReview && !isRecording && (
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
              isRecording
                ? 'bg-rose-500 animate-pulse ring-4 ring-rose-500/20 shadow-rose-500/30'
                : isProcessingAI
                ? 'bg-indigo-600 shadow-indigo-500/25'
                : 'bg-emerald-500 hover:bg-emerald-600 active:scale-95 shadow-emerald-500/25'
            }`}
            title={isRecording ? (isAr ? 'إنهاء التسجيل' : 'Finish recording') : (isAr ? 'تحدث للمساعد المالي' : 'Speak to AI Financial Assistant')}
          >
            {isProcessingAI ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : isRecording ? (
              <MicOff className="w-5 h-5" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>
        </div>
      </form>

      <div className="flex items-center gap-2 justify-between px-1">
        <span className="text-xs font-semibold text-slate-600">
          {isAr ? 'لغة التحدث' : 'Speech language'}
        </span>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1 gap-1" role="group" aria-label={isAr ? 'اختيار لغة التحدث' : 'Choose speech language'}>
          <button type="button" disabled={isRecording || isProcessingAI} onClick={() => setSpeechLanguage('ar-EG')}
            aria-pressed={speechLanguage === 'ar-EG'}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${speechLanguage === 'ar-EG' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            عربي
          </button>
          <button type="button" disabled={isRecording || isProcessingAI} onClick={() => setSpeechLanguage('en-US')}
            aria-pressed={speechLanguage === 'en-US'}
            className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-50 ${speechLanguage === 'en-US' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            English
          </button>
        </div>
      </div>

      {isRecording && !isProcessingAI && (
        <button type="button" onClick={finishVoiceRecording} className="w-full rounded-xl bg-rose-600 hover:bg-rose-700 text-white py-3 px-4 text-sm font-extrabold flex justify-center items-center gap-2">
          <MicOff className="w-4 h-4" />{isAr ? 'إنهاء التسجيل' : 'Finish recording'}
        </button>
      )}

      {pendingVoiceReview && !isRecording && !isProcessingAI && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-3 sm:p-4 space-y-3">
          <p className="text-sm font-bold text-emerald-900">
            {isAr ? 'راجع الكلام المكتوب بالأعلى، ويمكنك تعديله قبل الإرسال.' : 'Review the transcript above and edit it before sending.'}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <button type="button" disabled={!inputText.trim()} onClick={() => { const text = inputText.trim(); if (!text) return; setPendingVoiceReview(false); void processInputWithAI(text); }}
              className="rounded-xl bg-emerald-600 px-3 py-3 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
              {isAr ? 'إرسال للمراجعة والتأكيد' : 'Send for review and confirmation'}
            </button>
            <button type="button" onClick={() => { setPendingVoiceReview(false); setInputText(''); segmentBaseRef.current = ''; latestSegmentRef.current = ''; setStatusMessage(null); }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50">
              {isAr ? 'إلغاء' : 'Cancel'}
            </button>
          </div>
        </div>
      )}

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
          disabled={isProcessingAI || isRecording}
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
            handleExampleClick(
              isAr ? 'دفعت 350 جنيه بنزين من الكاش' : 'Paid 350 for fuel from Cash'
            )
          }
          className="px-2.5 py-1 rounded-full bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-700 transition-colors whitespace-nowrap cursor-pointer shadow-2xs font-medium"
        >
          {isAr ? '⛽ 350 بنزين كاش' : '⛽ 350 fuel from cash'}
        </button>
        <button
          type="button"
          disabled={isProcessingAI}
          onClick={() =>
            handleExampleClick(
              isAr ? 'اشتريت طلبات بـ 200 جنيه' : 'Bought groceries for 200'
            )
          }
          className="px-2.5 py-1 rounded-full bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50 hover:text-emerald-700 transition-colors whitespace-nowrap cursor-pointer shadow-2xs font-medium"
        >
          {isAr ? '🛒 200 مشتريات' : '🛒 200 groceries'}
        </button>
        <button
          type="button"
          disabled={isProcessingAI}
          onClick={() =>
            handleExampleClick(isAr ? 'أنا صرفت كام الأسبوع ده؟' : 'How much did I spend this week?')
          }
          className="px-2.5 py-1 rounded-full bg-indigo-50/80 border border-indigo-200 text-indigo-800 hover:bg-indigo-100 transition-colors whitespace-nowrap cursor-pointer shadow-2xs font-bold"
        >
          {isAr ? '🔍 صرفت كام الأسبوع ده؟' : '🔍 Spent this week?'}
        </button>
      </div>

      {/* Soft Landing Quota Limit Modal */}
      {showSoftLandingModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-5 sm:p-6 max-w-sm w-full border border-slate-100 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-2xl bg-amber-100 flex items-center justify-center text-amber-600 mx-auto">
              <Sparkles className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="font-bold text-base text-slate-800">
                {showSoftLandingModal === 'entry'
                  ? isAr
                    ? 'وصلت للحد اليومي للإدخال الذكي (15 عملية)'
                    : 'Daily AI Entry Limit Reached (15)'
                  : isAr
                  ? 'وصلت للحد اليومي للاستفسارات الذكية (5 أسئلة)'
                  : 'Daily AI Query Limit Reached (5)'}
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                {showSoftLandingModal === 'entry'
                  ? isAr
                    ? 'فترة التجربة توفر 15 إدخال بالذكاء الاصطناعي يومياً. يمكنك الآن إتمام عمليتك بالإدخال اليدوي المباشر بدون أي انقطاع وبدون حدود!'
                    : 'Trial includes 15 AI entries per day. You can continue effortlessly with manual entry with no limits!'
                  : isAr
                  ? 'فترة التجربة توفر 5 استفسارات بالذكاء الاصطناعي يومياً. يمكنك مراجعة تقاريرك وحساباتك مباشرة في تبويب التقارير.'
                  : 'Trial includes 5 AI queries per day. You can review all records directly in the Reports tab.'}
              </p>
            </div>

            <div className="space-y-2 pt-2">
              {showSoftLandingModal === 'entry' && onOpenManualAdd && (
                <button
                  type="button"
                  onClick={() => {
                    setShowSoftLandingModal(null);
                    onOpenManualAdd();
                  }}
                  className="w-full py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-bold text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>{isAr ? 'المتابعة بالإدخال اليدوي المباشر ✍️' : 'Continue with Manual Entry ✍️'}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setShowSoftLandingModal(null)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs transition-colors cursor-pointer"
              >
                {isAr ? 'حسناً، فهمت' : 'Got it'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
