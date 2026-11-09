import test from 'node:test';
import assert from 'node:assert/strict';
import { readDirectoryPage } from '../server/directoryPage.ts';
import { directorySearchTrigrams } from '../server/directorySearch.ts';

const owner = { email: 'waelvts@gmail.com' };
function fakeDb(users) {
  const byId = new Map(users.map(u => [u.uid, u]));
  class Query {
    conditions = []; after = null; size = 100;
    where(field, op, value) { this.conditions.push({field, op, value}); return this; }
    orderBy() { return this; }
    startAfter(doc) { this.after = doc.id; return this; }
    limit(size) { this.size = size; return this; }
    async get() {
      let values = users.filter(u => this.conditions.every(c => c.op === 'array-contains' ? u[c.field].includes(c.value) : c.op === '<' ? u[c.field] < c.value : u[c.field] >= c.value));
      values.sort((a,b) => b.createdAtSort.localeCompare(a.createdAtSort) || b.uid.localeCompare(a.uid));
      if (this.after) values = values.slice(values.findIndex(u => u.uid === this.after) + 1);
      return { docs: values.slice(0,this.size).map(u => ({ id: u.uid, data: () => u })) };
    }
  }
  return { collection() { const q = new Query(); q.doc = id => ({ async get() { return { id, exists: byId.has(id), data: () => byId.get(id) }; } }); return q; } };
}
function fixtures() {
  return Array.from({length: 350}, (_, i) => {
    const name = i === 30 ? 'سارة محمد علي' : `مستخدم رقم ${i}`;
    const email = `user${i}@example.com`;
    const createdAtSort = new Date(Date.UTC(2026, 0, 1) + i * 86400000).toISOString();
    return {uid:`u${String(i).padStart(3, '0')}`, name,email,createdAtSort,searchGrams:directorySearchTrigrams(name,email)};
  });
}

test('search finds a matching account beyond first 200 and pages preserve newest-first order', async () => {
  const db = fakeDb(fixtures());
  const found = await readDirectoryPage(owner, {search:'محمد', period:'all'}, db);
  assert.deepEqual(found.users.map(u => u.uid), ['u030']);
  let cursor = null, ids = [];
  do { const page = await readDirectoryPage(owner, {period:'all',cursor}, db); ids.push(...page.users.map(u=>u.uid)); cursor = page.nextCursor; } while(cursor);
  assert.equal(ids.length,350); assert.equal(new Set(ids).size,350);
  assert.equal(ids[0],'u349'); assert.equal(ids.at(-1),'u000');
});

test('only administrator can query the directory', async () => {
  await assert.rejects(readDirectoryPage({email:'other@example.com'}, {}, fakeDb(fixtures())), e => e.code === 'admin_only');
});

test('custom date range applies both inclusive days using Cairo time', async () => {
  const db = fakeDb(fixtures());
  const page = await readDirectoryPage(owner, { period: 'custom', from: '2026-01-03', to: '2026-01-05' }, db);
  assert.deepEqual(page.users.map(u => u.uid), ['u004','u003','u002']);
});
