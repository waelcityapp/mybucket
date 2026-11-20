import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const app = readFileSync('src/App.tsx','utf8');
const sample = readFileSync('src/components/views/AdminNewUserSimulation.tsx','utf8');

test('signed-out visitors see sign-in and new accounts go directly to real setup', () => {
  assert.match(app, /if \(!authUser && !guestDemo\) \{\s+return \(\s+<AuthPage/);
  assert.match(app, /return <InitialSetupView lang=\{lang\} canAddAccounts/);
  assert.doesNotMatch(app, /return <AdminNewUserSimulation lang=\{lang\} realOnboarding/);
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
