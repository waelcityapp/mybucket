import { interpretLocalFinancialRequest } from './localFinancialInterpreter';
import {
  AIInterpretationRequest,
  AIInterpretationResult,
  AIInterpretationProvider,
} from './types';
import { parseNaturalLanguageInput } from '../../utils/naturalLanguageParser';
import { isFinancialQueryText, parseSemanticNumberRoles } from '../../utils/semanticParser';
import { FinancialAccount, Category } from '../../types';
import { aiLearnedMemory } from './aiLearnedMemory';
import { auth } from '../../lib/firebase';
import {
  matchCategoryFromText,
  matchAccountFromText,
  matchExplicitAccountFromText,
  matchDescriptionEdit,
  matchAmountEdit,
  matchTransactionType,
  matchTransferAccountsFromText,
} from '../../utils/entityMatcher';

export class GeminiAIClient implements AIInterpretationProvider {
  async interpret(request: AIInterpretationRequest): Promise<AIInterpretationResult> {
    try {
      const payload: AIInterpretationRequest = {
        ...request,
        learnedMemory: request.learnedMemory || aiLearnedMemory.getLearnedList().slice(0, 50),
      };

      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('Google authentication is required for AI operations');
      }
      const idToken = await currentUser.getIdToken();

      const response = await fetch('/api/gateway', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ action: 'ai.interpret', payload }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const gatewayResponse = await response.json();
      if (!gatewayResponse?.ok || !gatewayResponse?.data) {
        throw new Error(gatewayResponse?.message || 'Gateway returned an invalid response');
      }
      return this.validateAndSanitize(gatewayResponse.data as AIInterpretationResult, request);
    } catch (err) {
      console.warn('AI Server call failed or offline, using safe fallback parser:', err);
      return this.fallbackInterpretation(request);
    }
  }

  /**
   * Validates and sanitizes the structured output returned by Gemini.
   */
  private validateAndSanitize(
    data: AIInterpretationResult,
    request: AIInterpretationRequest
  ): AIInterpretationResult {
    const raw = request.text.trim();
    const isQuery = isFinancialQueryText(raw);
    const semanticRoles = parseSemanticNumberRoles(raw, new Date(request.currentDateTime));
    const isSaveRequest = /احفظ|سجل|أكد|اكد|تمام احفظ|تأكيد|حفظ العملية|احفظها|سجلها|اعتمد|save|confirm/i.test(raw);

    // 1. Validate Intent
    let intent = data.intent;
    if (isSaveRequest) {
      intent = 'SAVE_REQUEST';
    } else if (isQuery) {
      intent = 'FINANCIAL_QUERY';
    } else if (!['CREATE_TRANSACTION', 'FINANCIAL_QUERY', 'CORRECT_PROPOSAL', 'SAVE_REQUEST', 'UNKNOWN'].includes(intent)) {
      intent = 'UNKNOWN';
    }

    if (intent === 'SAVE_REQUEST') {
      const saveNotice = request.lang === 'ar' ? 'من فضلك اضغط على زر تأكيد وحفظ' : 'Please click on the Confirm & Save button';
      return {
        intent: 'SAVE_REQUEST',
        confidence: 1.0,
        transaction: null,
        query: null,
        correction: null,
        clarificationNeeded: saveNotice,
        rawInterpretationSummary: saveNotice,
      };
    }

    // 2. If intent is FINANCIAL_QUERY, transaction is ALWAYS strictly null
    let transaction = intent === 'FINANCIAL_QUERY' ? null : data.transaction;
    let query = data.query;

    if (intent === 'FINANCIAL_QUERY') {
      if (!query) query = {} as any;
      if (semanticRoles.dateFrom && semanticRoles.dateTo) {
        query.period = 'custom';
        query.startDate = semanticRoles.dateFrom;
        query.endDate = semanticRoles.dateTo;
      } else if (semanticRoles.specificDateStr) {
        query.period = 'custom';
        query.startDate = semanticRoles.specificDateStr;
        query.endDate = semanticRoles.specificDateStr;
      }

      const lower = raw.toLowerCase();
      if (lower.includes('بنزين') || lower.includes('fuel')) {
        const fuelCat = request.categories.find(
          (c) => c.nameAr.includes('مواصلات') || c.name.toLowerCase().includes('transport')
        );
        query.categoryId = fuelCat?.id || query.categoryId;
        query.categoryName = 'بنزين';
        query.metric = 'category_spent';
        query.transactionType = 'expense';
      }
    } else if (intent === 'CORRECT_PROPOSAL' || request.currentProposal) {
      intent = 'CORRECT_PROPOSAL';
      const base = request.currentProposal || {};
      const changes: string[] = [];
      let fieldToUpdate = data.correction?.fieldToUpdate || '';
      let newValue = data.correction?.newValue || '';

      // Normalize raw type
      let cleanType: 'expense' | 'income' | 'transfer' = (base.type as any) || 'expense';
      const parsedType = (transaction?.type || '').toLowerCase();
      if (parsedType.includes('income') || parsedType.includes('دخل')) {
        cleanType = 'income';
      } else if (parsedType.includes('transfer') || parsedType.includes('تحويل')) {
        cleanType = 'transfer';
      } else if (parsedType.includes('expense') || parsedType.includes('صرف') || parsedType.includes('مصروف')) {
        cleanType = 'expense';
      }

      // Check explicit type correction
      const typeOverride = matchTransactionType(raw);
      if (typeOverride) {
        cleanType = typeOverride;
        fieldToUpdate = 'type';
        newValue = typeOverride;
        changes.push(`النوع إلى ${typeOverride === 'expense' ? 'مصروف' : typeOverride === 'income' ? 'دخل' : 'تحويل'}`);
      }

      // Category matching
      let categoryId = transaction?.categoryId || base.categoryId || null;
      const matchedCat = matchCategoryFromText(raw, request.categories);
      if (matchedCat) {
        categoryId = matchedCat.id;
        fieldToUpdate = 'categoryId';
        newValue = matchedCat.id;
        changes.push(`التصنيف إلى ${matchedCat.nameAr}`);
      }

      // Account matching
      let accountId = transaction?.accountId || base.accountId || null;
      const matchedAcc = matchAccountFromText(raw, request.accounts);
      if (matchedAcc) {
        accountId = matchedAcc.id;
        fieldToUpdate = 'accountId';
        newValue = matchedAcc.id;
        changes.push(`الحساب إلى ${matchedAcc.nameAr}`);
      }

      // Amount matching
      let amount = typeof transaction?.amount === 'number' && transaction.amount > 0 ? transaction.amount : base.amount;
      const matchedAmount = matchAmountEdit(raw) ?? semanticRoles.amount;
      if (matchedAmount !== null && matchedAmount > 0) {
        amount = matchedAmount;
        fieldToUpdate = 'amount';
        newValue = String(matchedAmount);
        changes.push(`المبلغ إلى ${matchedAmount}`);
      }

      // Description / Notes matching
      let description = transaction?.description ?? base.description ?? '';
      const matchedDesc = matchDescriptionEdit(raw);
      if (matchedDesc) {
        description = matchedDesc;
        fieldToUpdate = 'description';
        newValue = matchedDesc;
        changes.push(`الملاحظات إلى "${matchedDesc}"`);
      }

      const summary = changes.length > 0
        ? `تم تعديل ${changes.join(' و')}`
        : data.rawInterpretationSummary || 'تم تحديث بيانات العملية';

      transaction = {
        type: cleanType,
        amount: typeof amount === 'number' ? amount : null,
        currency: (accountId && request.accounts.find((a) => a.id === accountId)?.currency) || base.currency || 'EGP',
        accountId,
        toAccountId: transaction?.toAccountId || base.toAccountId || null,
        categoryId,
        description,
        date: transaction?.date || base.date || request.currentDateTime.slice(0, 10),
        time: transaction?.time || base.time || request.currentDateTime.slice(11, 16),
        missingFields: accountId ? [] : ['accountId'],
        confidence: data.confidence || 0.95,
      };

      return {
        intent: 'CORRECT_PROPOSAL',
        confidence: data.confidence || 0.95,
        transaction,
        query: null,
        correction: fieldToUpdate ? { fieldToUpdate, newValue } : data.correction || null,
        clarificationNeeded: null,
        rawInterpretationSummary: summary,
      };
    } else if (intent === 'CREATE_TRANSACTION') {
      if (!transaction) {
        return this.fallbackInterpretation(request);
      }

      // Only accept an account explicitly named by the user, never an AI guess or learned memory.
      // For transfers, the form asks the user to choose both ends explicitly.
      const explicitAccount = transaction.type === 'transfer' ? null : matchExplicitAccountFromText(raw, request.accounts);
      const matchedAccountId: string | null = explicitAccount?.id || null;

      // Check category validity
      let matchedCategoryId: string | null = null;
      if (transaction.categoryId) {
        const foundCat = request.categories.find((c) => c.id === transaction?.categoryId);
        if (foundCat) {
          matchedCategoryId = foundCat.id;
        }
      }

      // Number role safety: ensure transaction amount is valid and not a date or time number
      let amount = typeof transaction.amount === 'number' && transaction.amount > 0 ? transaction.amount : null;
      if (semanticRoles.amount !== null) {
        amount = semanticRoles.amount;
      }

      // If account wasn't resolved, it's missing! NEVER invent an account!
      const missingFields: string[] = [...(transaction.missingFields || [])];
      if (!matchedAccountId && !missingFields.includes('accountId')) {
        missingFields.push('accountId');
      }

      transaction = {
        type: transaction.type || 'expense',
        amount,
        currency: transaction.currency || request.accounts[0]?.currency || 'EGP',
        accountId: matchedAccountId,
        toAccountId: transaction.type === 'transfer' ? null : transaction.toAccountId || null,
        categoryId: matchedCategoryId,
        description: transaction.description ? transaction.description.trim() : null,
        date: semanticRoles.specificDateStr || transaction.date || request.currentDateTime.slice(0, 10),
        time: semanticRoles.specificTimeStr || transaction.time || request.currentDateTime.slice(11, 16),
        missingFields,
        confidence: data.confidence || 0.9,
      };
    }

    return {
      intent,
      confidence: data.confidence || 0.85,
      transaction,
      query: query || null,
      correction: data.correction || null,
      clarificationNeeded: data.clarificationNeeded || null,
      rawInterpretationSummary: data.rawInterpretationSummary || null,
    };
  }

  /**
   * Safe offline fallback parser using rule-based heuristics if backend is unreachable.
   */
  public fallbackInterpretation(request: AIInterpretationRequest): AIInterpretationResult {
    return interpretLocalFinancialRequest(request);
  }
}

// Basic uses the deterministic local interpreter and never calls the AI gateway.
// Pro trial and paid Pro are routed to geminiClient by VoiceNaturalInput; the
// server independently checks the user's entitlement before processing Gemini.
export const geminiClient: AIInterpretationProvider = new GeminiAIClient();
export const aiClient: AIInterpretationProvider = {
  async interpret(request: AIInterpretationRequest): Promise<AIInterpretationResult> {
    return interpretLocalFinancialRequest(request);
  },
};
