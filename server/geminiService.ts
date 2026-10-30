import { recordGeminiUsage } from './geminiUsage.js';
import { getSelectedGeminiModel, recordGeminiSuccess } from './geminiSettings.js';
import { AIInterpretationRequest, AIInterpretationResult } from '../src/services/ai/types.js';
import { isFinancialQueryText, parseSemanticNumberRoles } from '../src/utils/semanticParser.js';
import {
  matchCategoryFromText,
  matchAccountFromText,
  matchDescriptionEdit,
  matchAmountEdit,
  matchTransactionType,
  matchTransferAccountsFromText,
} from '../src/utils/entityMatcher.js';

export async function interpretNaturalLanguageWithGemini(
  req: AIInterpretationRequest
): Promise<AIInterpretationResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured on the server');

  // Only send concise task instructions and existing IDs to Gemini.
  // The extensive Arabic synonym knowledge base remains available locally in
  // entityMatcher/semanticParser; sending the full dictionary on every call
  // wastes thousands of input tokens.
  const accountsContext = req.accounts.map(a => ({
    id: a.id, name: a.nameAr || a.name, type: a.type, currency: a.currency,
  }));
  const categoriesContext = req.categories.map(c => ({
    id: c.id, name: c.nameAr || c.name, type: c.type,
  }));
  const normalizedText = req.text.trim().toLowerCase();
  const relevantMemory = (req.learnedMemory || []).filter(item =>
    item.keyword && normalizedText.includes(item.keyword.toLowerCase())
  ).slice(0, 5);

  const instructions = `You interpret Egyptian Arabic and English personal-finance statements.
Return ONLY a valid JSON object, no markdown. Classify intent as CREATE_TRANSACTION, FINANCIAL_QUERY, CORRECT_PROPOSAL, SAVE_REQUEST or UNKNOWN.
Questions ("كام", "قد ايه", "إجمالي", "how much") are FINANCIAL_QUERY, never expenses. Saving requests ("احفظ", "save") are SAVE_REQUEST; never save directly.
For CREATE_TRANSACTION extract type expense|income|transfer, amount, currency, accountId, toAccountId, categoryId, description, date YYYY-MM-DD, time HH:mm, missingFields.
For FINANCIAL_QUERY return query with metric (total_spent|total_income|category_spent|account_balance|net_savings|transaction_count|recent_list), period (today|yesterday|this_week|last_week|this_month|last_month|all_time|custom), optional startDate/endDate/categoryId/accountId/transactionType.
For CORRECT_PROPOSAL return updated complete transaction and correction {fieldToUpdate,newValue}.
Never invent an account, amount, destination, or category; use null if missing, and list missing required fields. Match IDs ONLY from lists provided.
Distinguish dates/times/quantities from amounts. Resolve امبارح/yesterday using the given local date. Description concise; don't repeat the entire utterance.
Output shape: {"intent":"CREATE_TRANSACTION","confidence":0.9,"transaction":null,"query":null,"correction":null,"clarificationNeeded":null,"rawInterpretationSummary":null}.
For transaction object include type,amount,currency,accountId,toAccountId,categoryId,description,date,time,missingFields.
For SAVE_REQUEST set clarificationNeeded to "من فضلك اضغط على زر تأكيد وحفظ".
Local date/time: ${req.currentDateTime}; timezone: ${req.userTimezone}; language: ${req.lang}.
Accounts: ${JSON.stringify(accountsContext)}
Categories: ${JSON.stringify(categoriesContext)}
Relevant user vocabulary: ${JSON.stringify(relevantMemory)}`;

  const prompt = `Input: ${JSON.stringify(req.text)}${req.currentProposal ? `\nDraft for correction: ${JSON.stringify(req.currentProposal)}` : ''}`;
  let responseText: string | undefined;
  // Use the exact REST API and working model proven by the admin connection
  // test. Avoid the SDK's previously failing request serialization.
  const model = await getSelectedGeminiModel();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 12000);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${instructions}\n\n${prompt}` }] }],
          generationConfig: { maxOutputTokens: 1200 },
        }),
        signal: controller.signal,
      }
    );
    if (!response.ok) {
      // Never log the provider's raw error body: it may contain submitted
      // financial text. Keep only the safe HTTP status.
      console.warn('[AI Router] Gemini request rejected', { model, httpStatus: response.status });
    } else {
      const result = await response.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
      };
      responseText = result.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
      const usage = result.usageMetadata;
      try { await recordGeminiSuccess(model); } catch { /* Status is best-effort. */ }
      if (usage) {
        try {
          await recordGeminiUsage({
            model,
            inputTokens: usage.promptTokenCount ?? 0,
            outputTokens: usage.candidatesTokenCount ?? 0,
            totalTokens: usage.totalTokenCount ?? 0,
          });
        } catch {
          console.warn('[AI Router] Gemini responded but usage telemetry could not be saved');
        }
      }
    }
  } catch (error: unknown) {
    console.warn('[AI Router] Gemini network request failed', {
      model,
      reason: controller.signal.aborted ? 'timeout' : 'connection_error',
    });
  } finally {
    clearTimeout(timeoutId);
  }

  let parsed: any = null;
  if (responseText) {
    try {
      parsed = JSON.parse(responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, ''));
    } catch (parseErr) {
      console.warn('Failed to parse Gemini response JSON:', parseErr);
    }
  }

  if (!parsed) {
    // If all models are temporarily unavailable, initialize a safe default object to be populated by deterministic guardrails
    parsed = {
      intent: isFinancialQueryText(req.text) ? 'FINANCIAL_QUERY' : 'CREATE_TRANSACTION',
      confidence: 0.85,
    };
  }

  // Deterministic Guardrails: Semantic Intent and Number Role Verification
  const rawText = req.text.trim();
  const isSaveRequest = /احفظ|سجل|أكد|اكد|تمام احفظ|تأكيد|حفظ العملية|احفظها|سجلها|اعتمد|اعتمدها|save|confirm/i.test(rawText);
  if (isSaveRequest || parsed.intent === 'SAVE_REQUEST') {
    const msg = req.lang === 'ar' ? 'من فضلك اضغط على زر تأكيد وحفظ' : 'Please click on the Confirm & Save button';
    return {
      intent: 'SAVE_REQUEST',
      confidence: 1.0,
      transaction: null,
      query: null,
      correction: null,
      clarificationNeeded: msg,
      rawInterpretationSummary: msg,
    } as AIInterpretationResult;
  }

  const isQuery = isFinancialQueryText(rawText);
  const semanticRoles = parseSemanticNumberRoles(rawText, new Date(req.currentDateTime));

  if (isQuery) {
    // Force intent to FINANCIAL_QUERY and ensure transaction is strictly null
    parsed.intent = 'FINANCIAL_QUERY';
    parsed.transaction = null;

    if (!parsed.query) {
      parsed.query = {};
    }

    // Set dates if extracted by semantic role parser
    if (semanticRoles.dateFrom && semanticRoles.dateTo) {
      parsed.query.period = 'custom';
      parsed.query.startDate = semanticRoles.dateFrom;
      parsed.query.endDate = semanticRoles.dateTo;
    } else if (semanticRoles.specificDateStr) {
      parsed.query.period = 'custom';
      parsed.query.startDate = semanticRoles.specificDateStr;
      parsed.query.endDate = semanticRoles.specificDateStr;
    }

    // Category detection if mentioned
    const lowerText = req.text.toLowerCase();
    if (lowerText.includes('بنزين') || lowerText.includes('fuel')) {
      const fuelCat = req.categories.find(
        (c) => c.nameAr.includes('مواصلات') || c.name.toLowerCase().includes('transport')
      );
      parsed.query.categoryId = fuelCat?.id || parsed.query.categoryId;
      parsed.query.categoryName = 'بنزين';
      parsed.query.metric = 'category_spent';
      parsed.query.transactionType = 'expense';
    }
  } else if (req.currentProposal || parsed.intent === 'CORRECT_PROPOSAL') {
    parsed.intent = 'CORRECT_PROPOSAL';
    const baseProposal = req.currentProposal || {};

    // Repair any malformed transaction object from model
    if (!parsed.transaction || typeof parsed.transaction !== 'object') {
      parsed.transaction = { ...baseProposal };
    } else {
      // If type had concatenated properties (e.g. "expense,amount: 200..."), fix it
      if (typeof parsed.transaction.type === 'string' && parsed.transaction.type.includes(',')) {
        parsed.transaction.type = parsed.transaction.type.split(',')[0].trim() || baseProposal.type || 'expense';
      }
      // Merge missing fields from baseProposal
      parsed.transaction = {
        type: parsed.transaction.type || baseProposal.type || 'expense',
        amount: typeof parsed.transaction.amount === 'number' ? parsed.transaction.amount : baseProposal.amount,
        currency: parsed.transaction.currency || baseProposal.currency || 'EGP',
        accountId: parsed.transaction.accountId || baseProposal.accountId || null,
        toAccountId: parsed.transaction.toAccountId || baseProposal.toAccountId || null,
        categoryId: parsed.transaction.categoryId || baseProposal.categoryId || null,
        description: parsed.transaction.description ?? baseProposal.description ?? '',
        date: parsed.transaction.date || baseProposal.date || req.currentDateTime.slice(0, 10),
        time: parsed.transaction.time || baseProposal.time || req.currentDateTime.slice(11, 16),
        missingFields: parsed.transaction.accountId ? [] : ['accountId'],
      };
    }

    const changes: string[] = [];

    // 1. Intelligent Category Detection (handles "عدل خانة التصنيف الى بنزين", "بنزين", "مواصلات", etc.)
    const matchedCat = matchCategoryFromText(req.text, req.categories);
    if (matchedCat) {
      parsed.transaction.categoryId = matchedCat.id;
      if (!parsed.correction || parsed.correction.fieldToUpdate !== 'categoryId') {
        parsed.correction = { fieldToUpdate: 'categoryId', newValue: matchedCat.id };
      }
      changes.push(`التصنيف إلى ${matchedCat.nameAr}`);
    }

    // 2. Type Detection
    const matchedType = matchTransactionType(req.text);
    if (matchedType) {
      parsed.transaction.type = matchedType;
      if (!parsed.correction || parsed.correction.fieldToUpdate !== 'type') {
        parsed.correction = { fieldToUpdate: 'type', newValue: matchedType };
      }
      changes.push(`النوع إلى ${matchedType === 'expense' ? 'مصروف' : matchedType === 'income' ? 'دخل' : 'تحويل'}`);

      // If type changed and no category was explicitly specified in text, adapt category to compatible type
      if (!matchedCat && matchedType !== 'transfer' && parsed.transaction.categoryId) {
        const catObj = req.categories.find((c) => c.id === parsed.transaction.categoryId);
        if (catObj && catObj.type !== (matchedType === 'income' ? 'income' : 'expense')) {
          const compatibleCat = req.categories.find((c) => c.type === (matchedType === 'income' ? 'income' : 'expense'));
          if (compatibleCat) {
            parsed.transaction.categoryId = compatibleCat.id;
            changes.push(`التصنيف إلى ${compatibleCat.nameAr}`);
          }
        }
      }
    }

    const currentType = parsed.transaction.type || baseProposal?.type || 'expense';

    // 3. Intelligent Account Detection (Single Account for Expense/Income, Two Accounts for Transfer)
    if (currentType === 'transfer') {
      const transferAccs = matchTransferAccountsFromText(req.text, req.accounts, parsed.transaction.accountId);
      if (transferAccs.fromAccount) {
        parsed.transaction.accountId = transferAccs.fromAccount.id;
        parsed.transaction.currency = transferAccs.fromAccount.currency;
        changes.push(`الحساب المصدر إلى ${transferAccs.fromAccount.nameAr}`);
      }
      if (transferAccs.toAccount) {
        parsed.transaction.toAccountId = transferAccs.toAccount.id;
        changes.push(`إلى حساب ${transferAccs.toAccount.nameAr}`);
      } else if (!parsed.transaction.toAccountId || parsed.transaction.toAccountId === parsed.transaction.accountId) {
        const otherAcc = req.accounts.find((a) => a.id !== parsed.transaction.accountId);
        if (otherAcc) {
          parsed.transaction.toAccountId = otherAcc.id;
          changes.push(`إلى حساب ${otherAcc.nameAr}`);
        }
      }
    } else {
      const matchedAcc = matchAccountFromText(req.text, req.accounts);
      if (matchedAcc) {
        parsed.transaction.accountId = matchedAcc.id;
        parsed.transaction.currency = matchedAcc.currency;
        if (!parsed.correction || parsed.correction.fieldToUpdate !== 'accountId') {
          parsed.correction = { fieldToUpdate: 'accountId', newValue: matchedAcc.id };
        }
        changes.push(`الحساب إلى ${matchedAcc.nameAr}`);
      }
    }

    // 4. Amount Detection
    const matchedAmount = matchAmountEdit(req.text) ?? semanticRoles.amount;
    if (matchedAmount !== null && matchedAmount > 0) {
      parsed.transaction.amount = matchedAmount;
      if (!parsed.correction || parsed.correction.fieldToUpdate !== 'amount') {
        parsed.correction = { fieldToUpdate: 'amount', newValue: String(matchedAmount) };
      }
      changes.push(`المبلغ إلى ${matchedAmount}`);
    }

    // 5. Description / Notes Detection
    const matchedDesc = matchDescriptionEdit(req.text);
    if (matchedDesc) {
      parsed.transaction.description = matchedDesc;
      if (!parsed.correction || parsed.correction.fieldToUpdate !== 'description') {
        parsed.correction = { fieldToUpdate: 'description', newValue: matchedDesc };
      }
      changes.push(`الملاحظات إلى "${matchedDesc}"`);
    }

    if (changes.length > 0) {
      parsed.rawInterpretationSummary = `تم تعديل ${changes.join(' و')}`;
    } else if (!parsed.rawInterpretationSummary) {
      parsed.rawInterpretationSummary = 'تم تحديث بيانات العملية';
    }
  } else if (parsed.intent === 'CREATE_TRANSACTION' && parsed.transaction) {
    // Number role verification for CREATE_TRANSACTION:
    // Prevent day or time numbers from mistakenly becoming amounts
    if (semanticRoles.amount !== null) {
      parsed.transaction.amount = semanticRoles.amount;
    }
    if (semanticRoles.specificDateStr && !parsed.transaction.date) {
      parsed.transaction.date = semanticRoles.specificDateStr;
    }
    if (semanticRoles.specificTimeStr && !parsed.transaction.time) {
      parsed.transaction.time = semanticRoles.specificTimeStr;
    }

    // Normalize nulls and missing fields
    if (!parsed.transaction.accountId || parsed.transaction.accountId === 'null') {
      parsed.transaction.accountId = null;
      if (!parsed.transaction.missingFields) parsed.transaction.missingFields = [];
      if (!parsed.transaction.missingFields.includes('accountId')) {
        parsed.transaction.missingFields.push('accountId');
      }
    }
  }

  return parsed as AIInterpretationResult;
}
