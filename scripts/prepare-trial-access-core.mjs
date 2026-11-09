import { buildTrialAccessPlan } from './trial-access-plan.mjs';
import { buildTrialAccessCommit } from './trial-access-commit-plan.mjs';

// adapter provides read-only enumeration/reads and an explicit atomic commit.
export async function prepareTrialAccess({ adapter, execute = false }) {
  const setting = await adapter.readSettings();
  if (setting?.proDays !== 15 || setting?.basicDays !== 72 || typeof setting.updateTime !== 'string') throw new Error('settings-changed');
  const users = await adapter.listUsers();
  if (users.length !== 5) throw new Error('account-count-changed');
  const inputs = await Promise.all(users.map(async user => {
    const state = await adapter.readBillingState(user.uid);
    return { uid:user.uid, creationTime:user.creationTime, ...state };
  }));
  const plan = buildTrialAccessPlan(inputs);
  if (plan.summary.total !== 5 || plan.summary.toCreate !== 5 || plan.summary.alreadyPresent || plan.summary.needsReview) throw new Error('review-required');
  const commit = buildTrialAccessCommit({ records:plan.records, expectedCount:5, settingsUpdateTime:setting.updateTime });
  if (execute) await adapter.commit(commit);
  return { mode:execute ? 'committed' : 'preview', proposed:plan.summary.toCreate, settings:{proDays:15,basicDays:72} };
}
