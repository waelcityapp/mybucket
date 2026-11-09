// Read-only inventory. No personal identifiers or financial records are printed.
// Targets the verified project and its default Firestore database only.
import { execFileSync } from 'node:child_process';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { buildTrialAccessPlan } from './trial-access-plan.mjs';

const projectId = 'mybucket-8b6f0';
let cachedToken = '';
let refreshAt = 0;
const credential = {
  async getAccessToken() {
    if (!cachedToken || Date.now() >= refreshAt) {
      cachedToken = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
      if (!cachedToken) throw new Error('missing_access_token');
      refreshAt = Date.now() + 240_000;
    }
    return { access_token: cachedToken, expires_in: 300 };
  },
};
const app = initializeApp({ projectId, credential });
const auth = getAuth(app);
// The Admin Firestore SDK does not accept a custom gcloud token credential.
// Use authenticated, read-only Firestore REST GET requests instead.
async function readDocument(path) {
  const { access_token } = await credential.getAccessToken();
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (response.status === 404) return null;
  if (!response.ok) throw Object.assign(new Error('firestore_read_failed'), { code: `firestore_http_${response.status}` });
  const result = await response.json();
  return result.fields || {};
}
function field(fields, key) {
  const value = fields?.[key];
  if (!value) return undefined;
  if ('stringValue' in value) return value.stringValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('booleanValue' in value) return value.booleanValue;
  if ('timestampValue' in value) return { timestampMs: Date.parse(value.timestampValue) };
  if ('nullValue' in value) return null;
  return { otherType: true };
}
const totals = {
  authAccounts: 0, creationDateValid: 0, creationDateInvalid: 0,
  billingPresent: 0, billingMissing: 0, billingTrialDateNotValidString: 0,
  billingTrialDateDiffersFromAuth: 0, paidFlagTrue: 0, paidExpiryNotValidString: 0,
  accessPresent: 0, accessMissing: 0, accessRegistrationMismatch: 0,
  accessPaidUntilMismatch: 0,
};
const planInputs = [];

try {
  const setting = await readDocument('appSettings/subscriptionTrials');
  const settings = setting ? { proDays: field(setting, 'proDays') ?? null, basicDays: field(setting, 'basicDays') ?? null } : null;
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (let offset = 0; offset < page.users.length; offset += 100) {
      const users = page.users.slice(offset, offset + 100);
      const docs = await Promise.all(users.flatMap(u => [readDocument(`users/${encodeURIComponent(u.uid)}/billing/subscription`), readDocument(`users/${encodeURIComponent(u.uid)}/billing/access`)]));
      users.forEach((user, i) => {
        totals.authAccounts++;
        const registration = Date.parse(user.metadata.creationTime || '');
        const validRegistration = Number.isFinite(registration) && registration <= Date.now();
        if (validRegistration) totals.creationDateValid++; else totals.creationDateInvalid++;
        const billing = docs[2 * i];
        const access = docs[2 * i + 1];
        planInputs.push({ uid: user.uid, creationTime: user.metadata.creationTime, billingExists: Boolean(billing), accessExists: Boolean(access) });
        if (billing) {
          totals.billingPresent++;
          const trial = field(billing, 'trialStartedAt');
          const start = typeof trial === 'string' ? Date.parse(trial) : NaN;
          if (!Number.isFinite(start)) totals.billingTrialDateNotValidString++;
          else if (validRegistration && start !== registration) totals.billingTrialDateDiffersFromAuth++;
        } else totals.billingMissing++;
        let paidExpiry = null;
        if (field(billing, 'isPaid') === true) {
          totals.paidFlagTrue++;
          const paid = field(billing, 'paidExpiresAt');
          const parsed = typeof paid === 'string' ? Date.parse(paid) : NaN;
          if (!Number.isFinite(parsed)) totals.paidExpiryNotValidString++; else paidExpiry = parsed;
        }
        if (access) {
          totals.accessPresent++;
          const registeredAt = field(access, 'registeredAt');
          if (!validRegistration || registeredAt?.timestampMs !== registration) totals.accessRegistrationMismatch++;
          const paidUntil = field(access, 'paidUntil');
          const until = paidUntil == null ? null : paidUntil?.timestampMs ?? 'invalid';
          if (until !== paidExpiry) totals.accessPaidUntilMismatch++;
        } else totals.accessMissing++;
      });
    }
    pageToken = page.pageToken;
  } while (pageToken);
  const plan = buildTrialAccessPlan(planInputs);
  // Only aggregate counts leave this process; do not print the proposed records.
  console.log(JSON.stringify({ project: projectId, database: '(default)', settings, totals, trialAccessPreview: plan.summary }, null, 2));
} catch (error) {
  // Do not print credential-bearing command output or per-user data.
  console.error('Read-only audit failed. No data was modified. Error code:', error?.code || 'unavailable');
  process.exitCode = 1;
} finally {
  await deleteApp(app);
}
