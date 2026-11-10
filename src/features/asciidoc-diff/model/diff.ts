import type { RenderBlock } from './render.js';

export type DiffStatus = 'equal' | 'modified' | 'added' | 'removed';

export interface DiffRow {
  key: string;
  status: DiffStatus;
  left: RenderBlock | null;
  right: RenderBlock | null;
}

export interface DiffStats {
  equal: number;
  modified: number;
  added: number;
  removed: number;
  changes: number;
}

type DiffOp =
  | { type: 'equal'; oldIndex: number; newIndex: number }
  | { type: 'delete'; oldIndex: number }
  | { type: 'insert'; newIndex: number };

interface HunkPair {
  oldIndex: number | null;
  newIndex: number | null;
}

const WORD_RE = /[\p{L}\p{N}_]+/gu;
const MIN_SIMILARITY = 0.25;
const EPSILON = 1e-9;

const blockKey = (block: RenderBlock) => block.key;

const words = (value: string): Set<string> => {
  const result = new Set<string>();

  for (const match of value.toLowerCase().matchAll(WORD_RE)) {
    result.add(match[0]);
  }

  return result;
};

/**
 * Jaccard similarity of word sets. It is cheap, deterministic and good enough
 * to tell "the same paragraph with edits" from "an unrelated block".
 */
const jaccard = (
  leftWords: Set<string>,
  rightWords: Set<string>,
): number => {
  if (leftWords.size === 0 || rightWords.size === 0) return 0;

  let intersection = 0;
  for (const word of leftWords) {
    if (rightWords.has(word)) intersection += 1;
  }

  return intersection / (leftWords.size + rightWords.size - intersection);
};

export function blockSimilarity(
  left: RenderBlock,
  right: RenderBlock,
): number {
  if (left.kind !== right.kind) return 0;

  const leftWords = words(left.text);
  const rightWords = words(right.text);

  if (leftWords.size === 0 || rightWords.size === 0) {
    return left.text === right.text ? 1 : 0;
  }

  return jaccard(leftWords, rightWords);
}

/**
 * Classic LCS-based diff. Rendered documents are small (dozens of blocks),
 * so a DP matrix is simpler and fast enough; an O(ND) Myers implementation
 * is not necessary here.
 */
function lcsOps(oldKeys: string[], newKeys: string[]): DiffOp[] {
  const oldLength = oldKeys.length;
  const newLength = newKeys.length;
  const table: Uint32Array[] = Array.from(
    { length: oldLength + 1 },
    () => new Uint32Array(newLength + 1),
  );

  for (let i = oldLength - 1; i >= 0; i -= 1) {
    const row = table[i] as Uint32Array;
    const nextRow = table[i + 1] as Uint32Array;

    for (let j = newLength - 1; j >= 0; j -= 1) {
      row[j] =
        oldKeys[i] === newKeys[j]
          ? (nextRow[j + 1] as number) + 1
          : Math.max(nextRow[j] as number, row[j + 1] as number);
    }
  }

  const ops: DiffOp[] = [];
  let i = 0;
  let j = 0;

  while (i < oldLength && j < newLength) {
    if (oldKeys[i] === newKeys[j]) {
      ops.push({ type: 'equal', oldIndex: i, newIndex: j });
      i += 1;
      j += 1;
      continue;
    }

    const row = table[i] as Uint32Array;
    const nextRow = table[i + 1] as Uint32Array;

    if ((nextRow[j] as number) >= (row[j + 1] as number)) {
      ops.push({ type: 'delete', oldIndex: i });
      i += 1;
    } else {
      ops.push({ type: 'insert', newIndex: j });
      j += 1;
    }
  }

  while (i < oldLength) {
    ops.push({ type: 'delete', oldIndex: i });
    i += 1;
  }

  while (j < newLength) {
    ops.push({ type: 'insert', newIndex: j });
    j += 1;
  }

  return ops;
}

/**
 * Aligns removed and added blocks inside one change hunk. Positional pairing
 * breaks as soon as a block is inserted or removed, so pairs are chosen by
 * kind and word similarity, preserving order (a monotonic alignment).
 */
