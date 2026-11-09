// Read-only inventory. No personal identifiers or financial records are printed.
// Targets the verified project and its default Firestore database only.
import { execFileSync } from 'node:child_process';
import { initializeApp, deleteApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = 'mybucket-8b6f0';
const credential = {
  async getAccessToken() {
    const token = execFileSync('gcloud', ['auth', 'print-access-token'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    if (!token) throw new Error('missing_access_token');
    return { access_token: token, expires_in: 300 };
  },
};
const app = initializeApp({ projectId, credential });
const db = getFirestore(app);
const auth = getAuth(app);
const totals = {
  authAccounts: 0, creationDateValid: 0, creationDateInvalid: 0,
  billingPresent: 0, billingMissing: 0, billingTrialDateNotValidString: 0,
  billingTrialDateDiffersFromAuth: 0, paidFlagTrue: 0, paidExpiryNotValidString: 0,
  accessPresent: 0, accessMissing: 0, accessRegistrationMismatch: 0,
  accessPaidUntilMismatch: 0,
};

try {
  const setting = await db.doc('appSettings/subscriptionTrials').get();
  const s = setting.data();
  const settings = setting.exists ? { proDays: s.proDays ?? null, basicDays: s.basicDays ?? null } : null;
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (let offset = 0; offset < page.users.length; offset += 100) {
      const users = page.users.slice(offset, offset + 100);
      const refs = users.flatMap(u => [db.doc(`users/${u.uid}/billing/subscription`), db.doc(`users/${u.uid}/billing/access`)]);
      if (!refs.length) continue;
      const docs = await db.getAll(...refs);
      users.forEach((user, i) => {
        totals.authAccounts++;
        const registration = Date.parse(user.metadata.creationTime || '');
        const validRegistration = Number.isFinite(registration) && registration <= Date.now();
        if (validRegistration) totals.creationDateValid++; else totals.creationDateInvalid++;
        const billingDoc = docs[2 * i];
        const accessDoc = docs[2 * i + 1];
        const billing = billingDoc.data();
        if (billingDoc.exists) {
          totals.billingPresent++;
          const start = typeof billing.trialStartedAt === 'string' ? Date.parse(billing.trialStartedAt) : NaN;
          if (!Number.isFinite(start)) totals.billingTrialDateNotValidString++;
          else if (validRegistration && start !== registration) totals.billingTrialDateDiffersFromAuth++;
        } else totals.billingMissing++;
        let paidExpiry = null;
        if (billing?.isPaid === true) {
          totals.paidFlagTrue++;
          const parsed = typeof billing.paidExpiresAt === 'string' ? Date.parse(billing.paidExpiresAt) : NaN;
          if (!Number.isFinite(parsed)) totals.paidExpiryNotValidString++; else paidExpiry = parsed;
        }
        if (accessDoc.exists) {
          totals.accessPresent++;
          const access = accessDoc.data();
          if (!validRegistration || access.registeredAt?.toMillis?.() !== registration) totals.accessRegistrationMismatch++;
          const until = access.paidUntil == null ? null : access.paidUntil?.toMillis?.() ?? 'invalid';
          if (until !== paidExpiry) totals.accessPaidUntilMismatch++;
        } else totals.accessMissing++;
      });
    }
    pageToken = page.pageToken;
  } while (pageToken);
  console.log(JSON.stringify({ project: projectId, database: '(default)', settings, totals }, null, 2));
} catch (error) {
  // Do not print credential-bearing command output or per-user data.
  console.error('Read-only audit failed. No data was modified. Error code:', error?.code || 'unavailable');
  process.exitCode = 1;
} finally {
  await deleteApp(app);
}
