import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import ts from 'typescript';

const srcDir = path.resolve('src');

function sourceFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(tsx?|jsx?)$/.test(entry.name) && !/\.test\.[jt]sx?$/.test(entry.name) ? [full] : [];
  });
}

test('first-party app code does not call browser-native dialogs', () => {
  // Parse the TypeScript AST rather than matching text: AI-language regular
  // expressions can legitimately contain phrases such as "confirm(...)".
  const offenders = sourceFiles(srcDir).flatMap((file) => {
    const content = fs.readFileSync(file, 'utf8');
    const source = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const violations = [];
    const visit = (node) => {
      if (ts.isCallExpression(node)) {
        const fn = node.expression;
        const nativeNames = new Set(['alert', 'confirm', 'prompt']);
        const isNative = (ts.isIdentifier(fn) && nativeNames.has(fn.text)) ||
          (ts.isPropertyAccessExpression(fn) && ts.isIdentifier(fn.expression) &&
            ['window', 'globalThis', 'self'].includes(fn.expression.text) &&
            nativeNames.has(fn.name.text));
        if (isNative) {
          const position = source.getLineAndCharacterOfPosition(node.getStart(source));
          violations.push(path.relative(process.cwd(), file) + ':' + (position.line + 1));
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
    return violations;
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
