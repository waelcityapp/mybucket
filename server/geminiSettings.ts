import { getAdminFirestore } from './firebaseAdmin.js';

// A deliberately small list of text-only models with documented per-token pricing.
// Changes to this list require server review; clients cannot submit arbitrary IDs.
export const GEMINI_MODEL_OPTIONS = [
  { id: 'gemini-3.5-flash-lite', inputPerMillion: 0.30, outputPerMillion: 2.50 },
  { id: 'gemini-3.5-flash', inputPerMillion: 1.50, outputPerMillion: 9.00 },
] as const;

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
const settingsPath = 'systemSettings/gemini';
const statusPath = 'systemSettings/geminiStatus';

export async function getSelectedGeminiModel(): Promise<string> {
  const snapshot = await getAdminFirestore().doc(settingsPath).get();
  const id = snapshot.data()?.activeModel;
  return GEMINI_MODEL_OPTIONS.some(model => model.id === id) ? id : DEFAULT_GEMINI_MODEL;
}

export async function getGeminiAdminSettings() {
  const [model, status] = await Promise.all([
    getSelectedGeminiModel(),
    getAdminFirestore().doc(statusPath).get(),
  ]);
  return {
    activeModel: model,
    options: GEMINI_MODEL_OPTIONS,
    lastSuccessAt: status.data()?.lastSuccessAt || null,
    lastSuccessModel: status.data()?.lastSuccessModel || null,
  };
}

export async function setSelectedGeminiModel(modelId: unknown) {
  if (typeof modelId !== 'string' || !GEMINI_MODEL_OPTIONS.some(model => model.id === modelId)) {
    throw new Error('invalid_model_selection');
  }
  await getAdminFirestore().doc(settingsPath).set({
    activeModel: modelId,
    updatedAt: new Date().toISOString(),
  }, { merge: true });
  return getGeminiAdminSettings();
}

export async function recordGeminiSuccess(modelId: string) {
  await getAdminFirestore().doc(statusPath).set({
    lastSuccessAt: new Date().toISOString(),
    lastSuccessModel: modelId,
  }, { merge: true });
}
