import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { test } from 'node:test';
import { getAdminFirestore } from '../server/firebaseAdmin.ts';
import { interpretNaturalLanguageWithGemini } from '../server/geminiService.ts';

test('only usable provider replies advance the analysis success indicator', async t => {
  assert.match(process.env.FIRESTORE_EMULATOR_HOST ?? '', /^(127\.0\.0\.1|localhost):\d+$/);
  process.env.GOOGLE_CLOUD_PROJECT = `demo-ai-outcome-${randomUUID().slice(0, 8)}`;
  process.env.GEMINI_API_KEY = 'simulated';
  const db = getAdminFirestore();
  t.after(() => db.terminate());

  const status = db.doc('systemSettings/geminiStatus');
  const sample = { text: 'صرفت ١١٠ جنيه بنزين', accounts: [], categories: [],
    currentDateTime: '2026-11-24T12:00:00', userTimezone: 'Africa/Cairo', lang: 'ar' };
  let reply;
  let requests = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    requests++;
    return reply === undefined ? new Response(null, { status: 503 })
      : Response.json({ candidates: [{ content: { parts: [{ text: reply }] } }] });
  });
  await assert.rejects(interpretNaturalLanguageWithGemini(sample), { message: 'gemini_unavailable' });
  assert.equal(requests, 2);
  for (reply of ['not-json', '{"intent":"CREATE_TRANSACTION"}']) {
    await assert.rejects(interpretNaturalLanguageWithGemini(sample), { message: 'gemini_unavailable' });
  }
  assert.equal((await status.get()).exists, false);

  reply = JSON.stringify({ intent: 'CREATE_TRANSACTION', transaction: { type: 'expense', amount: 110, missingFields: [] } });
  assert.equal((await interpretNaturalLanguageWithGemini(sample)).transaction.amount, 110);
  assert.ok((await status.get()).get('lastSuccessAt'));
});
