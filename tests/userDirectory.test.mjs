import test from 'node:test';
import assert from 'node:assert/strict';
import { backfillUserDirectory } from '../server/userDirectory.ts';

function environment() {
  const stored = new Map();
  const users = Array.from({ length: 205 }, (_, i) => ({ uid: `u${i}`, displayName: `User ${i}`, email: `USER${i}@example.com`, disabled: false, metadata: { creationTime: '2026-01-01T00:00:00Z' } }));
  const auth = { async listUsers(size, token) { const start = Number(token || 0); const end = Math.min(start + size, users.length); return { users: users.slice(start, end), pageToken: end < users.length ? String(end) : undefined }; } };
  const db = { collection() { return { doc(id) { return { id }; } }; }, async getAll(...refs) { return refs.map(ref => ({ exists: stored.has(ref.id), data: () => stored.get(ref.id) })); }, batch() { const changes = []; return { set(ref, value) { changes.push([ref.id, value]); }, async commit() { for (const [id, value] of changes) stored.set(id, value); } }; } };
  return { deps: { auth, db }, stored };
}

test('owner can index all accounts across pages, and reruns do not rewrite unchanged data', async () => {
  const { deps, stored } = environment();
  let token; let checked = 0;
  do { const result = await backfillUserDirectory({ email: 'waelvts@gmail.com' }, token, deps); assert.equal(result.verified, result.examined); checked += result.examined; token = result.nextPageToken || undefined; } while (token);
  assert.equal(checked, 205); assert.equal(stored.size, 205);
  assert.equal(stored.get('u204').emailSearch, 'user204@example.com');
  assert.equal((await backfillUserDirectory({ email: 'waelvts@gmail.com' }, undefined, deps)).updated, 0);
});

test('non-admin cannot start directory backfill', async () => {
  const { deps } = environment();
  await assert.rejects(backfillUserDirectory({ email: 'other@example.com' }, undefined, deps), error => error.code === 'admin_only');
});
