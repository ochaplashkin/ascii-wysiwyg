import { describe, expect, it } from 'vitest';

import { lineDiff } from './line-diff.js';

describe('lineDiff', () => {
  it('reports no changes for identical text', () => {
    const result = lineDiff('a\nb', 'a\nb');

    expect(result.added).toBe(0);
    expect(result.removed).toBe(0);
    expect(result.rows.map((row) => row.kind)).toEqual(['equal', 'equal']);
  });

  it('finds a changed line inside a large unchanged block', () => {
    const result = lineDiff('a\nb\nc', 'a\nB\nc');

    expect(result.added).toBe(1);
    expect(result.removed).toBe(1);
    expect(result.rows.map((row) => `${row.kind}:${row.text}`)).toEqual([
      'equal:a',
      'removed:b',
      'added:B',
      'equal:c',
    ]);
  });

  it('tracks line numbers on both sides', () => {
    const result = lineDiff('one\ntwo', 'one\ninserted\ntwo');
    const added = result.rows.find((row) => row.kind === 'added');

    expect(added).toMatchObject({
      text: 'inserted',
      leftNumber: null,
      rightNumber: 2,
    });
    expect(result.rows.at(-1)).toMatchObject({
      text: 'two',
      leftNumber: 2,
      rightNumber: 3,
    });
  });

  it('handles empty input', () => {
    expect(lineDiff('', '').rows).toEqual([]);

    const result = lineDiff('', 'new line');
    expect(result.added).toBe(1);
    expect(result.rows).toEqual([
      { kind: 'added', text: 'new line', leftNumber: null, rightNumber: 1 },
    ]);
  });

  it('keeps a trailing newline difference visible', () => {
    const result = lineDiff('a\n', 'a');
    expect(result.rows.some((row) => row.kind === 'removed')).toBe(true);
  });
});
