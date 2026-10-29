import { FieldValue } from 'firebase-admin/firestore';
import { getAdminFirestore } from './firebaseAdmin.js';

// Counts are recorded from successful Gemini responses, never generated in the browser.
// Historical requests before deployment are not included.
export async function recordGeminiUsage(usage: {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  const month = date.slice(0, 7);
  const db = getAdminFirestore();
  const modelKey = usage.model.replace(/[^a-zA-Z0-9_-]/g, '_');
  const data = {
    requests: FieldValue.increment(1),
    inputTokens: FieldValue.increment(Math.max(0, usage.inputTokens)),
    outputTokens: FieldValue.increment(Math.max(0, usage.outputTokens)),
    totalTokens: FieldValue.increment(Math.max(0, usage.totalTokens)),
    updatedAt: new Date().toISOString(),
  };
  await Promise.all([
    db.doc(`aiUsage/daily_${date}`).set(data, { merge: true }),
    db.doc(`aiUsage/monthly_${month}`).set(data, { merge: true }),
    db.doc(`aiUsage/monthly_${month}/models/${modelKey}`).set({ ...data, model: usage.model }, { merge: true }),
  ]);
}

export async function readGeminiUsage() {
  const month = new Date().toISOString().slice(0, 7);
  const db = getAdminFirestore();
  const [summary, models] = await Promise.all([
    db.doc(`aiUsage/monthly_${month}`).get(),
    db.collection(`aiUsage/monthly_${month}/models`).get(),
  ]);
  return {
    month,
    trackingStarted: summary.exists,
    summary: summary.exists ? summary.data() : null,
    models: models.docs.map((doc) => doc.data()),
    source: 'gemini_response_usage_metadata',
    note: 'Only successful responses recorded after telemetry deployment are counted.',
  };
}
