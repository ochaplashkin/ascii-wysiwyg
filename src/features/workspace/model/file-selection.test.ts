import { describe, expect, it } from 'vitest';

import {
  EMPTY_SELECTION,
  MAX_COMPARE_FILES,
  canToggle,
  clearSlot,
  isComplete,
  selectedCount,
  slotFor,
  swapSelection,
  toggleSelection,
} from './file-selection.js';

describe('toggleSelection', () => {
  it('fills A first, then B', () => {
    const withA = toggleSelection(EMPTY_SELECTION, 'a.adoc');
    expect(withA).toEqual({ left: 'a.adoc', right: null });

    const withBoth = toggleSelection(withA, 'b.adoc');
    expect(withBoth).toEqual({ left: 'a.adoc', right: 'b.adoc' });
  });

  it('unchecks an already selected file without touching the other slot', () => {
    const selection = { left: 'a.adoc', right: 'b.adoc' };

    expect(toggleSelection(selection, 'a.adoc')).toEqual({
      left: null,
      right: 'b.adoc',
    });
    expect(toggleSelection(selection, 'b.adoc')).toEqual({
      left: 'a.adoc',
      right: null,
    });
  });

  it('blocks a third file instead of replacing a slot', () => {
    const selection = { left: 'a.adoc', right: 'b.adoc' };

    expect(canToggle(selection, 'c.adoc')).toBe(false);
    expect(toggleSelection(selection, 'c.adoc')).toBe(selection);
    expect(selectedCount(selection)).toBe(MAX_COMPARE_FILES);
  });

  it('does not mutate the previous selection', () => {
    const selection = { left: null, right: null };
    toggleSelection(selection, 'a.adoc');

    expect(selection).toEqual({ left: null, right: null });
  });
});

describe('canToggle', () => {
  it('allows checking when fewer than two files are selected', () => {
    expect(canToggle(EMPTY_SELECTION, 'a.adoc')).toBe(true);
    expect(canToggle({ left: 'a.adoc', right: null }, 'b.adoc')).toBe(true);
  });

  it('always allows unchecking a selected file', () => {
    expect(canToggle({ left: 'a.adoc', right: 'b.adoc' }, 'a.adoc')).toBe(true);
  });
});

describe('slotFor', () => {
  it('reports which slot holds the path', () => {
    const selection = { left: 'a.adoc', right: 'b.adoc' };

    expect(slotFor(selection, 'a.adoc')).toBe('left');
    expect(slotFor(selection, 'b.adoc')).toBe('right');
    expect(slotFor(selection, 'c.adoc')).toBeNull();
  });
});

describe('clearSlot and swapSelection', () => {
  it('empties only the requested slot', () => {
    expect(clearSlot({ left: 'a.adoc', right: 'b.adoc' }, 'left')).toEqual({
      left: null,
      right: 'b.adoc',
    });
  });

  it('exchanges the slots', () => {
    expect(swapSelection({ left: 'a.adoc', right: 'b.adoc' })).toEqual({
      left: 'b.adoc',
      right: 'a.adoc',
    });
    expect(swapSelection({ left: 'a.adoc', right: null })).toEqual({
      left: null,
      right: 'a.adoc',
    });
  });
});

describe('isComplete', () => {
  it('requires both slots', () => {
    expect(isComplete({ left: 'a.adoc', right: 'b.adoc' })).toBe(true);
    expect(isComplete({ left: 'a.adoc', right: null })).toBe(false);
    expect(isComplete(EMPTY_SELECTION)).toBe(false);
  });
});
