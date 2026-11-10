import { describe, expect, it } from 'vitest';

import type { DiffRow } from './diff.js';
import { buildDisplayEntries, withContextHeadings } from './display-rows.js';
import type { BlockKind, RenderBlock } from './render.js';

const block = (
  kind: BlockKind,
  text: string,
  html = `<p>${text}</p>`,
): RenderBlock => ({
  id: html,
  kind,
  html,
  key: `${kind}\u0000${html}`,
  text,
});

const row = (
  status: DiffRow['status'],
  left: RenderBlock | null,
  right: RenderBlock | null,
  key: string,
): DiffRow => ({ key, status, left, right });

const heading = (text: string) => block('heading', text, `<h2>${text}</h2>`);
const paragraph = (text: string) => block('block', text);

describe('buildDisplayEntries', () => {
  it('collapses a run of three or more unchanged rows', () => {
    const rows = [
      row('equal', heading('Intro'), heading('Intro'), 'r1'),
      row('equal', paragraph('one'), paragraph('one'), 'r2'),
      row('equal', paragraph('two'), paragraph('two'), 'r3'),
      row('modified', paragraph('old'), paragraph('new'), 'r4'),
    ];

    const entries = buildDisplayEntries(rows, false);

    expect(entries.map((entry) => entry.type)).toEqual(['group', 'row']);
    const group = entries[0];
    expect(group?.type === 'group' && group.rows).toHaveLength(3);
  });

  it('keeps short unchanged runs as normal rows', () => {
    const rows = [
      row('equal', paragraph('one'), paragraph('one'), 'r1'),
      row('equal', paragraph('two'), paragraph('two'), 'r2'),
      row('modified', paragraph('old'), paragraph('new'), 'r3'),
    ];

    const entries = buildDisplayEntries(rows, false);

    expect(entries.map((entry) => entry.type)).toEqual([
      'row',
      'row',
      'row',
    ]);
  });

  it('keeps a heading as context in only-changes mode', () => {
    const rows = [
      row('equal', block('title', 'Doc', '<h1>Doc</h1>'), block('title', 'Doc', '<h1>Doc</h1>'), 'r1'),
      row('equal', heading('Section'), heading('Section'), 'r2'),
      row('equal', paragraph('context'), paragraph('context'), 'r3'),
      row('modified', paragraph('old'), paragraph('new'), 'r4'),
      row('equal', paragraph('after'), paragraph('after'), 'r5'),
    ];

    const visible = withContextHeadings(rows).map((item) => item.key);

    expect(visible).toEqual(['r2', 'r4']);
  });

  it('does not cross a previous change while looking for context', () => {
    const rows = [
      row('equal', heading('First'), heading('First'), 'r1'),
      row('modified', paragraph('one old'), paragraph('one new'), 'r2'),
      row('equal', paragraph('middle'), paragraph('middle'), 'r3'),
      row('modified', paragraph('two old'), paragraph('two new'), 'r4'),
    ];

    const visible = withContextHeadings(rows).map((item) => item.key);

    // The heading is before the first change and cannot be context for the
    // second change without crossing the first one.
    expect(visible).toEqual(['r1', 'r2', 'r4']);
  });

  it('returns only changes when there is no heading', () => {
    const rows = [
      row('equal', paragraph('one'), paragraph('one'), 'r1'),
      row('modified', paragraph('old'), paragraph('new'), 'r2'),
    ];

    expect(
      buildDisplayEntries(rows, true).map((entry) =>
        entry.type === 'row' ? entry.row.key : 'group',
      ),
    ).toEqual(['r2']);
  });
});
