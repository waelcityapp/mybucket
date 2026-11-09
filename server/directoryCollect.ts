export type DirectoryRow = { uid: string; disabled: boolean; installed: boolean; tier: string; trialPlan?: 'pro' | 'basic' };
export type UserFilter = 'all' | 'paid' | 'trial' | 'trial_pro' | 'trial_basic' | 'free' | 'disabled' | 'installed';

/** Continue scanning bounded pages, retaining a cursor even for sparse filters. */
export async function collectDirectoryRows<Row extends DirectoryRow>(
  read: (cursor: string | null) => Promise<{ rows: Row[]; nextCursor: string | null }>,
  filter: UserFilter,
  initialCursor: string | null,
) {
  let cursor = initialCursor;
  let nextCursor: string | null = null;
  const selected: Row[] = [];
  for (let step = 0; step < 4; step++) {
    const page = await read(cursor);
    let filled = false;
    for (const row of page.rows) {
      const matches = filter === 'all' || (filter === 'disabled' ? row.disabled : filter === 'installed' ? row.installed : filter === 'trial_pro' ? row.tier === 'trial' && row.trialPlan === 'pro' : filter === 'trial_basic' ? row.tier === 'trial' && row.trialPlan === 'basic' : row.tier === filter);
      if (matches) selected.push(row);
      if (selected.length === 25) { nextCursor = row.uid; filled = true; break; }
    }
    if (filled) break;
    nextCursor = page.nextCursor;
    if (!nextCursor) break;
    cursor = nextCursor;
  }
  return { selected, nextCursor };
}
