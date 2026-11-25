import { aiDisplayText } from '../utils/aiDisplayText';
import { useAppNotice } from './AppNotice';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Mic, MicOff, Send, Sparkles, Loader2, HelpCircle } from 'lucide-react';
import { Language, FinancialAccount, Category, Transaction, CurrencyCode } from '../types';
import { UserSubscription, UserDailyUsage } from '../types/prototypeSubscription';
import { translations } from '../data/translations';
import { aiClient, geminiClient, quotaLocalClient } from '../services/ai/aiClient';
import { stageFor } from '../config/subscriptionPolicy';
import { AIFinancialQuery, AIInterpretationResult, AICorrection } from '../services/ai/types';
import type { AnalyzerFeedbackContext } from '../services/ai/analyzerFeedbackClient';
import { auth } from '../lib/firebase';
import { APP_REVISION } from '../config/appRevision';

interface VoiceNaturalInputProps {
  accountUid?: string;
  lang: Language;
  accounts: FinancialAccount[];
  categories: Category[];
  userDailyUsage?: UserDailyUsage;
  userSubscription?: UserSubscription | null;
  onTransactionDraft: (draft: Partial<Transaction>, missingFields: string[], feedback:AnalyzerFeedbackContext, retryWithAi?: () => Promise<void>) => void;
  onFinancialQuery: (query: AIFinancialQuery, questionText: string) => void;
  onAICorrection?: (correction: AICorrection) => void;
  onAiEntryUsed?: () => void;
  onAiQueryUsed?: () => void;
  onOpenManualAdd?: () => void;
  guestDemo?: boolean;
  subscriptionExpired?: boolean;
  onExpiredAttempt?: () => void;
}

