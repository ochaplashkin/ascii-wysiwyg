import type { TreeNode } from './directory-tree.js';

/** One visible row of the tree, ready for flat `role="tree"` rendering. */
export interface FlatTreeRow {
  node: TreeNode;
  /** 0 for root rows. */
  depth: number;
  /** Path of the containing directory, `null` for root rows. */
  parentPath: string | null;
  /** 1-based position among the siblings. */
  posInSet: number;
  setSize: number;
}

/**
 * Flattens a tree into the rows that are currently visible. Children of a
 * collapsed directory are not included.
 */
export function flattenTree(
  nodes: readonly TreeNode[],
  isOpen: (path: string) => boolean,
): FlatTreeRow[] {
  const rows: FlatTreeRow[] = [];

  const visit = (
    items: readonly TreeNode[],
    depth: number,
    parentPath: string | null,
  ) => {
    items.forEach((node, index) => {
      rows.push({
        node,
        depth,
        parentPath,
        posInSet: index + 1,
        setSize: items.length,
      });

      if (node.type === 'directory' && isOpen(node.path)) {
        visit(node.children, depth + 1, node.path);
      }
    });
  };

  visit(nodes, 0, null);
  return rows;
}
