import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const srcDir = path.resolve('src');

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(tsx?|jsx?)$/.test(entry.name) && !/\.test\.[jt]sx?$/.test(entry.name) ? [full] : [];
  });
}

test('first-party app code does not use browser-native alert/confirm/prompt dialogs', () => {
  const nativeDialog = /(?:\b(?:window|globalThis|self)\s*\.\s*(?:alert|confirm|prompt)\s*\()|(?<![\w.$])(?:alert|confirm|prompt)\s*\(/g;
  const offenders = sourceFiles(srcDir).flatMap((file) => {
    const content = fs.readFileSync(file, 'utf8');
    return [...content.matchAll(nativeDialog)].map((match) => {
      const line = content.slice(0, match.index).split('\n').length;
      return path.relative(process.cwd(), file) + ':' + line + ' (' + match[0] + ')';
    });
  });
  assert.deepEqual(offenders, [], 'Use the shared AppConfirmDialog, or inline validation messages: ' + offenders.join(', '));
});

test('shared branded confirmation is mounted at the application root', () => {
  const entry = fs.readFileSync(path.join(srcDir, 'main.tsx'), 'utf8');
  assert.match(entry, /<AppConfirmProvider>\s*<App\s*\/>\s*<\/AppConfirmProvider>/);
});

test('financial deletion, reset, and unsaved setup require app-branded confirmation', () => {
  for (const file of [
    'App.tsx',
    'components/CategoryDetailModal.tsx',
    'components/ExpenseCategoriesModal.tsx',
    'components/views/InitialSetupView.tsx',
  ]) {
    assert.match(fs.readFileSync(path.join(srcDir, file), 'utf8'), /await confirmAction\(/, file + ' must await approval');
  }
});
