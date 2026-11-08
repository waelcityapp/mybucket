import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyPresenceDevice } from '../src/utils/presenceDevices.ts';

test('classifies recognizable mobile and computer devices and preserves unknown', () => {
  assert.equal(classifyPresenceDevice('Mozilla/5.0 (Linux; Android 14) Mobile'), 'mobile');
  assert.equal(classifyPresenceDevice('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)'), 'mobile');
  assert.equal(classifyPresenceDevice('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'computer');
  assert.equal(classifyPresenceDevice('unrecognized'), 'unknown');
});
