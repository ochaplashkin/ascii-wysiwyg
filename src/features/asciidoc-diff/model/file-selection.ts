export type FileSlot = 'left' | 'right';

/**
 * Pending choice in the directory sidebar. Paths are relative to the picked
 * directory; `null` means the slot is still empty.
 */
export interface FileSelection {
  left: string | null;
  right: string | null;
}

export const EMPTY_SELECTION: FileSelection = { left: null, right: null };

/**
 * Clicking a file puts it into the first empty slot (original first, then
 * modified). Once both slots are filled, a new file replaces the modified
 * one. Clicking an already selected file removes it again.
 */
export function selectFile(
  selection: FileSelection,
  path: string,
): FileSelection {
  if (selection.left === path) return { ...selection, left: null };
  if (selection.right === path) return { ...selection, right: null };
  if (selection.left === null) return { ...selection, left: path };
  return { ...selection, right: path };
}

export const slotFor = (
  selection: FileSelection,
  path: string,
): FileSlot | null => {
  if (selection.left === path) return 'left';
  if (selection.right === path) return 'right';
  return null;
};

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

export type CompleteSelection = {
  left: string;
  right: string;
};

export const isComplete = (
  selection: FileSelection,
): selection is CompleteSelection =>
  selection.left !== null && selection.right !== null;
