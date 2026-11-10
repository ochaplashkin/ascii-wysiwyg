import { describe, expect, it } from 'vitest';

import {
  EMPTY_SELECTION,
  clearSlot,
  isComplete,
  selectFile,
  slotFor,
  swapSelection,
} from './file-selection.js';

describe('selectFile', () => {
  it('fills the original slot first, then the modified one', () => {
    const withLeft = selectFile(EMPTY_SELECTION, 'a.adoc');
    expect(withLeft).toEqual({ left: 'a.adoc', right: null });

    const withBoth = selectFile(withLeft, 'b.adoc');
    expect(withBoth).toEqual({ left: 'a.adoc', right: 'b.adoc' });
  });

  it('replaces the modified file when both slots are filled', () => {
    const selection = { left: 'a.adoc', right: 'b.adoc' };

    expect(selectFile(selection, 'c.adoc')).toEqual({
      left: 'a.adoc',
      right: 'c.adoc',
    });
  });

  it('removes a file that is already selected', () => {
    const selection = { left: 'a.adoc', right: 'b.adoc' };

    expect(selectFile(selection, 'a.adoc')).toEqual({
      left: null,
      right: 'b.adoc',
    });
    expect(selectFile(selection, 'b.adoc')).toEqual({
      left: 'a.adoc',
      right: null,
    });
  });

  it('does not mutate the previous selection', () => {
    const selection = { left: null, right: null };
    selectFile(selection, 'a.adoc');

    expect(selection).toEqual({ left: null, right: null });
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

describe('clearSlot', () => {
  it('empties only the requested slot', () => {
    const selection = { left: 'a.adoc', right: 'b.adoc' };

    expect(clearSlot(selection, 'left')).toEqual({
      left: null,
      right: 'b.adoc',
    });
  });
});

describe('swapSelection', () => {
  it('exchanges the slots', () => {
    expect(swapSelection({ left: 'a.adoc', right: 'b.adoc' })).toEqual({
      left: 'b.adoc',
      right: 'a.adoc',
    });
  });

  it('keeps a single selection on the opposite side', () => {
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
    expect(isComplete({ left: null, right: null })).toBe(false);
  });
});
