import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const setup = readFileSync('src/components/views/InitialSetupView.tsx', 'utf8');
const app = readFileSync('src/App.tsx', 'utf8');
const simulation = readFileSync('src/components/views/AdminNewUserSimulation.tsx', 'utf8');

test('initial setup has explicit localized back and cancel navigation', () => {
  assert.match(setup, /Back to sign-in/);
  assert.match(setup, /العودة لتسجيل الدخول/);
  assert.match(setup, /Cancel setup/);
  assert.match(setup, /إلغاء الإعداد/);
  assert.match(setup, /disabled=\{saving \|\| leaving\}/);
});
test('leaving after edits confirms unsaved changes', () => {
  assert.match(setup, /hasUnsavedChanges/);
  assert.match(setup, /window\.confirm/);
});
test('real setup signs out before returning to Google login', () => {
  assert.match(app, /const leaveInitialSetup = async \(\) => \{/);
  assert.match(app, /await logoutUser\(\)/);
  assert.match(app, /onBack=\{leaveInitialSetup\} onCancel=\{leaveInitialSetup\}/);
});
test('simulated setup returns without signing into Google or changing Firebase', () => {
  assert.match(simulation, /onBack=\{\(\) => setStage\('login'\)\} onCancel=\{onExit\}/);
});
