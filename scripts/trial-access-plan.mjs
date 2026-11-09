// Pure planning only: no network access and no writes.
export function buildTrialAccessPlan(accounts, now = Date.now()) {
  const summary = { total: 0, toCreate: 0, alreadyPresent: 0, needsReview: 0 };
  const records = [];
  const ids = new Set();
  for (const account of accounts) {
    summary.total++;
    const id = account.uid;
    const time = Date.parse(account.creationTime || '');
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(id) || ids.has(id)
      || !Number.isFinite(time) || time > now
      || typeof account.billingExists !== 'boolean' || typeof account.accessExists !== 'boolean') {
      summary.needsReview++; continue;
    }
    ids.add(id);
    if (account.accessExists) { summary.alreadyPresent++; continue; }
    if (account.billingExists) { summary.needsReview++; continue; }
    records.push({ uid: id, registeredAt: new Date(time).toISOString(), paidUntil: null, schemaVersion: 1 });
    summary.toCreate++;
  }
  return { summary, records };
}
