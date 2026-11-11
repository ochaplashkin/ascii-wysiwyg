export type LineDiffKind = 'equal' | 'added' | 'removed';

export interface LineDiffRow {
  kind: LineDiffKind;
  text: string;
  /** 1-based line number in the baseline, if the line exists there. */
  leftNumber: number | null;
  /** 1-based line number in the revised text, if the line exists there. */
  rightNumber: number | null;
}

export interface LineDiffResult {
  rows: LineDiffRow[];
  added: number;
  removed: number;
}

const MAX_MATRIX = 1_000_000;

type Op = { kind: LineDiffKind; left: number | null; right: number | null };

const lcsOps = (before: string[], after: string[]): Op[] => {
  const rows = before.length;
  const cols = after.length;

  if (rows * cols > MAX_MATRIX) {
    // Very large rewrites are rare; a simple replacement block is honest and
    // avoids freezing the normalization panel.
    return [
      ...before.map((_, index) => ({ kind: 'removed' as const, left: index, right: null })),
      ...after.map((_, index) => ({ kind: 'added' as const, left: null, right: index })),
    ];
  }

  const table: Uint32Array[] = Array.from({ length: rows + 1 }, () =>
    new Uint32Array(cols + 1),
  );

  for (let row = rows - 1; row >= 0; row -= 1) {
    const current = table[row] as Uint32Array;
    const next = table[row + 1] as Uint32Array;

    for (let col = cols - 1; col >= 0; col -= 1) {
      current[col] =
        before[row] === after[col]
          ? (next[col + 1] as number) + 1
          : Math.max(next[col] as number, current[col + 1] as number);
    }
  }

  const ops: Op[] = [];
  let row = 0;
  let col = 0;

  while (row < rows && col < cols) {
    if (before[row] === after[col]) {
      ops.push({ kind: 'equal', left: row, right: col });
      row += 1;
      col += 1;
      continue;
    }

    const current = table[row] as Uint32Array;
    const next = table[row + 1] as Uint32Array;

    if ((next[col] as number) >= (current[col + 1] as number)) {
      ops.push({ kind: 'removed', left: row, right: null });
      row += 1;
    } else {
      ops.push({ kind: 'added', left: null, right: col });
      col += 1;
    }
  }

  while (row < rows) {
    ops.push({ kind: 'removed', left: row, right: null });
    row += 1;
  }

  while (col < cols) {
    ops.push({ kind: 'added', left: null, right: col });
    col += 1;
  }

  return ops;
};

/**
 * Line-level diff used by the WYSIWYG normalization panel. It is deliberately
 * simpler than the block diff of the compare view: it shows exactly which
 * lines a serializer rebuild changed.
 */
export function lineDiff(before: string, after: string): LineDiffResult {
  if (before === after) {
    const lines = before.length === 0 ? [] : before.split('\n');
    return {
      rows: lines.map((text, index) => ({
        kind: 'equal',
        text,
        leftNumber: index + 1,
        rightNumber: index + 1,
      })),
      added: 0,
      removed: 0,
    };
  }

  const leftLines = before.length === 0 ? [] : before.split('\n');
  const rightLines = after.length === 0 ? [] : after.split('\n');

  let prefix = 0;
  while (
    prefix < leftLines.length &&
    prefix < rightLines.length &&
    leftLines[prefix] === rightLines[prefix]
  ) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < leftLines.length - prefix &&
    suffix < rightLines.length - prefix &&
    leftLines[leftLines.length - 1 - suffix] ===
      rightLines[rightLines.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const ops: Op[] = [];
  for (let index = 0; index < prefix; index += 1) {
    ops.push({ kind: 'equal', left: index, right: index });
  }

  ops.push(
    ...lcsOps(
      leftLines.slice(prefix, leftLines.length - suffix),
      rightLines.slice(prefix, rightLines.length - suffix),
    ).map((op) => ({
      ...op,
      left: op.left === null ? null : op.left + prefix,
      right: op.right === null ? null : op.right + prefix,
    })),
  );

  for (let index = 0; index < suffix; index += 1) {
    ops.push({
      kind: 'equal',
      left: leftLines.length - suffix + index,
      right: rightLines.length - suffix + index,
    });
  }

  let added = 0;
  let removed = 0;
  const rows = ops.map((op): LineDiffRow => {
    if (op.kind === 'added') added += 1;
    if (op.kind === 'removed') removed += 1;

    return {
      kind: op.kind,
      text:
        op.kind === 'added'
          ? (rightLines[op.right as number] ?? '')
          : (leftLines[op.left as number] ?? ''),
      leftNumber: op.left === null ? null : op.left + 1,
      rightNumber: op.right === null ? null : op.right + 1,
    };
  });

  return { rows, added, removed };
}
