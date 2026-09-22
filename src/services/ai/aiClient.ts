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

      // Check account validity against user's actual accounts
      let matchedAccountId: string | null = null;
      if (transaction.accountId) {
        const found = request.accounts.find((a) => a.id === transaction?.accountId);
        if (found) {
          matchedAccountId = found.id;
        }
      }

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
        toAccountId: transaction.toAccountId || null,
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
  private fallbackInterpretation(request: AIInterpretationRequest): AIInterpretationResult {
    const raw = request.text.trim();
    const lower = raw.toLowerCase();

    // Check for save request
    const isSaveRequest = /احفظ|سجل|أكد|اكد|تمام احفظ|تأكيد|حفظ العملية|احفظها|سجلها|اعتمد|save|confirm/i.test(raw);
    if (isSaveRequest) {
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

    const isQuery = isFinancialQueryText(raw);
    const semanticRoles = parseSemanticNumberRoles(raw, new Date(request.currentDateTime));

    // Handle modification of open draft in modal
    if (request.currentProposal) {
      const base: Partial<any> = { ...request.currentProposal };
      const changes: string[] = [];
      let fieldToUpdate = '';
      let newValue: any = '';

      // Type modification
      const typeOverride = matchTransactionType(raw);
      if (typeOverride) {
        base.type = typeOverride;
        fieldToUpdate = 'type';
        newValue = typeOverride;
        changes.push(`النوع إلى ${typeOverride === 'expense' ? 'مصروف' : typeOverride === 'income' ? 'دخل' : 'تحويل'}`);
      }

      // Amount modification
      const matchedAmount = matchAmountEdit(raw) ?? semanticRoles.amount;
      if (matchedAmount !== null && matchedAmount > 0) {
        base.amount = matchedAmount;
        fieldToUpdate = 'amount';
        newValue = matchedAmount;
        changes.push(`المبلغ إلى ${matchedAmount}`);
      }

      // Notes/Description modification
      const matchedDesc = matchDescriptionEdit(raw);
      if (matchedDesc) {
        base.description = matchedDesc;
        fieldToUpdate = 'description';
        newValue = matchedDesc;
        changes.push(`الملاحظات إلى "${matchedDesc}"`);
      }

      // Category matching
      const matchedCat = matchCategoryFromText(raw, request.categories);
      if (matchedCat) {
        base.categoryId = matchedCat.id;
        fieldToUpdate = 'categoryId';
        newValue = matchedCat.id;
        changes.push(`التصنيف إلى ${matchedCat.nameAr}`);
      } else if (typeOverride && typeOverride !== 'transfer' && base.categoryId) {
        const catObj = request.categories.find((c) => c.id === base.categoryId);
        if (catObj && catObj.type !== (typeOverride === 'income' ? 'income' : 'expense')) {
          const compatibleCat = request.categories.find((c) => c.type === (typeOverride === 'income' ? 'income' : 'expense'));
          if (compatibleCat) {
            base.categoryId = compatibleCat.id;
            changes.push(`التصنيف إلى ${compatibleCat.nameAr}`);
          }
        }
      }

      // Account matching
      if (base.type === 'transfer') {
        const transferAccs = matchTransferAccountsFromText(raw, request.accounts, base.accountId);
        if (transferAccs.fromAccount) {
          base.accountId = transferAccs.fromAccount.id;
          base.currency = transferAccs.fromAccount.currency;
        }
        if (transferAccs.toAccount) {
          base.toAccountId = transferAccs.toAccount.id;
          changes.push(`إلى حساب ${transferAccs.toAccount.nameAr}`);
        } else if (!base.toAccountId || base.toAccountId === base.accountId) {
          const otherAcc = request.accounts.find((a) => a.id !== base.accountId);
          if (otherAcc) {
            base.toAccountId = otherAcc.id;
            changes.push(`إلى حساب ${otherAcc.nameAr}`);
          }
        }
      } else {
        const matchedAcc = matchAccountFromText(raw, request.accounts);
        if (matchedAcc) {
          base.accountId = matchedAcc.id;
          base.currency = matchedAcc.currency;
          fieldToUpdate = 'accountId';
          newValue = matchedAcc.id;
          changes.push(`الحساب إلى ${matchedAcc.nameAr}`);
        }
      }

      const summary = changes.length > 0
        ? `تم تعديل ${changes.join(' و')}`
        : (request.lang === 'ar' ? 'تم تحديث بيانات العملية' : 'Transaction draft updated');

      return {
        intent: 'CORRECT_PROPOSAL',
        confidence: 0.95,
        transaction: {
          type: base.type || 'expense',
          amount: typeof base.amount === 'number' ? base.amount : null,
          currency: base.currency || 'EGP',
          accountId: base.accountId || null,
          toAccountId: base.toAccountId || null,
          categoryId: base.categoryId || null,
          description: base.description || '',
          date: base.date || request.currentDateTime.slice(0, 10),
          time: base.time || request.currentDateTime.slice(11, 16),
          missingFields: base.accountId ? [] : ['accountId'],
        },
        query: null,
        correction: fieldToUpdate ? { fieldToUpdate, newValue } : null,
        clarificationNeeded: null,
        rawInterpretationSummary: summary,
      };
    }

    if (isQuery) {
      let period: any = 'this_month';
      let startDate: string | undefined = undefined;
      let endDate: string | undefined = undefined;

      if (semanticRoles.dateFrom && semanticRoles.dateTo) {
        period = 'custom';
        startDate = semanticRoles.dateFrom;
        endDate = semanticRoles.dateTo;
      } else if (semanticRoles.specificDateStr) {
        period = 'custom';
        startDate = semanticRoles.specificDateStr;
        endDate = semanticRoles.specificDateStr;
      } else if (lower.includes('النهاردة') || lower.includes('اليوم') || lower.includes('today')) {
        period = 'today';
      } else if (lower.includes('امبارح') || lower.includes('أمس') || lower.includes('yesterday')) {
        period = 'yesterday';
      } else if (lower.includes('الاسبوع ده') || lower.includes('الأسبوع ده') || lower.includes('this week')) {
        period = 'this_week';
      } else if (lower.includes('الاسبوع اللي فات') || lower.includes('last week')) {
        period = 'last_week';
      } else if (lower.includes('الشهر ده') || lower.includes('this month')) {
        period = 'this_month';
      }

      let metric: any = 'total_spent';
      let targetAccount: string | null = null;
      let targetCategoryId: string | null = null;
      let targetCategoryName: string | null = null;

      if (lower.includes('بنزين') || lower.includes('fuel')) {
        metric = 'category_spent';
        const fuelCat = request.categories.find(
          (c) => c.nameAr.includes('مواصلات') || c.name.toLowerCase().includes('transport')
        );
        targetCategoryId = fuelCat?.id || null;
        targetCategoryName = 'بنزين';
      } else if (lower.includes('أكل') || lower.includes('اكل') || lower.includes('مطعم') || lower.includes('طعام')) {
        metric = 'category_spent';
        const foodCat = request.categories.find(
          (c) => c.nameAr.includes('طعام') || c.name.toLowerCase().includes('food')
        );
        targetCategoryId = foodCat?.id || null;
        targetCategoryName = 'طعام';
      } else if (lower.includes('رصيد') || lower.includes('معايا كام') || lower.includes('balance')) {
        metric = 'account_balance';
        if (lower.includes('كاش') || lower.includes('نقدي')) {
          targetAccount = request.accounts.find((a) => a.type === 'cash')?.id || null;
        } else if (lower.includes('بنك')) {
          targetAccount = request.accounts.find((a) => a.type === 'bank')?.id || null;
        } else if (lower.includes('فيزا')) {
          targetAccount = request.accounts.find((a) => a.type === 'card')?.id || null;
        }
      } else if (lower.includes('دخل') || lower.includes('قبضت') || lower.includes('مرتب') || lower.includes('income')) {
        metric = 'total_income';
      }

      return {
        intent: 'FINANCIAL_QUERY',
        confidence: 0.95,
        transaction: null,
        query: {
          metric,
          period,
          startDate,
          endDate,
          categoryId: targetCategoryId || undefined,
          categoryName: targetCategoryName || undefined,
          accountId: targetAccount,
          transactionType: 'expense',
        },
        correction: null,
        clarificationNeeded: null,
        rawInterpretationSummary: 'Deterministic parsed financial query',
      };
    }

    // Default to transaction creation
    const localAccounts = request.accounts.map((a) => ({
      ...a,
      balance: 0,
      createdAt: '',
    })) as FinancialAccount[];
    const localCategories = request.categories as Category[];

    const draft = parseNaturalLanguageInput(raw, localAccounts, localCategories);

    // If account was not mentioned explicitly in raw text, mark as missing!
    const mentionedAccount =
      lower.includes('كاش') ||
      lower.includes('نقدي') ||
      lower.includes('بنك') ||
      lower.includes('فيزا') ||
      lower.includes('كارت') ||
      lower.includes('cash') ||
      lower.includes('bank') ||
      lower.includes('visa') ||
      lower.includes('card');

    const missingFields: string[] = [];
    if (!mentionedAccount) {
      missingFields.push('accountId');
    }

    const finalAmount = semanticRoles.amount !== null ? semanticRoles.amount : draft.amount;
    const finalDate = semanticRoles.specificDateStr || draft.date;
    const finalTime = semanticRoles.specificTimeStr || draft.time;

    return {
      intent: 'CREATE_TRANSACTION',
      confidence: 0.9,
      transaction: {
        type: draft.type,
        amount: finalAmount,
        currency: draft.currency,
        accountId: mentionedAccount ? draft.accountId : null,
        toAccountId: draft.toAccountId || null,
        categoryId: draft.categoryId || null,
        description: draft.description,
        date: finalDate,
        time: finalTime,
        missingFields,
      },
      query: null,
      correction: null,
      clarificationNeeded: null,
      rawInterpretationSummary: 'Deterministic parsed transaction',
    };
  }
}

// Export singleton instance conforming to provider interface
export const aiClient: AIInterpretationProvider = new GeminiAIClient();
