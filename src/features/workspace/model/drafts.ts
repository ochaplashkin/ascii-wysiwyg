/**
 * Local drafts for files opened from the user's directory.
 *
 * Nothing is ever written to disk: the source file stays untouched and every
 * edit lives in `localStorage` under a key that is unique per folder and file.
 */

export const DRAFT_PREFIX = 'ascii-wysiwyg:draft:v2';
export const DRAFT_VERSION = 2;

export interface DraftRecord {
  version: typeof DRAFT_VERSION;
  text: string;
  /** ISO timestamp of the last successful write. */
  savedAt: string;
  /** Hash of the on-disk text the draft was created from. */
  baseHash: string;
}

export interface DraftStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export interface DraftListStorage extends DraftStorage {
  readonly length: number;
  key: (index: number) => string | null;
}

const safeStorage = (): Storage | null => {
  try {
    if (typeof window === 'undefined') return null;
    return window.localStorage;
  } catch {
    return null;
  }
};

const defaultStorage = (): DraftStorage | null => safeStorage();

/**
 * Stable, fast hash used only to detect that a file changed between sessions.
 * FNV-1a plus the text length; collisions are not security-relevant here.
 */
export function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${hash.toString(16).padStart(8, '0')}-${text.length.toString(16)}`;
}

export const draftKey = (folderName: string, path: string): string =>
  `${DRAFT_PREFIX}:${folderName}:${path}`;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const isDraftRecord = (value: unknown): value is DraftRecord =>
  isRecord(value) &&
  value.version === DRAFT_VERSION &&
  typeof value.text === 'string' &&
  typeof value.savedAt === 'string' &&
  typeof value.baseHash === 'string';

/** Returns the stored draft, or `null` when there is none or it is unreadable. */
export function loadDraft(
  folderName: string,
  path: string,
  storage: DraftStorage | null = defaultStorage(),
): DraftRecord | null {
  if (!storage) return null;

  try {
    const raw = storage.getItem(draftKey(folderName, path));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isDraftRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * Persists a draft. Returns the stored record, or `null` on failure (for
 * example `QuotaExceededError`); the editor keeps working in memory.
 */
export function saveDraft(
  folderName: string,
  path: string,
  text: string,
  baseHash: string,
  storage: DraftStorage | null = defaultStorage(),
  savedAt = new Date().toISOString(),
): DraftRecord | null {
  if (!storage) return null;

  const record: DraftRecord = {
    version: DRAFT_VERSION,
    text,
    savedAt,
    baseHash,
  };

  try {
    storage.setItem(draftKey(folderName, path), JSON.stringify(record));
    return record;
  } catch {
    return null;
  }
}

export function removeDraft(
  folderName: string,
  path: string,
  storage: DraftStorage | null = defaultStorage(),
): void {
  if (!storage) return;

  try {
    storage.removeItem(draftKey(folderName, path));
  } catch {
    // A failing storage must not break editing.
  }
}

/** Paths in the folder that currently have a draft, for tree badges. */
export function listDraftPaths(
  folderName: string,
  storage: DraftListStorage | null = defaultStorage() as DraftListStorage | null,
): string[] {
  if (!storage) return [];

  const prefix = `${DRAFT_PREFIX}:${folderName}:`;
  const paths: string[] = [];

  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key && key.startsWith(prefix)) paths.push(key.slice(prefix.length));
    }
  } catch {
    return [];
  }

  return paths;
}
