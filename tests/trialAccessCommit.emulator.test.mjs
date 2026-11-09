import test from 'node:test';
import assert from 'node:assert/strict';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { buildTrialAccessCommit } from '../scripts/trial-access-commit-plan.mjs';

test('emulated commit is atomic and never overwrites an existing access record', async () => {
  const host = process.env.FIRESTORE_EMULATOR_HOST || '';
  if (!/^(localhost|127\.0\.0\.1):\d+$/.test(host)) throw new Error('local emulator required');
  const app = initializeApp({ projectId: 'demo-mybucket-rules' }, 'commit-plan-test');
  const db = getFirestore(app);
  try {
    const settings = db.doc('appSettings/subscriptionTrials');
    await settings.set({ basicDays:72, proDays:15 });
    const snapshot = await settings.get();
    const updateTime = new Date(snapshot.updateTime.seconds * 1000).toISOString().replace('.000Z', `.${String(snapshot.updateTime.nanoseconds).padStart(9, '0')}Z`);
    const records = Array.from({ length:5 }, (_, i) => ({ uid:`test_${i}`, registeredAt:'2026-09-06T13:14:15.000Z', paidUntil:null, schemaVersion:1 }));
    const plan = buildTrialAccessCommit({ records, expectedCount:5, settingsUpdateTime:updateTime });
    // The tested operation is retargeted to the emulator-only project.
    const emulatorPlan = JSON.parse(JSON.stringify(plan).replaceAll('projects/mybucket-8b6f0/', 'projects/demo-mybucket-rules/'));
    const url = `http://${host}/v1/projects/demo-mybucket-rules/databases/(default)/documents:commit`;
    const commit = () => fetch(url, { method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer owner'}, body:JSON.stringify(emulatorPlan) });
    const first = await commit();
    assert.equal(first.ok, true, `first commit failed: ${first.status} ${await first.text()}`);
    for (const record of records) {
      const snap = await db.doc(`users/${record.uid}/billing/access`).get();
      assert.equal(snap.data().registeredAt.toMillis(), Date.parse(record.registeredAt));
      assert.equal(snap.data().paidUntil, null);
    }
    const second = await commit();
    assert.equal(second.ok, false, 'a repeat must not overwrite existing records');
    const next = records.map((record, i) => ({ ...record, uid:`next_${i}` }));
    await db.doc('users/next_3/billing/subscription').set({ marker:'do-not-change' });
    const blockedPlan = JSON.parse(JSON.stringify(buildTrialAccessCommit({ records:next, expectedCount:5, settingsUpdateTime:updateTime })).replaceAll('projects/mybucket-8b6f0/', 'projects/demo-mybucket-rules/'));
    const blocked = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer owner'}, body:JSON.stringify(blockedPlan) });
    assert.equal(blocked.ok, false, 'existing billing must block the entire commit');
    for (const record of next) assert.equal((await db.doc(`users/${record.uid}/billing/access`).get()).exists, false);
  } finally { await deleteApp(app); }
});