// Typing helper for Web Speech API
interface SpeechRecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>;
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
  accountUid,
  lang,
  accounts,
  categories,
  userSubscription,
  onTransactionDraft,
  onFinancialQuery,
  onAICorrection,
  guestDemo = false,
  subscriptionExpired = false,
  onExpiredAttempt,
}: VoiceNaturalInputProps) {
  const t = translations[lang];
  const isAr = lang === 'ar';
  // Keep voice recognition tied to the single app-wide language choice.
  const speechLanguage = lang === 'ar' ? 'ar-EG' : 'en-US';

  const phase = userSubscription ? stageFor(userSubscription) : 'expired';
  const canUseAi = !guestDemo && !subscriptionExpired && (phase === 'paid' || phase === 'pro-trial');
  const [aiSelected, setAiSelected] = useState(false);
  const [attempts, setAttempts] = useState<{ limit: number; remaining: number } | null>(null);
  const requestVersion = useRef(0);
  const refreshAttempts = useCallback(async () => {
    if (!canUseAi) return;
    const user = auth.currentUser;
    if (!user || user.uid !== accountUid) return;
    const version = ++requestVersion.current;
    try {
      const response = await fetch('/api/gateway', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${await user.getIdToken()}` },
        body: JSON.stringify({ action: 'ai.quota.status' }),
      });
      const result = await response.json();
      if (version === requestVersion.current && auth.currentUser?.uid === user.uid) {
        setAttempts(response.ok && result.ok && result.data?.plan === 'pro' ? result.data.aiAttempts ?? null : null);
      }
    } catch {
      if (version === requestVersion.current) setAttempts(null);
    }
  }, [accountUid, canUseAi]);

  useEffect(() => {
    setAiSelected(false);
    setAttempts(null);
    if (!canUseAi) return;
    void refreshAttempts();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') void refreshAttempts();
    };
    window.addEventListener('focus', refreshWhenVisible);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      requestVersion.current += 1;
      window.removeEventListener('focus', refreshWhenVisible);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [canUseAi, refreshAttempts]);

  const aiAvailable = canUseAi && (attempts?.remaining ?? 0) > 0;
  const useAi = aiAvailable && aiSelected;
  const numberFormat = new Intl.NumberFormat(isAr ? 'ar-EG' : 'en-GB');

  const [inputText, setInputText] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessingAI, setIsProcessingAI] = useState(false);
  const showNotice = useAppNotice();
  const [speechError, setSpeechError] = useState<string | null>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  // Synchronous guard: rapid taps must not start multiple analyzer requests.
  const processingRequestRef = useRef(false);
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
    if (!subscriptionExpired) return;
    recordingActiveRef.current = false;
    clearTimeout(restartTimerRef.current ?? undefined);
    restartTimerRef.current = null;
    try { recognitionRef.current?.abort?.(); } catch { /* ignore */ }
    setIsRecording(false); setIsListening(false);
    setInputText(''); setPendingVoiceReview(false);
  }, [subscriptionExpired]);

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
  const processInput = async (rawText: string, inputSource: 'voice' | 'text', originalTranscript: string, useCloudAi: boolean, retry = false) => {
    const text = rawText.trim();
    if (subscriptionExpired) { onExpiredAttempt?.(); return; }
    if (!text) return;
    if (text.length > 300) {
      showNotice(isAr ? 'الحد الأقصى لنص العملية أو السؤال 300 حرف.' : 'Maximum transaction or query length is 300 characters.', lang, 'warning');
      return;
    }

    if (processingRequestRef.current) return;
    processingRequestRef.current = true;
    setIsProcessingAI(true);

    const userId = auth.currentUser?.uid;
    let analyzed = false;
    try {
      const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Cairo';
      const now = new Date();
      // Format local ISO
      const localISO = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString();

      const analyzer = guestDemo ? aiClient : useCloudAi ? geminiClient : quotaLocalClient;
      const result: AIInterpretationResult = await analyzer.interpret({
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
      if (auth.currentUser?.uid !== userId || (retry && window.location.pathname !== '/transactions/new')) return;
      const engineNotice = result.engineUsed === 'local-fallback'
        ? (result.geminiFallbackReason === 'limit'
          ? (isAr ? 'انتهت حصة الذكاء الاصطناعي اليوم. تم تحليل النص بالطريقة العادية.' : 'AI’s daily allowance is used up. Standard analysis handled this request.')
          : (isAr ? 'الذكاء الاصطناعي غير متاح مؤقتًا. تم تحليل النص بالطريقة العادية.' : 'AI is temporarily unavailable. Standard analysis handled this request.'))
        : null;

      if (retry && result.engineUsed === 'local-fallback') {
        if (engineNotice) showNotice(engineNotice, lang);
        return;
      }

      if (result.intent === 'FINANCIAL_QUERY') {
        if (retry) {
          showNotice(isAr ? 'اتفسّر النص كسؤال مالي. تقدر تكمل مراجعة العملية الحالية.' : 'The text was understood as a financial question. You can keep reviewing the current draft.', lang, 'warning');
          return;
        }
        analyzed = useCloudAi || !aiAvailable;
        if (engineNotice) showNotice(engineNotice, lang);
        onFinancialQuery(
          result.query || { metric: 'total_spent', period: 'all_time', transactionType: 'expense' },
          text
        );
      } else if (result.intent === 'CREATE_TRANSACTION' && result.transaction) {
        if (engineNotice) showNotice(engineNotice, lang);
        analyzed = true;
        const tx = result.transaction;

        // Build transaction draft
        const draft: Partial<Transaction> = {
          type: tx.type || 'expense',
          amount: tx.amount || undefined,
          currency: (tx.currency as CurrencyCode) || accounts[0]?.currency || 'EGP',
          accountId: tx.accountId || undefined,
          toAccountId: tx.toAccountId || undefined,
          categoryId: tx.categoryId || undefined,
          description: tx.description ?? '',
          date: tx.date || localISO.slice(0, 10),
          time: tx.time || localISO.slice(11, 16),
        };

        onTransactionDraft(draft, tx.missingFields || [], {
          analyzedText:text,
          originalText:inputSource==='voice' ? (originalTranscript.trim() || text) : text,
          entryTicket: result.entryTicket, inputSource,analysisId:crypto.randomUUID(),appRevision:APP_REVISION,
        }, !useCloudAi && aiAvailable ? () => processInput(text, inputSource, originalTranscript, true, true) : undefined);
      } else if (!retry && result.intent === 'CORRECT_PROPOSAL' && result.correction) {
        analyzed = true;
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
        showNotice(aiDisplayText(clarification, lang), lang, 'warning');
      }
    } catch (err) {
      console.error('AI processing error:', err);
      showNotice(
        isAr
          ? (err instanceof Error && err.message ? aiDisplayText(err.message, lang) : 'تعذر تحليل النص، يرجى مراجعة البيانات والمحاولة مرة أخرى')
          : 'Could not analyze text; review your input and try again',
        lang,
        'warning',
      );
    } finally {
      if (useCloudAi) {
        setAiSelected(false);
        void refreshAttempts();
      }
      processingRequestRef.current = false;
      setIsProcessingAI(false);
      if (analyzed) {
        setInputText('');
        segmentBaseRef.current = '';
        latestSegmentRef.current = '';
      }
    }
  };

  // Prefer continuous recognition. Restart only if the browser ends its session
  // before the user presses Finish Recording.
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      recognitionRef.current = null;
      return;
    }

    const recognition = new SpeechRecognition() as SpeechRecognitionLike;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = speechLanguage;
    recognitionRef.current = recognition;

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
      latestSegmentRef.current = '';
      setIsListening(true);
      setSpeechError(null);
    };

    recognition.onresult = event => {
      if (recognitionRef.current !== recognition) return;
      // Each event contains the whole session, including revisions to earlier
      // interim text. Replace the snapshot instead of appending each event.
      const segment = Array.from(event.results, result => result[0]?.transcript.trim() ?? '')
        .filter(Boolean)
        .join(' ');
      if (segment) {
        latestSegmentRef.current = segment;
        setInputText([segmentBaseRef.current, segment].filter(Boolean).join(' ').slice(0,300));
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
      if (recognitionRef.current !== recognition) return;
      setIsListening(false);
      const segment = latestSegmentRef.current.trim();
      if (segment) {
        // Append this completed session once, then reset for the next one.
        segmentBaseRef.current = [segmentBaseRef.current, segment].filter(Boolean).join(' ').slice(0,300);
        setInputText(segmentBaseRef.current);
      }
      latestSegmentRef.current = '';

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
      if (recognitionRef.current === recognition) recognitionRef.current = null;
      try { recognition.abort?.(); } catch { try { recognition.stop(); } catch {} }
    };
  }, [speechLanguage, t.speechNotSupported]);

  const handleToggleMic = () => {
    if (subscriptionExpired) { onExpiredAttempt?.(); return; }
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
    if (subscriptionExpired) { onExpiredAttempt?.(); return; }
    if (isRecording) {
      finishVoiceRecording();
      return;
    }
    if (!inputText.trim() || isProcessingAI || processingRequestRef.current) return;
    setPendingVoiceReview(false);
    void processInput(inputText, pendingVoiceReview ? 'voice' : 'text', segmentBaseRef.current, useAi);
  };

  const showSend = Boolean(inputText.trim()) && !isProcessingAI && !isRecording;

  return (
    <div className="space-y-2">
      {/* Primary Big Voice / Text Card with Gemini AI styling */}
      <form
        onSubmit={handleFormSubmit}
        className={`bg-white rounded-3xl border transition-all shadow-xs p-4 sm:p-5 flex flex-wrap items-start justify-between gap-3 ${
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
            readOnly={isRecording || subscriptionExpired}
            onFocus={() => { if (subscriptionExpired) { inputRef.current?.blur(); onExpiredAttempt?.(); } }}
            onClick={() => { if (subscriptionExpired) onExpiredAttempt?.(); }}
            dir={isAr ? 'rtl' : 'ltr'}
            value={inputText}
            maxLength={300}
            onChange={(e) => { if (subscriptionExpired) { onExpiredAttempt?.(); return; } setInputText(e.target.value.slice(0,300)); }}
            placeholder={
              isRecording
                ? t.listening
                : isProcessingAI
                ? isAr
                  ? 'جاري تجهيز البيانات...'
                  : 'Preparing details...'
                : isAr
                ? 'اكتب أو قل أي عملية أو سؤال مالي...'
                : 'Type or speak any transaction or question...'
            }
            className={`block w-full min-h-[92px] max-h-[240px] resize-none overflow-y-auto whitespace-pre-wrap break-words leading-relaxed font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none bg-transparent disabled:opacity-60 ${transcriptSizeClass}`}
            aria-label={isAr ? 'نص العملية أو السؤال المالي' : 'Transaction or financial question'}
          />
          <p aria-live="polite" className={`text-end text-[11px] font-semibold ${300 - inputText.length <= 15 ? 'text-red-600' : 'text-slate-500'}`}>{isAr ? `المتبقي: ${300 - inputText.length} حرف` : `Remaining: ${300 - inputText.length} characters`}</p>
          <p className="text-[11px] sm:text-xs text-slate-400 font-medium mt-1">
            {isRecording ? (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping inline-block" />
                {isAr ? 'التسجيل مستمر حتى تضغط إنهاء التسجيل؛ يمكنك التوقف والتفكير ثم المتابعة.' : 'Recording continues until you tap Finish recording; pause and resume speaking freely.'}
              </span>
            ) : isProcessingAI ? (
              <span className="text-indigo-600 font-bold flex items-center gap-1">
                <Sparkles className="w-3 h-3 animate-spin text-indigo-500 inline-block" />
                {isAr ? 'جاري تجهيز طلبك...' : 'Preparing your request...'}
              </span>
            ) : pendingVoiceReview ? (
              <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                <Sparkles className="w-3 h-3 shrink-0" />
                {isAr
                  ? 'عدّل النص لو محتاج، ثم اضغط زر التحليل.'
                  : 'Edit the transcript if needed, then tap Analyze.'}
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
          {showSend && (
            <button
              type="submit"
              className="flex w-16 cursor-pointer flex-col items-center gap-1 rounded-lg text-center text-[10px] font-bold leading-tight text-slate-700 focus-visible:outline-2 focus-visible:outline-emerald-600 sm:w-20"
            >
              <span className="flex size-10 items-center justify-center rounded-full bg-slate-900 text-white shadow-xs transition-transform hover:bg-slate-800 active:scale-95">
                <Send className="size-4" aria-hidden="true" />
              </span>
              <span>{useAi ? (isAr ? 'حلّل بالذكاء الاصطناعي' : 'Analyze with AI') : (isAr ? 'حلّل النص' : 'Analyze text')}</span>
            </button>
          )}

          <div className="flex flex-col items-center gap-1 shrink-0">
            <button
              type="button"
              disabled={isProcessingAI}
              onClick={handleToggleMic}
              aria-label={isRecording ? (isAr ? 'إنهاء التسجيل' : 'Finish recording') : (isAr ? 'بدء التسجيل الصوتي' : 'Start voice recording')}
              className={`w-12 h-12 rounded-full flex items-center justify-center text-white transition-all cursor-pointer shadow-md disabled:opacity-50 ${
                isRecording
                  ? 'bg-red-600 hover:bg-red-700 animate-pulse ring-4 ring-red-500/20 shadow-red-500/30'
                  : isProcessingAI
                  ? 'bg-indigo-600 shadow-indigo-500/25'
                  : 'bg-emerald-500 hover:bg-emerald-600 active:scale-95 shadow-emerald-500/25'
              }`}
              title={isRecording ? (isAr ? 'إنهاء التسجيل' : 'Finish recording') : (isAr ? 'تحدث للمساعد المالي' : 'Speak to the financial assistant')}
            >
              {isProcessingAI ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isRecording ? (
                <MicOff className="w-5 h-5" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>
            {isRecording && (
              <span className="text-[10px] leading-tight whitespace-nowrap font-bold text-red-600">
                {isAr ? 'إنهاء التسجيل' : 'Finish recording'}
              </span>
            )}
          </div>
        </div>
        {canUseAi && <div className={`flex w-full flex-wrap items-center justify-between gap-x-3 text-xs ${showSend ? 'order-first border-b border-slate-100 pb-2' : 'border-t border-slate-100 pt-2'}`}>
          <label className="inline-flex min-h-9 items-center gap-2 font-semibold text-slate-800">
            <input type="checkbox" className="size-4 accent-emerald-700" checked={useAi}
              onChange={event => setAiSelected(event.target.checked)} disabled={!aiAvailable || isProcessingAI || isRecording} />
            {isAr ? 'استخدم الذكاء الاصطناعي' : 'Use AI'}
          </label>
          <span aria-live="polite" className="text-slate-600">
            {attempts
              ? (isAr ? `متبقي ${numberFormat.format(attempts.remaining)} من ${numberFormat.format(attempts.limit)} محاولة اليوم`
                : `${numberFormat.format(attempts.remaining)} of ${numberFormat.format(attempts.limit)} attempts left today`)
              : <button type="button" className="underline" onClick={() => void refreshAttempts()}>{isAr ? 'تحديث الحصة' : 'Refresh allowance'}</button>}
          </span>
        </div>}
        {showSend && <p className="w-full border-t border-slate-100 pt-2 text-xs text-slate-600">
          {isAr ? 'قد يخطئ التحليل. راجع الحقول وعدّلها عند الحاجة، ثم أكّد العملية لحفظها.'
            : 'Analysis can make mistakes. Review the fields, edit them if needed, then confirm to save.'}
        </p>}
      </form>

      {/* Speech Hint / Error if any */}
      {speechError && (
        <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
          <HelpCircle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
          <span>{speechError}</span>
        </div>
      )}


    </div>
  );
}
