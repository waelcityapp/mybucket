import { recordGeminiUsage } from './geminiUsage.js';

// Admin-only diagnostic: discovers models from the same API key used by the server.
// Never returns a key, headers, raw provider errors, or any financial information.
type GeminiModel = { name?: string; displayName?: string; supportedGenerationMethods?: string[] };
type GoogleError = { error?: { code?: number; status?: string; message?: string } };
const knownStatuses = ['FAILED_PRECONDITION', 'INVALID_ARGUMENT', 'PERMISSION_DENIED', 'RESOURCE_EXHAUSTED', 'NOT_FOUND', 'UNAUTHENTICATED', 'UNAVAILABLE', 'INTERNAL'] as const;
function categorize(status: string | null, message: string) {
  if (status === 'FAILED_PRECONDITION' || /billing|payment|free tier|region|country/i.test(message)) return 'billing_or_eligibility';
  if (/api key|api_key|invalid key/i.test(message)) return 'invalid_key';
  if (status === 'INVALID_ARGUMENT') return 'invalid_request';
  if (status === 'PERMISSION_DENIED' || status === 'UNAUTHENTICATED') return 'permission';
  if (status === 'RESOURCE_EXHAUSTED') return 'quota';
  if (status === 'NOT_FOUND') return 'model_unavailable';
  return 'unknown';
}
function googleFailure(httpStatus: number, error: GoogleError) {
  const raw = error?.error?.status;
  const googleStatus = knownStatuses.find(s => s === raw) || null;
  return { httpStatus, googleStatus, reason: categorize(googleStatus, error?.error?.message || '') };
}
export async function diagnoseGeminiConnection() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { success: false, stage: 'models_list', reason: 'missing_key', httpStatus: null, googleStatus: null, availableModels: [] };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const models: GeminiModel[] = [];
    let pageToken: string | undefined;
    // Follow at most 3 pages so this button remains predictable and inexpensive.
    for (let page = 0; page < 3; page++) {
      const url = new URL('https://generativelanguage.googleapis.com/v1beta/models');
      url.searchParams.set('pageSize', '100');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { 'x-goog-api-key': apiKey },
        signal: controller.signal,
      });
      const result = await response.json() as { models?: GeminiModel[]; nextPageToken?: string } & GoogleError;
      if (!response.ok) return { success: false, stage: 'models_list', ...googleFailure(response.status, result), availableModels: [] };
      models.push(...(Array.isArray(result.models) ? result.models : []));
      pageToken = result.nextPageToken;
      if (!pageToken) break;
    }

    const availableModels = models
      .filter(m => m.name?.startsWith('models/gemini-') && m.supportedGenerationMethods?.includes('generateContent'))
      .map(m => m.name!.slice('models/'.length));
    // Test the exact model that fails in the financial workflow, not an
    // arbitrary older model picked from the models.list ordering.
    const diagnosticModel = 'gemini-3.5-flash-lite';
    const selected = availableModels.includes(diagnosticModel) ? diagnosticModel : null;
    const listedModels = availableModels.slice(0, 30);
    if (!selected) return { success: false, stage: 'model_selection', model: diagnosticModel, reason: 'model_unavailable', httpStatus: null, googleStatus: null, availableModels: listedModels, modelCount: availableModels.length };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(selected)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with exactly OK.' }] }], generationConfig: { maxOutputTokens: 32 } }),
      signal: controller.signal,
    });
    const result = await response.json() as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; totalTokenCount?: number };
    } & GoogleError;
    if (!response.ok) return { success: false, stage: 'generate_content', model: selected, ...googleFailure(response.status, result), availableModels: listedModels, modelCount: availableModels.length };
    const usage = result.usageMetadata;
    let trackingRecorded = false;
    if (usage) {
      try {
        await recordGeminiUsage({
          model: selected,
          inputTokens: usage.promptTokenCount ?? 0,
          outputTokens: usage.candidatesTokenCount ?? 0,
          totalTokens: usage.totalTokenCount ?? 0,
        });
        trackingRecorded = true;
      } catch {
        // A successful Google request is reported separately from Firestore telemetry.
      }
    }
    return {
      success: true, stage: 'generate_content', model: selected,
      reply: (result.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '').trim().slice(0, 30),
      totalTokens: usage?.totalTokenCount ?? null, trackingRecorded,
      availableModels: listedModels, modelCount: availableModels.length,
    };
  } catch (error: unknown) {
    return {
      success: false, stage: 'connection', reason: controller.signal.aborted ? 'timeout' : 'unknown',
      httpStatus: null, googleStatus: null, availableModels: [],
    };
  } finally {
    clearTimeout(timer);
  }
}
