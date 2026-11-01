import { AIInterpretationRequest, AIInterpretationResult } from './types';
import { parseNaturalDateTime } from '../../utils/dateTime';
import { findRelativeDayPhrase } from '../../utils/relativeDayPhrase';
import { hasTodayDateExpression } from '../../utils/todayDateExpression';
import { parseNaturalLanguageInput } from '../../utils/naturalLanguageParser';
import { isFinancialQueryText, parseSemanticNumberRoles } from '../../utils/semanticParser';
import { FinancialAccount, Category } from '../../types';
import {
  matchCategoryFromText, matchAccountFromText, matchExplicitAccountFromText,
  matchDescriptionEdit, matchAmountEdit, matchTransactionType,
  matchTransferAccountsFromText,
} from '../../utils/entityMatcher';
import { classifyLocalIntent } from './localIntentRouter';

// currentDateTime is the user's LOCAL wall-clock ISO with a Z-shaped suffix.
// Interpret its fields as local, rather than shifting across Cairo midnight.
function localReferenceDate(value: string): Date {
  const m = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return new Date();
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], 0);
}

/** Fully local interpretation; cannot contact Gemini or any other language model. */
export function interpretLocalFinancialRequest(request: AIInterpretationRequest): AIInterpretationResult {
    const raw = request.text.trim();
    const lower = raw.toLowerCase();

    // Check for save request
    const command = classifyLocalIntent(raw, Boolean(request.currentProposal));
    const isSaveRequest = command === 'SAVE_REQUEST';
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
    const semanticRoles = parseSemanticNumberRoles(raw, localReferenceDate(request.currentDateTime));

    // Handle modification of open draft in modal
    if (request.currentProposal) {
      const base: Partial<any> = { ...request.currentProposal };
      const noteCorrection = matchDescriptionEdit(raw);
      // A notes-only command must never change amount, type, account or category,
      // even if the user's note contains numbers or financial keywords.
      const isNotesOnlyEdit = Boolean(noteCorrection) &&
        /^\s*(?:(?:غير|عدل|خلي|اكتب في|بدل)\s+)?(?:خانة\s*)?(?:الملاحظات|الملاحظه|الوصف|البيان|نوتس|notes)(?=\s|:|$)/i.test(raw);
      const changes: string[] = [];
      let fieldToUpdate = '';
      let newValue: any = '';

      // Type modification
      const typeOverride = isNotesOnlyEdit ? null : matchTransactionType(raw);
      if (typeOverride) {
        base.type = typeOverride;
        fieldToUpdate = 'type';
        newValue = typeOverride;
        changes.push(`النوع إلى ${typeOverride === 'expense' ? 'مصروف' : typeOverride === 'income' ? 'دخل' : 'تحويل'}`);
      }

      // Amount modification
      const matchedAmount = isNotesOnlyEdit ? null : (matchAmountEdit(raw) ?? semanticRoles.amount);
      if (matchedAmount !== null && matchedAmount > 0) {
        base.amount = matchedAmount;
        fieldToUpdate = 'amount';
        newValue = matchedAmount;
        changes.push(`المبلغ إلى ${matchedAmount}`);
      }

      // Notes/Description modification
      const matchedDesc = noteCorrection;
      if (matchedDesc) {
        base.description = matchedDesc;
        fieldToUpdate = 'description';
        newValue = matchedDesc;
        changes.push(`الملاحظات إلى "${matchedDesc}"`);
      }

      const dateCommand = /(?:^|\s)(?:التاريخ|تاريخ|date)(?=\s|:|$)/i.test(raw);
      const timeCommand = /(?:^|\s)(?:الوقت|الساعة|time)(?=\s|:|$)/i.test(raw);
      if (!isNotesOnlyEdit && dateCommand) {
        const calculated = parseNaturalDateTime(raw, localReferenceDate(request.currentDateTime));
        const explicit = parseSemanticNumberRoles(raw, localReferenceDate(request.currentDateTime)).specificDateStr;
        const hasDate = Boolean(findRelativeDayPhrase(raw)) ||
          (hasTodayDateExpression(raw) || /(?:امبارح|أمس|yesterday|أول\s+امبارح|اول\s+امبارح)/i.test(raw));
        if (explicit || hasDate) {
          base.date = explicit || calculated.date;
          fieldToUpdate = 'date';
          newValue = base.date;
          changes.push('تم تعديل التاريخ');
        }
      }
      if (!isNotesOnlyEdit && timeCommand) {
        const explicit = parseSemanticNumberRoles(raw, localReferenceDate(request.currentDateTime)).specificTimeStr;
        if (explicit) {
          base.time = explicit;
          fieldToUpdate = 'time';
          newValue = base.time;
          changes.push('تم تعديل الوقت');
        }
      }

      // Category matching
      const matchedCat = isNotesOnlyEdit ? null : matchCategoryFromText(raw, request.categories);
      if (matchedCat) {
        base.categoryId = matchedCat.id;
        fieldToUpdate = 'categoryId';
        newValue = matchedCat.id;
        changes.push(`التصنيف إلى ${matchedCat.nameAr}`);
      } else if (typeOverride && typeOverride !== 'transfer' && base.categoryId) {
        const catObj = request.categories.find((c) => c.id === base.categoryId);
        if (catObj && catObj.type !== (typeOverride === 'income' ? 'income' : 'expense')) {
          base.categoryId = null;
          changes.push('التصنيف يحتاج اختيارًا جديدًا');
        }
      }

      // Account matching
      if (base.type === 'transfer' && !isNotesOnlyEdit) {
        const transferAccs = matchTransferAccountsFromText(raw, request.accounts, base.accountId);
        if (transferAccs.fromAccount) {
          base.accountId = transferAccs.fromAccount.id;
          base.currency = transferAccs.fromAccount.currency;
        }
        if (transferAccs.toAccount) {
          base.toAccountId = transferAccs.toAccount.id;
          changes.push(`إلى حساب ${transferAccs.toAccount.nameAr}`);
        }
      } else if (!isNotesOnlyEdit) {
        const matchedAcc = matchExplicitAccountFromText(raw, request.accounts);
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
        confidence: changes.length > 0 ? 0.85 : 0.25,
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
      } else if (hasTodayDateExpression(raw)) {
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
          transactionType: metric === 'total_income' ? 'income' : metric === 'account_balance' ? null : 'expense',
        },
        correction: null,
        clarificationNeeded: null,
        rawInterpretationSummary: 'Deterministic parsed financial query',
      };
    }

    if (command === 'UNKNOWN') {
      return {
        intent: 'UNKNOWN', confidence: 0, transaction: null,
        query: null, correction: null,
        clarificationNeeded: request.lang === 'ar'
          ? 'مش واضح هل تريد تسجيل عملية أو استعلامًا. اكتب المبلغ ونوع العملية، أو اسأل عن حساباتك.'
          : 'Please specify a transaction or ask a financial question.',
        rawInterpretationSummary: 'Local parser: no explicit intent',
      };
    }

    // Create a draft only after recognizing a financial event.
    const localAccounts = request.accounts.map((a) => ({
      ...a,
      balance: 0,
      createdAt: '',
    })) as FinancialAccount[];
    const localCategories = request.categories as Category[];

    const draft = parseNaturalLanguageInput(raw, localAccounts, localCategories, localReferenceDate(request.currentDateTime));

    // A transfer needs BOTH explicitly named accounts; do not invent a
    // destination or silently substitute the first account.
    const explicitAccount = draft.type === 'transfer' ? null : matchExplicitAccountFromText(raw, request.accounts);
    const sourceId = draft.type === 'transfer' ? (draft.accountId || null) : (explicitAccount?.id || null);
    const destinationId = draft.type === 'transfer' ? (draft.toAccountId || null) : null;
    const missingFields: string[] = [];
    if (draft.amount === null) missingFields.push('amount');
    if (!sourceId) missingFields.push('accountId');
    if (draft.type !== 'transfer' && !draft.categoryId) missingFields.push('categoryId');
    if (draft.type === 'transfer' && !destinationId) missingFields.push('toAccountId');

    const finalAmount = draft.amount;
    const finalDate = draft.date;
    const finalTime = draft.time;

    return {
      intent: 'CREATE_TRANSACTION',
      confidence: finalAmount !== null && sourceId && (draft.type === 'transfer' ? destinationId : draft.categoryId) ? 0.9 : 0.55,
      transaction: {
        type: draft.type,
        amount: finalAmount,
        currency: draft.currency,
        accountId: sourceId,
        toAccountId: destinationId,
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
