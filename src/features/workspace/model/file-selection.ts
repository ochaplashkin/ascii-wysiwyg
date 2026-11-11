/**
 * Compare selection: at most two files, ordered as slots A (`left`) and B
 * (`right`). Checking files is independent from the file opened in the editor.
 */
export type FileSlot = 'left' | 'right';

export interface FileSelection {
  left: string | null;
  right: string | null;
}

export const EMPTY_SELECTION: FileSelection = { left: null, right: null };

export const MAX_COMPARE_FILES = 2;

export const slotFor = (
  selection: FileSelection,
  path: string,
): FileSlot | null => {
  if (selection.left === path) return 'left';
  if (selection.right === path) return 'right';
  return null;
};

export const isSelected = (selection: FileSelection, path: string): boolean =>
  slotFor(selection, path) !== null;

export const selectedCount = (selection: FileSelection): number =>
  (selection.left ? 1 : 0) + (selection.right ? 1 : 0);

export const isComplete = (
  selection: FileSelection,
): selection is { left: string; right: string } =>
  selection.left !== null && selection.right !== null;

/**
 * True when the checkbox can be changed. A third file is blocked while two
 * other files are already selected: it never silently replaces a slot.
 */
export const canToggle = (selection: FileSelection, path: string): boolean =>
  isSelected(selection, path) || !isComplete(selection);

/**
 * Checks or unchecks a file. Checking fills A first, then B. A third file is
 * ignored (`canToggle` returns false for it, so the UI disables the checkbox).
 */
export function toggleSelection(
  selection: FileSelection,
  path: string,
): FileSelection {
  const slot = slotFor(selection, path);
  if (slot === 'left') return { ...selection, left: null };
  if (slot === 'right') return { ...selection, right: null };

  if (selection.left === null) return { ...selection, left: path };
  if (selection.right === null) return { ...selection, right: path };
  return selection;
}

export const clearSlot = (
  selection: FileSelection,
  slot: FileSlot,
): FileSelection => ({
  ...selection,
  [slot]: null,
});

export const swapSelection = (selection: FileSelection): FileSelection => ({
  left: selection.right,
  right: selection.left,
});

export const pathsOf = (selection: FileSelection): string[] =>
  [selection.left, selection.right].filter(
    (path): path is string => path !== null,
  );
