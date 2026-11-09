// Read-only: verify target counts and live-code ref before a rules rollout.
import { execFileSync } from 'node:child_process';

try {
  const main = execFileSync('git', ['ls-remote','https://github.com/waelcityapp/mybucket.git','refs/heads/main'], { encoding:'utf8', stdio:['ignore','pipe','pipe'] }).trim().split(/\s+/)[0];
  if (main !== 'd817eada44abcddfb4c8948a7c594d6f5f6b2082') throw new Error('main-changed');
  const report = JSON.parse(execFileSync(process.execPath, ['scripts/audit-subscription-access.mjs'], { encoding:'utf8', stdio:['ignore','pipe','pipe'] }));
  const t = report.totals;
  const safe = report.project === 'mybucket-8b6f0' && report.database === '(default)'
    && report.settings?.proDays === 15 && report.settings?.basicDays === 72
    && t?.authAccounts === 5 && t.creationDateValid === 5 && t.creationDateInvalid === 0
    && t.accessPresent === 5 && t.accessMissing === 0 && t.accessRegistrationMismatch === 0 && t.accessPaidUntilMismatch === 0
    && t.accessInvalidSchema === 0 && t.accessPaidUntilInvalidType === 0
    && t.billingMissing === 5 && t.billingPresent === 0
    && t.profilesPresent === 5 && t.profilesMissing === 0 && t.profileUserIdMismatch === 0 && t.profileUnexpectedFieldTypes === 0;
  if (!safe) throw new Error('data-changed-or-needs-review');
  console.log('PRECHECK PASSED: 5 accounts, matching access records, current settings, and reviewed main revision.');
} catch (error) {
  const reasons = ['main-changed','data-changed-or-needs-review'];
  console.error('PRECHECK STOPPED:', reasons.includes(error?.message) ? error.message : 'read-only-check-unavailable');
  process.exitCode = 1;
}
