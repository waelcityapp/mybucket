import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isRecentlyPresent, PRESENCE_WINDOW_MS } from '../server/presence.ts';

test('presence expires after the heartbeat window', () => {
  const now = 10_000_000;
  assert.equal(isRecentlyPresent(null, now), false);
  assert.equal(isRecentlyPresent(now, now), true);
  assert.equal(isRecentlyPresent(now - PRESENCE_WINDOW_MS, now), true);
  assert.equal(isRecentlyPresent(now - PRESENCE_WINDOW_MS - 1, now), false);
  assert.equal(isRecentlyPresent(now + 1, now), false);
});
