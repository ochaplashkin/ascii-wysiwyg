// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  SIDEBAR_DEFAULT_WIDTH,
  SIDEBAR_MAX_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_WIDTH_STORAGE_KEY,
  clampSidebarWidth,
  readStoredSidebarWidth,
  storeSidebarWidth,
} from './sidebar-layout.js';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe('clampSidebarWidth', () => {
  it('keeps in-range widths and clamps the extremes', () => {
    expect(clampSidebarWidth(300)).toBe(300);
    expect(clampSidebarWidth(SIDEBAR_MIN_WIDTH)).toBe(SIDEBAR_MIN_WIDTH);
    expect(clampSidebarWidth(SIDEBAR_MAX_WIDTH)).toBe(SIDEBAR_MAX_WIDTH);
    expect(clampSidebarWidth(100)).toBe(SIDEBAR_MIN_WIDTH);
    expect(clampSidebarWidth(999)).toBe(SIDEBAR_MAX_WIDTH);
  });

  it('rounds fractions and falls back for non-numbers', () => {
    expect(clampSidebarWidth(300.6)).toBe(301);
    expect(clampSidebarWidth(Number.NaN)).toBe(SIDEBAR_DEFAULT_WIDTH);
    expect(clampSidebarWidth(Number.POSITIVE_INFINITY)).toBe(
      SIDEBAR_DEFAULT_WIDTH,
    );
  });
});

describe('sidebar width storage', () => {
  it('returns the default when nothing is stored', () => {
    expect(readStoredSidebarWidth()).toBe(SIDEBAR_DEFAULT_WIDTH);
  });

  it('round-trips a stored width and clamps corrupt values', () => {
    storeSidebarWidth(420);
    expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe('420');
    expect(readStoredSidebarWidth()).toBe(420);

    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, 'not-a-number');
    expect(readStoredSidebarWidth()).toBe(SIDEBAR_DEFAULT_WIDTH);

    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, '9999');
    expect(readStoredSidebarWidth()).toBe(SIDEBAR_MAX_WIDTH);
  });

  it('survives storage read and write errors', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readStoredSidebarWidth()).toBe(SIDEBAR_DEFAULT_WIDTH);

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(() => storeSidebarWidth(320)).not.toThrow();
  });
});
