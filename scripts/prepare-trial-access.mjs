// Read-only by default. --apply is a separate, explicit production operation.
import { execFileSync } from 'node:child_process';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { prepareTrialAccess } from './prepare-trial-access-core.mjs';

const projectId = 'mybucket-8b6f0';
const args = process.argv.slice(2);
if (args.length > 1 || (args.length === 1 && args[0] !== '--apply')) {
  console.error('Unsupported argument.'); process.exit(1);
}
let cachedToken = '', expiresAt = 0;
const credential = { async getAccessToken() {
  if (!cachedToken || Date.now() >= expiresAt) {
    cachedToken = execFileSync('gcloud', ['auth','print-access-token'], { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim();
    if (!cachedToken) throw new Error('credentials-unavailable');
    expiresAt = Date.now() + 240_000;
  }
  return { access_token:cachedToken, expires_in:300 };
} };
const app = initializeApp({ projectId, credential });
const auth = getAuth(app);
const base = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
let commitAttempted = false;
async function request(url, options = {}) {
  const { access_token } = await credential.getAccessToken();
  const response = await fetch(url, { ...options, headers:{ Authorization:`Bearer ${access_token}`, ...(options.headers || {}) } });
  if (response.status === 404 && !options.method) return null;
  if (!response.ok) throw Object.assign(new Error('firebase-request-failed'), { code:`HTTP_${response.status}` });
  return response.json();
}
const adapter = {
  async readSettings() {
    const doc = await request(`${base}/appSettings/subscriptionTrials`);
    return doc ? { proDays:Number(doc.fields?.proDays?.integerValue), basicDays:Number(doc.fields?.basicDays?.integerValue), updateTime:doc.updateTime } : null;
  },
  async listUsers() {
    const users = []; let pageToken;
    do {
      const page = await auth.listUsers(1000, pageToken);
      users.push(...page.users.map(u => ({ uid:u.uid, creationTime:u.metadata.creationTime })));
      pageToken = page.pageToken;
    } while (pageToken);
    return users;
  },
  async readBillingState(uid) {
    const encoded = encodeURIComponent(uid);
    const [billing, access] = await Promise.all([
      request(`${base}/users/${encoded}/billing/subscription`),
      request(`${base}/users/${encoded}/billing/access`),
    ]);
    return { billingExists:billing !== null, accessExists:access !== null };
  },
  async commit(body) {
    commitAttempted = true;
    return request(`${base}:commit`, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
  },
};
try {
  const result = await prepareTrialAccess({ adapter, execute:args[0] === '--apply' });
  console.log(JSON.stringify({ project:projectId, database:'(default)', ...result }, null, 2));
} catch (error) {
  const known = ['settings-changed','account-count-changed','review-required','unexpected-count','missing-settings-version','invalid-user','invalid-date','invalid-record'];
  const reason = known.includes(error?.message) ? error.message : (typeof error?.code === 'string' && /^(HTTP_\d{3}|auth\/[a-z-]+)$/.test(error.code) ? error.code : 'unavailable');
  console.error('Preparation stopped:', reason);
  if (commitAttempted) console.error('Commit was attempted; the outcome must be checked before any retry.');
  else console.error('No write was attempted.');
  process.exitCode = 1;
} finally { await deleteApp(app); }
