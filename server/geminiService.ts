import { GoogleGenAI, Type } from '@google/genai';
import { AIInterpretationRequest, AIInterpretationResult } from '../src/services/ai/types';
import { isFinancialQueryText, parseSemanticNumberRoles } from '../src/utils/semanticParser';

let genAIClient: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not configured on the server');
    }
    genAIClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return genAIClient;
}

export async function interpretNaturalLanguageWithGemini(
  req: AIInterpretationRequest
): Promise<AIInterpretationResult> {
  const ai = getGenAI();

  // Construct minimal context (Data Minimization requirement)
  const accountsContext = req.accounts.map((a) => ({
    id: a.id,
    name: a.name,
    nameAr: a.nameAr,
    type: a.type,
    currency: a.currency,
  }));

  const categoriesContext = req.categories.map((c) => ({
    id: c.id,
    name: c.name,
    nameAr: c.nameAr,
    type: c.type,
  }));

  const systemInstruction = `
You are the natural language understanding and intent detection core of "My Bucket" (ماي باكت), an Arabic and English personal finance assistant.

CRITICAL INSTRUCTIONS & STRICT RULES:
1. INTENT CLASSIFICATION:
   - Understand the difference between:
     A) Recording a NEW financial event -> "CREATE_TRANSACTION"
     B) Asking a QUESTION / querying historical data -> "FINANCIAL_QUERY"

   - CRITICAL INTENT RULE:
     Do NOT classify a sentence as CREATE_TRANSACTION merely because:
     * it contains the word "صرفت" or "دفعت"
     * it contains numbers
     * it contains a financial category
     
   - QUESTION DETECTION:
     Arabic financial question patterns such as:
     "قد إيه", "قد ايه", "كام", "كم", "بكام", "إيه اللي صرفته", "وريني", "اعرض", "هات", "من يوم ... ليوم ...", "خلال", "في الفترة", "إجمالي", "أكتر", "أقل", "قارن", "معايا كام", "رصيدي"
     strongly indicate FINANCIAL_QUERY!
     When the user is asking a question about existing financial data, intent MUST BE "FINANCIAL_QUERY", and transaction MUST BE null!

   - NUMBER ROLE DETECTION:
     Numbers must be interpreted strictly according to their semantic role:
     A number may represent:
     - amount
     - day of month
     - month
     - year
     - time of day
     - quantity
     - date range boundary
     DO NOT automatically treat the first number as an amount!
     
     Examples:
     * "صرفت 500 جنيه بنزين امبارح" -> CREATE_TRANSACTION, amount = 500, relative date = yesterday.
     * "أنا صرفت كام بنزين امبارح؟" -> FINANCIAL_QUERY, metric = category_spent, period = yesterday, NO amount!
     * "دفعت 700 جنيه بنزين يوم 3 مارس" -> CREATE_TRANSACTION, amount = 700, day = 3, month = March (date = YYYY-03-03).
     * "دفعت كام بنزين يوم 3 مارس؟" -> FINANCIAL_QUERY, day = 3, category = fuel, NO amount!
     * "أنا صرفت قد إيه بنزين من يوم 3 ليوم 18 في شهر مارس؟" -> FINANCIAL_QUERY, startDate = YYYY-03-03, endDate = YYYY-03-18, category = fuel, NO amount!
     * "يوم 15 مارس الساعة 3 دفعت 600 جنيه بنزين من الفيزا" -> CREATE_TRANSACTION, day = 15, time = 03:00 / 15:00, amount = 600, account = Visa.
   - "CORRECT_PROPOSAL": When the user is modifying a currently open transaction draft (e.g. "لا خليها 400" or "عدل الحساب للبنك").
   - "UNKNOWN": When the sentence cannot be understood or is completely unrelated. Provide a polite clarification in user's language.

2. NEVER INVENT REQUIRED FINANCIAL INFORMATION:
   - If the user did not specify the account (e.g., "دفعت 300 جنيه في مطعم"), accountId MUST BE null / empty string, and "accountId" MUST be added to missingFields.
   - NEVER guess "Cash" or pick a default account if the user did not mention it!
   - If amount is missing or unclear, amount MUST be null.

3. RESOLVE ACCOUNTS & CATEGORIES TO EXISTING USER DATA:
   - Available User Accounts:
${JSON.stringify(accountsContext, null, 2)}
   - Available User Categories:
${JSON.stringify(categoriesContext, null, 2)}
   - When resolving "الكاش" or "نقدي", match to the user's cash account ID.
   - When resolving "البنك", match to the user's bank account ID.
   - When resolving "الفيزا" or "كارت", match to the user's card account ID.
   - When resolving "بنزين", match to fuel/transport category ID.

4. DESCRIPTION EXTRACTION:
   - DO NOT place the user's full spoken sentence into "description".
   - Extract a clean, concise description (e.g., "بنزين" or "غداء مطعم" or "فاتورة كهرباء" or "راتب").

5. DATE AND TIME RESOLUTION:
   - Current user local date/time: ${req.currentDateTime}
   - User timezone: ${req.userTimezone}
   - User language: ${req.lang}
   - Resolve natural relative time expressions:
     * "النهارده" / "اليوم" -> current date
     * "امبارح" / "أمس" -> yesterday's date
     * "الساعة 4 ونص" -> 16:30 (if afternoon) or 04:30
     * "من ساعتين" -> 2 hours before current time
     * "الساعة 8 بالليل" -> 20:00
   - Format date as YYYY-MM-DD and time as HH:mm.

Return strictly structured JSON matching the defined schema.
`;

  const prompt = `User Input: "${req.text}"`;

  const config = {
    systemInstruction,
    responseMimeType: 'application/json',
    responseSchema: {
      type: Type.OBJECT,
      properties: {
        intent: {
          type: Type.STRING,
          description: 'Detected intent: CREATE_TRANSACTION, FINANCIAL_QUERY, CORRECT_PROPOSAL, or UNKNOWN',
        },
        confidence: {
          type: Type.NUMBER,
          description: 'Confidence level between 0 and 1',
        },
        transaction: {
          type: Type.OBJECT,
          description: 'Transaction details if intent is CREATE_TRANSACTION',
          properties: {
            type: {
              type: Type.STRING,
              description: 'expense, income, or transfer',
            },
            amount: {
              type: Type.NUMBER,
              description: 'Numeric amount',
            },
            currency: {
              type: Type.STRING,
              description: 'Currency code',
            },
            accountId: {
              type: Type.STRING,
              description: 'Matched account ID. Must be null/empty if user did not specify account.',
            },
            toAccountId: {
              type: Type.STRING,
              description: 'Destination account ID if transfer',
            },
            categoryId: {
              type: Type.STRING,
              description: 'Matched category ID',
            },
            description: {
              type: Type.STRING,
              description: 'Extracted clean concise description. Do not copy full sentence.',
            },
            date: {
              type: Type.STRING,
              description: 'YYYY-MM-DD in user timezone',
            },
            time: {
              type: Type.STRING,
              description: 'HH:mm in 24-hr format in user timezone',
            },
            missingFields: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Fields that are required but missing from user utterance (e.g. accountId)',
            },
          },
        },
        query: {
          type: Type.OBJECT,
          description: 'Query instructions if intent is FINANCIAL_QUERY',
          properties: {
            metric: {
              type: Type.STRING,
              description: 'total_spent, total_income, category_spent, account_balance, net_savings, or transaction_count',
            },
            period: {
              type: Type.STRING,
              description: 'today, yesterday, this_week, last_week, this_month, last_month, all_time, or custom',
            },
            startDate: { type: Type.STRING },
            endDate: { type: Type.STRING },
            categoryId: { type: Type.STRING },
            categoryName: { type: Type.STRING },
            accountId: { type: Type.STRING },
            accountName: { type: Type.STRING },
            transactionType: { type: Type.STRING },
          },
        },
        correction: {
          type: Type.OBJECT,
          properties: {
            fieldToUpdate: { type: Type.STRING },
            newValue: { type: Type.STRING },
          },
        },
        clarificationNeeded: {
          type: Type.STRING,
          description: 'Clarification prompt if intent is UNKNOWN or ambiguous',
        },
        rawInterpretationSummary: {
          type: Type.STRING,
          description: 'Brief human summary of interpretation',
        },
      },
      required: ['intent'],
    },
  };

  let responseText: string | undefined;
  // Use high-availability models with resilient fallback sequence
  const modelsToTry = [
    'gemini-3.1-flash-lite',
    'gemini-flash-latest',
    'gemini-3.8-flash',
    'gemini-3.1-pro-preview',
  ];

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config,
      });
      responseText = response.text;
      if (responseText) {
        break;
      }
    } catch (apiErr: any) {
      console.log(`[AI Router] Model ${model} unavailable (${apiErr?.status || '503/error'}), trying next model...`);
      // Brief jitter backoff before trying fallback model
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  let parsed: any = null;
  if (responseText) {
    try {
      parsed = JSON.parse(responseText);
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
  const isQuery = isFinancialQueryText(req.text);
  const semanticRoles = parseSemanticNumberRoles(req.text, new Date(req.currentDateTime));

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
