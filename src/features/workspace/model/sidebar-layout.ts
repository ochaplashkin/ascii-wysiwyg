/** Width limits and persistence for the resizable file sidebar. */

export const SIDEBAR_MIN_WIDTH = 240;
export const SIDEBAR_MAX_WIDTH = 480;
export const SIDEBAR_DEFAULT_WIDTH = 300;

/** `localStorage` key; the version suffix allows a future migration. */
export const SIDEBAR_WIDTH_STORAGE_KEY = 'asciidoc.sidebar.width.v1';

/** Clamps a width into the allowed range, falling back for non-numbers. */
export function clampSidebarWidth(width: number): number {
  if (!Number.isFinite(width)) return SIDEBAR_DEFAULT_WIDTH;
  return Math.min(
    SIDEBAR_MAX_WIDTH,
    Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)),
  );
}

/**
 * Reads the stored sidebar width. A missing, malformed or inaccessible
 * storage silently falls back to the default width.
 */
export function readStoredSidebarWidth(): number {
  try {
    const raw = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
    if (raw === null) return SIDEBAR_DEFAULT_WIDTH;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return SIDEBAR_DEFAULT_WIDTH;
    return clampSidebarWidth(parsed);
  } catch {
    return SIDEBAR_DEFAULT_WIDTH;
  }
}

/** Stores the sidebar width; storage errors are ignored. */
export function storeSidebarWidth(width: number): void {
  try {
    localStorage.setItem(
      SIDEBAR_WIDTH_STORAGE_KEY,
      String(clampSidebarWidth(width)),
    );
  } catch {
    // Private mode or a full storage must not break resizing.
  }
}
