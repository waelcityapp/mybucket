import test from 'node:test';
import assert from 'node:assert/strict';
import { collectDirectoryRows } from '../server/directoryCollect.ts';

test('a sparse filter continues past 200 accounts without omissions or duplicates', async () => {
  const all = Array.from({length: 350}, (_, i) => ({uid:`u${i}`, tier:i % 17 === 0 ? 'paid' : 'trial', disabled:false, installed:false}));
  const read = async cursor => { const start = cursor === null ? 0 : all.findIndex(x => x.uid === cursor) + 1; const rows = all.slice(start, start + 25); return {rows, nextCursor:start + rows.length < all.length ? rows.at(-1).uid : null}; };
  let cursor = null; const result = [];
  do { const page = await collectDirectoryRows(read, 'paid', cursor); result.push(...page.selected); cursor = page.nextCursor; } while (cursor);
  assert.deepEqual(result.map(x => x.uid), all.filter(x => x.tier === 'paid').map(x => x.uid));
  assert.ok(result.some(x => Number(x.uid.slice(1)) > 200));
});

test('full pages resume at the last returned user even when the next scan has more records', async () => {
  const rows = Array.from({length: 60}, (_, i) => ({uid:`u${i}`, tier:'trial', disabled:false, installed:false}));
  const read = async cursor => {const start = cursor === null ? 0 : rows.findIndex(x => x.uid === cursor) + 1; const chunk = rows.slice(start, start + 25); return {rows:chunk, nextCursor:start + chunk.length < rows.length ? chunk.at(-1).uid : null};};
  let cursor = null, all = [];
  do { const page = await collectDirectoryRows(read, 'all', cursor); all.push(...page.selected); cursor=page.nextCursor; } while (cursor);
  assert.deepEqual(all, rows);
});
