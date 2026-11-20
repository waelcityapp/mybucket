import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const app = readFileSync('src/App.tsx','utf8');
const sample = readFileSync('src/components/views/AdminNewUserSimulation.tsx','utf8');

test('new Google accounts see sample home before real account setup', () => {
  assert.match(app, /needsInitialSetup && financialLoaded\.accounts && financialLoaded\.transactions && transactions\.length === 0/);
  assert.ok(app.indexOf('return <AdminNewUserSimulation lang={lang} realOnboarding') < app.indexOf('if (authUser && needsInitialSetup && financialLoaded.accounts) {'));
  assert.match(app, /onStartReal=\{\(\) => setOnboardingSetupUid\(authUser\.uid\)\}/);
  assert.match(app, /onBack=\{\(\) => setOnboardingSetupUid\(null\)\}/);
});
test('samples stay in UI memory without paid calls or Firebase writes', () => {
  assert.match(sample, /useState<FinancialAccount\[\]>/);
  assert.match(sample, /useState<Transaction\[\]>/);
  assert.match(sample, /HomeFinancialOverview[^\n]+simulation/);
  assert.doesNotMatch(sample, /saveAllAccountsToFirestore|createFinancialTransaction|localStorage\.setItem|\/api\/gateway/);
});
test('admin simulator follows the same sample-first sequence', () => {
  assert.match(sample, /\(realOnboarding \|\| guestPreview\) \? 'dashboard' : 'login'/);
  assert.match(sample, /onSimulatedSignIn=\{\(\) => setStage\('dashboard'\)\}/);
  assert.match(sample, /realOnboarding \|\| guestPreview \? onStartReal : \(\) => setStage\('setup'\)/);
});
test('home example exposes sample data, edit controls, and explicit opt-in', () => {
  assert.match(sample, /ابدأ ببياناتي الحقيقية/);
  assert.match(sample, /هذه مجرد بيانات تجريبية يمكنك تعديلها/);
  assert.match(sample, /<QuickActions/);
  assert.match(sample, /<MoneySources/);
  assert.match(sample, /<TransactionsView/);
});

test('guest demo uses the actual app with separate sample data', () => {
  assert.match(app, /guestDemo = !authUser/);
  assert.match(app, /guestDemo \? guestAccounts : cloudAccounts/);
  assert.match(app, /<VoiceNaturalInput[\s\S]*?guestDemo=\{guestDemo\}/);
  assert.match(app, /setGuestTransactions/);
});
