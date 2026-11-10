import { describe, expect, it } from 'vitest';

import { blockSimilarity, buildDiffRows, diffStats } from './diff.js';
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

describe('blockSimilarity', () => {
  it('returns zero for different block kinds', () => {
    expect(blockSimilarity(block('block', 'alpha'), block('heading', 'alpha'))).toBe(0);
  });

  it('scores related paragraphs higher than unrelated ones', () => {
    const related = blockSimilarity(
      block('block', 'language ru-RU is the default'),
      block('block', 'language en-US is the default'),
    );
    const unrelated = blockSimilarity(
      block('block', 'language ru-RU is the default'),
      block('block', 'completely different words here'),
    );

    expect(related).toBeGreaterThan(unrelated);
    expect(related).toBeGreaterThan(0.25);
  });
});

describe('buildDiffRows', () => {
  it('keeps identical documents equal', () => {
    const rows = buildDiffRows([block('block', 'alpha')], [block('block', 'alpha')]);

    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('equal');
    expect(diffStats(rows).changes).toBe(0);
  });

  it('pairs a single replacement as modified', () => {
    const rows = buildDiffRows(
      [block('block', 'old paragraph')],
      [block('block', 'new paragraph')],
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('modified');
    expect(rows[0]?.left?.text).toBe('old paragraph');
    expect(rows[0]?.right?.text).toBe('new paragraph');
  });

  it('marks inserted and removed blocks', () => {
    const rows = buildDiffRows(
      [block('block', 'alpha')],
      [block('block', 'alpha'), block('block', 'beta')],
    );

    expect(rows.map((row) => row.status)).toEqual(['equal', 'added']);

    const reverse = buildDiffRows(
      [block('block', 'alpha'), block('block', 'beta')],
      [block('block', 'alpha')],
    );

    expect(reverse.map((row) => row.status)).toEqual(['equal', 'removed']);
  });

  it('aligns hunks by similarity instead of position', () => {
    const oldBlocks = [
      block('block', 'alpha one'),
      block('block', 'beta two'),
      block('block', 'gamma three'),
    ];
    const newBlocks = [block('block', 'alpha 1'), block('block', 'gamma 3')];

    const rows = buildDiffRows(oldBlocks, newBlocks);

    expect(rows.map((row) => row.status)).toEqual([
      'modified',
      'removed',
      'modified',
    ]);
    expect(rows[0]?.left?.text).toBe('alpha one');
    expect(rows[0]?.right?.text).toBe('alpha 1');
    expect(rows[1]?.left?.text).toBe('beta two');
    expect(rows[2]?.left?.text).toBe('gamma three');
    expect(rows[2]?.right?.text).toBe('gamma 3');
  });

  it('does not pair blocks of different kinds', () => {
    const rows = buildDiffRows(
      [block('block', 'same text')],
      [block('heading', 'same text', '<h2>same text</h2>')],
    );

    expect(rows.map((row) => row.status)).toEqual(['removed', 'added']);
  });

  it('counts every kind of change', () => {
    const rows = buildDiffRows(
      [
        block('block', 'alpha'),
        block('block', 'beta'),
        block('block', 'gamma'),
      ],
      [
        block('block', 'alpha'),
        block('block', 'beta changed'),
        block('block', 'delta'),
        block('block', 'epsilon'),
      ],
    );

    const stats = diffStats(rows);

    expect(stats.equal).toBe(1);
    expect(stats.changes).toBe(stats.modified + stats.added + stats.removed);
    expect(stats.changes).toBeGreaterThan(0);
  });
});
