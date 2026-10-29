import { GoogleGenAI } from '@google/genai';
import { recordGeminiUsage } from './geminiUsage.js';

// Administrator-only diagnostic: uses no user financial data and never returns
// provider error text, request headers, credentials or secret API key.
export async function diagnoseGeminiConnection() {
  const model = 'gemini-2.5-flash';
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { success: false, model, reason: 'missing_key', httpStatus: null, googleStatus: null };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model,
      contents: 'Reply with exactly OK.',
      config: { maxOutputTokens: 16, abortSignal: controller.signal, httpOptions: { timeout: 10000 } },
    });
    const usage = response.usageMetadata;
    let trackingRecorded = false;
    if (usage) {
      try {
        await recordGeminiUsage({
          model,
          inputTokens: usage.promptTokenCount ?? 0,
          outputTokens: usage.candidatesTokenCount ?? 0,
          totalTokens: usage.totalTokenCount ?? 0,
        });
        trackingRecorded = true;
      } catch {
        // Keep a successful connectivity test distinct from a tracking failure.
      }
    }
    return {
      success: true,
      model,
      reply: (response.text || '').trim().slice(0, 30),
      totalTokens: usage?.totalTokenCount ?? null,
      trackingRecorded,
    };
  } catch (err: unknown) {
    const e = err as { status?: number; name?: string; message?: string };
    // Parse only known status codes from the provider response, never return
    // an untrusted raw error message that may contain sensitive text.
    const message = typeof e.message === 'string' ? e.message : '';
    const knownGoogleStatuses = ['FAILED_PRECONDITION', 'INVALID_ARGUMENT', 'PERMISSION_DENIED', 'RESOURCE_EXHAUSTED', 'NOT_FOUND', 'UNAUTHENTICATED', 'UNAVAILABLE', 'INTERNAL'];
    const googleStatus = knownGoogleStatuses.find(value => message.includes(value)) || null;
    const reason =
      /billing|payment|free tier|not available in your country|not available in your region/i.test(message) || googleStatus === 'FAILED_PRECONDITION' ? 'billing_or_eligibility' :
      /api key|api_key|key not valid|invalid key/i.test(message) ? 'invalid_key' :
      googleStatus === 'INVALID_ARGUMENT' ? 'invalid_request' :
      googleStatus === 'PERMISSION_DENIED' || googleStatus === 'UNAUTHENTICATED' ? 'permission' :
      googleStatus === 'RESOURCE_EXHAUSTED' ? 'quota' :
      googleStatus === 'NOT_FOUND' ? 'model_unavailable' :
      controller.signal.aborted || /timeout/i.test(message) ? 'timeout' :
      'unknown';
    return {
      success: false,
      model,
      httpStatus: typeof e.status === 'number' ? e.status : null,
      googleStatus,
      reason,
    };
  } finally {
    clearTimeout(timer);
  }
}
