import type { DiffRow } from './diff.js';

export type DisplayEntry =
  | { type: 'row'; row: DiffRow }
  | { type: 'group'; key: string; rows: DiffRow[] };

export const UNCHANGED_GROUP_MIN = 3;

/**
 * In "only changes" mode an isolated paragraph loses its section context.
 * Keep the nearest preceding heading (or the document title) for every change
 * so the reader knows where the change lives.
 */
export function withContextHeadings(rows: DiffRow[]): DiffRow[] {
  const contextKeys = new Set<string>();

  rows.forEach((row, index) => {
    if (row.status === 'equal') return;

    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
      const candidate = rows[cursor];
      if (!candidate || candidate.status !== 'equal') break;

      const block = candidate.left;
      if (block?.kind === 'heading' || block?.kind === 'title') {
        contextKeys.add(candidate.key);
        break;
      }
    }
  });

  return rows.filter(
    (row) => row.status !== 'equal' || contextKeys.has(row.key),
  );
}

/**
 * Turns diff rows into grid entries. Long runs of unchanged blocks are
 * collapsed into a single "show N blocks" row; "only changes" keeps the
 * changed rows plus their nearest section headings.
 */
export function buildDisplayEntries(
  rows: DiffRow[],
  onlyChanges: boolean,
): DisplayEntry[] {
  if (onlyChanges) {
    return withContextHeadings(rows).map((row) => ({ type: 'row', row }));
  }

  const entries: DisplayEntry[] = [];
  let index = 0;

  while (index < rows.length) {
    const row = rows[index];
    if (!row) break;

    if (row.status !== 'equal') {
      entries.push({ type: 'row', row });
      index += 1;
      continue;
    }

    let end = index;
    while (end < rows.length && rows[end]?.status === 'equal') {
      end += 1;
    }

    const group = rows.slice(index, end);
    if (group.length >= UNCHANGED_GROUP_MIN) {
      const first = group[0];
      entries.push({
        type: 'group',
        key: `group-${first ? first.key : index}`,
        rows: group,
      });
    } else {
      group.forEach((item) => entries.push({ type: 'row', row: item }));
    }

    index = end;
  }

  return entries;
}