function alignHunk(
  removedBlocks: RenderBlock[],
  addedBlocks: RenderBlock[],
): HunkPair[] {
  const rows = removedBlocks.length;
  const cols = addedBlocks.length;

  if (rows === 0) {
    return addedBlocks.map((_, index) => ({ oldIndex: null, newIndex: index }));
  }

  if (cols === 0) {
    return removedBlocks.map((_, index) => ({ oldIndex: index, newIndex: null }));
  }

  // Precompute word sets once per block: a hunk can contain dozens of blocks
  // and the alignment calls similarity for every candidate pair.
  const removedWords = removedBlocks.map((block) => words(block.text));
  const addedWords = addedBlocks.map((block) => words(block.text));

  const similarity = (oldIndex: number, newIndex: number): number => {
    const left = removedBlocks[oldIndex];
    const right = addedBlocks[newIndex];
    if (!left || !right || left.kind !== right.kind) return 0;

    const leftWords = removedWords[oldIndex];
    const rightWords = addedWords[newIndex];
    if (!leftWords || !rightWords) return 0;

    if (leftWords.size === 0 || rightWords.size === 0) {
      return left.text === right.text ? 1 : 0;
    }

    return jaccard(leftWords, rightWords);
  };

  const pairAllowed = (oldIndex: number, newIndex: number): boolean => {
    const left = removedBlocks[oldIndex];
    const right = addedBlocks[newIndex];
    if (!left || !right || left.kind !== right.kind) return false;

    // A single removed and a single added block of the same kind are a
    // replacement, even when the texts have nothing in common.
    if (rows === 1 && cols === 1) return true;

    return similarity(oldIndex, newIndex) >= MIN_SIMILARITY;
  };

  const scores: number[][] = Array.from({ length: rows + 1 }, () =>
    new Array<number>(cols + 1).fill(0),
  );

  for (let oldIndex = 1; oldIndex <= rows; oldIndex += 1) {
    for (let newIndex = 1; newIndex <= cols; newIndex += 1) {
      const scoresRow = scores[oldIndex] as number[];
      const previousRow = scores[oldIndex - 1] as number[];
      let best = Math.max(
        previousRow[newIndex] as number,
        scoresRow[newIndex - 1] as number,
      );

      if (pairAllowed(oldIndex - 1, newIndex - 1)) {
        const diagonal =
          (previousRow[newIndex - 1] as number) +
          similarity(oldIndex - 1, newIndex - 1);
        best = Math.max(best, diagonal);
      }

      scoresRow[newIndex] = best;
    }
  }

  const pairs: HunkPair[] = [];
  let oldIndex = rows;
  let newIndex = cols;

  while (oldIndex > 0 || newIndex > 0) {
    if (oldIndex > 0 && newIndex > 0 && pairAllowed(oldIndex - 1, newIndex - 1)) {
      const current = (scores[oldIndex] as number[])[newIndex] as number;
      const diagonal =
        ((scores[oldIndex - 1] as number[])[newIndex - 1] as number) +
        similarity(oldIndex - 1, newIndex - 1);

      if (Math.abs(current - diagonal) < EPSILON) {
        pairs.push({ oldIndex: oldIndex - 1, newIndex: newIndex - 1 });
        oldIndex -= 1;
        newIndex -= 1;
        continue;
      }
    }

    if (
      oldIndex > 0 &&
      (newIndex === 0 ||
        ((scores[oldIndex - 1] as number[])[newIndex] as number) >
          ((scores[oldIndex] as number[])[newIndex - 1] as number))
    ) {
      pairs.push({ oldIndex: oldIndex - 1, newIndex: null });
      oldIndex -= 1;
    } else {
      pairs.push({ oldIndex: null, newIndex: newIndex - 1 });
      newIndex -= 1;
    }
  }

  return pairs.reverse();
}

/**
 * Builds side-by-side rows. Exact matches become `equal` rows; each change
 * hunk is aligned into `modified`, `removed` and `added` rows.
 */
export function buildDiffRows(
  oldBlocks: RenderBlock[],
  newBlocks: RenderBlock[],
): DiffRow[] {
  const ops = lcsOps(oldBlocks.map(blockKey), newBlocks.map(blockKey));
  const rows: DiffRow[] = [];
  let opIndex = 0;
  let rowIndex = 0;

  const nextKey = () => `row-${rowIndex++}`;

  while (opIndex < ops.length) {
    const op = ops[opIndex] as DiffOp;

    if (op.type === 'equal') {
      rows.push({
        key: nextKey(),
        status: 'equal',
        left: oldBlocks[op.oldIndex] ?? null,
        right: newBlocks[op.newIndex] ?? null,
      });
      opIndex += 1;
      continue;
    }

    const removed: number[] = [];
    const added: number[] = [];

    while (opIndex < ops.length) {
      const current = ops[opIndex] as DiffOp;
      if (current.type === 'equal') break;
      if (current.type === 'delete') {
        removed.push(current.oldIndex);
      } else {
        added.push(current.newIndex);
      }
      opIndex += 1;
    }

    const oldHunk: RenderBlock[] = [];
    for (const index of removed) {
      const block = oldBlocks[index];
      if (block) oldHunk.push(block);
    }

    const newHunk: RenderBlock[] = [];
    for (const index of added) {
      const block = newBlocks[index];
      if (block) newHunk.push(block);
    }

    for (const pair of alignHunk(oldHunk, newHunk)) {
      const left = pair.oldIndex === null ? null : oldHunk[pair.oldIndex] ?? null;
      const right =
        pair.newIndex === null ? null : newHunk[pair.newIndex] ?? null;

      if (!left && !right) continue;

      const status: DiffStatus =
        left && right ? 'modified' : left ? 'removed' : 'added';

      rows.push({ key: nextKey(), status, left, right });
    }
  }

  return rows;
}

export function diffStats(rows: DiffRow[]): DiffStats {
  const stats: DiffStats = {
    equal: 0,
    modified: 0,
    added: 0,
    removed: 0,
    changes: 0,
  };

  for (const row of rows) {
    stats[row.status] += 1;
  }

  stats.changes = stats.modified + stats.added + stats.removed;
  return stats;
}
