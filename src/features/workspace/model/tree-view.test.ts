import { describe, expect, it } from 'vitest';

import { buildFileTree } from './directory-tree.js';
import { flattenTree } from './tree-view.js';

const tree = buildFileTree(
  ['root.adoc', 'docs/intro.adoc', 'docs/deep/part.adoc', 'docs/guide.adoc'],
  ['empty'],
);

describe('flattenTree', () => {
  it('hides children of a collapsed directory', () => {
    const rows = flattenTree(tree, () => false);

    expect(rows.map((row) => row.node.path)).toEqual([
      'docs',
      'empty',
      'root.adoc',
    ]);
  });

  it('shows children of an expanded directory', () => {
    const rows = flattenTree(tree, (path) => path === 'docs');

    expect(rows.map((row) => row.node.path)).toEqual([
      'docs',
      'docs/deep',
      'docs/guide.adoc',
      'docs/intro.adoc',
      'empty',
      'root.adoc',
    ]);
  });

  it('computes depth, parent and sibling positions', () => {
    const rows = flattenTree(
      tree,
      (path) => path === 'docs' || path === 'docs/deep',
    );

    const deep = rows.find((row) => row.node.path === 'docs/deep');
    expect(deep).toMatchObject({
      depth: 1,
      parentPath: 'docs',
      posInSet: 1,
      setSize: 3,
    });

    const part = rows.find((row) => row.node.path === 'docs/deep/part.adoc');
    expect(part).toMatchObject({
      depth: 2,
      parentPath: 'docs/deep',
      posInSet: 1,
      setSize: 1,
    });

    const rootFile = rows.find((row) => row.node.path === 'root.adoc');
    expect(rootFile).toMatchObject({
      depth: 0,
      parentPath: null,
      posInSet: 3,
      setSize: 3,
    });
  });

  it('returns an empty list for an empty tree', () => {
    expect(flattenTree([], () => true)).toEqual([]);
  });
});
