// Prepare a Firestore REST commit body. This module has no networking or writes.
// A separate reviewed caller must refresh Authentication and Firestore data first.
export function buildTrialAccessCommit({ records, settingsUpdateTime, expectedCount }) {
  const root = 'projects/mybucket-8b6f0/databases/(default)/documents';
  if (!Number.isInteger(expectedCount) || expectedCount < 1 || !Array.isArray(records) || records.length !== expectedCount) throw new Error('unexpected-count');
  if (typeof settingsUpdateTime !== 'string' || !Number.isFinite(Date.parse(settingsUpdateTime))) throw new Error('missing-settings-version');
  const ids = new Set();
  const writes = [{ verify: `${root}/appSettings/subscriptionTrials`, currentDocument: { updateTime: settingsUpdateTime } }];
  for (const record of records) {
    if (!record || typeof record.uid !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(record.uid) || ids.has(record.uid)) throw new Error('invalid-user');
    ids.add(record.uid);
    if (typeof record.registeredAt !== 'string' || !Number.isFinite(Date.parse(record.registeredAt)) || Date.parse(record.registeredAt) > Date.now()) throw new Error('invalid-date');
    if (record.schemaVersion !== 1 || record.paidUntil !== null) throw new Error('invalid-record');
    writes.push({ verify: `${root}/users/${record.uid}/billing/subscription`, currentDocument: { exists: false } });
    writes.push({
      update: { name: `${root}/users/${record.uid}/billing/access`, fields: {
        registeredAt: { timestampValue: record.registeredAt }, paidUntil: { nullValue: null }, schemaVersion: { integerValue: '1' },
      } },
      currentDocument: { exists: false },
    });
  }
  return { writes };
}
