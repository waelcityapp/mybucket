import {
  AIInterpretationRequest,
  AIInterpretationResult,
  AIInterpretationProvider,
} from './types';
import { parseNaturalLanguageInput } from '../../utils/naturalLanguageParser';
import { isFinancialQueryText, parseSemanticNumberRoles } from '../../utils/semanticParser';
import { FinancialAccount, Category } from '../../types';

export class GeminiAIClient implements AIInterpretationProvider {
  async interpret(request: AIInterpretationRequest): Promise<AIInterpretationResult> {
    try {
      const response = await fetch('/api/ai/interpret', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data: AIInterpretationResult = await response.json();
      return this.validateAndSanitize(data, request);
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

    // 1. Validate Intent (Queries must NEVER be classified as CREATE_TRANSACTION)
    let intent = data.intent;
    if (isQuery) {
      intent = 'FINANCIAL_QUERY';
    } else if (!['CREATE_TRANSACTION', 'FINANCIAL_QUERY', 'CORRECT_PROPOSAL', 'UNKNOWN'].includes(intent)) {
      intent = 'UNKNOWN';
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
    const isQuery = isFinancialQueryText(raw);
    const semanticRoles = parseSemanticNumberRoles(raw, new Date(request.currentDateTime));

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
