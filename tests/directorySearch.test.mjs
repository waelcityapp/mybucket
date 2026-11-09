import test from 'node:test';
import assert from 'node:assert/strict';
import { directoryMatchesSearch, directorySearchTrigrams } from '../server/directorySearch.ts';

test('substring search finds records beyond the first 200, including Arabic and email', () => {
  const users = Array.from({ length: 300 }, (_, i) => ({ name: `مستخدم رقم ${i}`, email: `person${i}@example.com` }));
  users[275] = { name: 'سارة محمد علي', email: 'sara275@example.com' };
  assert.equal(users.findIndex(u => directoryMatchesSearch(u.name, u.email, 'محمد')), 275);
  assert.equal(users.findIndex(u => directoryMatchesSearch(u.name, u.email, '275@EXAMPLE')), 275);
  const grams = directorySearchTrigrams(users[275].name, users[275].email);
  assert.ok(grams.includes('محم'));
  assert.ok(grams.includes('275'));
  assert.equal(directoryMatchesSearch(users[275].name, users[275].email, 'حمد ع'), true);
});

test('trigrams are candidates only and a full match is checked', () => {
  assert.equal(directoryMatchesSearch('أحمد', 'a@example.com', 'حمد@example'), false);
  assert.deepEqual(directorySearchTrigrams('aaaa', ''), ['a', 'aa', 'aaa']);
});
